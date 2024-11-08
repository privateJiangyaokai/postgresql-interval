import { Client } from 'pg';
import { Interval } from '../interval'
import { beforeAll, afterAll, describe, test, expect } from '@jest/globals';

describe('PostgreSQL Interval Integration Tests', () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({
      host: 'localhost',
      port: 5432,
      database: 'test',
      user: 'postgres',
      password: 'postgres'
    });
    await client.connect();
  });

  afterAll(async () => {
    await client.end();
  });

  async function getPgInterval(intervalStr: string): Promise<string> {
    const result = await client.query(
      'SELECT $1::interval::text as interval_val',
      [intervalStr]
    );
    return result.rows[0].interval_val;
  }

  async function compareWithPostgres(intervalStr: string) {
    const tsInterval = new Interval(intervalStr);
    const pgInterval = await getPgInterval(intervalStr);
    expect(tsInterval.toPostgresString()).toEqual(pgInterval);
    const pgConverted = new Interval(pgInterval);
    expect(tsInterval.getStorage()).toEqual(pgConverted.getStorage());
  }

  describe('Basic Interval Parsing', () => {
    const testCases = [
      '1 year',
      '2 months',
      '3 days',
      '4 hours',
      '5 minutes',
      '6 seconds',
      '1.5 hours',
      '-30 days',
      '1 year 2 months 3 days',
      '1 day 2 hours 3 minutes 4 seconds',
      'P1Y2M3DT4H5M6S',
      '-P1Y2M3DT4H5M6S'
    ];

    test.each(testCases)('should correctly parse: %s', async (intervalStr) => {
      await compareWithPostgres(intervalStr);
    });
  });

  describe('Arithmetic Operations', () => {
    test('addition', async () => {
      const query = `
        SELECT 
          '1 year'::interval + '6 months'::interval as sum,
          '1 year'::interval as interval1,
          '6 months'::interval as interval2
      `;
      const result = await client.query(query);
      const { sum, interval1, interval2 } = result.rows[0];

      const tsInterval1 = new Interval(interval1);
      const tsInterval2 = new Interval(interval2);
      const tsSum = tsInterval1.add(tsInterval2);

      const pgSum = new Interval(sum);
      expect(tsSum.getStorage()).toEqual(pgSum.getStorage());
    });

    test('subtraction', async () => {
      const query = `
        SELECT 
          '1 year'::interval - '6 months'::interval as difference,
          '1 year'::interval as interval1,
          '6 months'::interval as interval2
      `;
      const result = await client.query(query);
      const { difference, interval1, interval2 } = result.rows[0];

      const tsInterval1 = new Interval(interval1);
      const tsInterval2 = new Interval(interval2);
      const tsDiff = tsInterval1.subtract(tsInterval2);

      const pgDiff = new Interval(difference);
      expect(tsDiff.getStorage()).toEqual(pgDiff.getStorage());
    });

    test('multiplication', async () => {
      const query = `
        SELECT 
          '1 year 2 months'::interval * 2 as product,
          '1 year 2 months'::interval as interval1
      `;
      const result = await client.query(query);
      const { product, interval1 } = result.rows[0];

      const tsInterval = new Interval(interval1);
      const tsProduct = tsInterval.multiply(2);

      const pgProduct = new Interval(product);
      expect(tsProduct.getStorage()).toEqual(pgProduct.getStorage());
    });
  });

  describe('Edge Cases', () => {
    const edgeCases = [
      '0 seconds',
      '999999 years',
      '-999999 years',
      '1 year -23 hours',
      '0.99999999 seconds',
      'P999Y11M30DT23H59M59.999999S',
      '23:59:59.999999',
    ];

    test.each(edgeCases)('should handle edge case: %s', async (intervalStr) => {
      await compareWithPostgres(intervalStr);
    });
  });

  describe('Complex Intervals', () => {
    const complexCases = [
      '1 year 2 months 3 days 4 hours 5 minutes 6.789 seconds',
      'P1Y2M3DT4H5M6.789S',
      '1 year -2 months 3 days -4 hours 5 minutes -6.789 seconds',
      '-P1Y2M3DT4H5M6.789S'
    ];

    test.each(complexCases)('should handle complex interval: %s', async (intervalStr) => {
      await compareWithPostgres(intervalStr);
    });
  });

  describe('String Representations', () => {
    test('should generate equivalent PostgreSQL string representation', async () => {
      const testInterval = '1 year 2 months 3 days 4:05:06.789';
      const tsInterval = new Interval(testInterval);
      
      const query = `
        SELECT 
          $1::interval::text as pg_string,
          $1::interval as interval_val
      `;
      const result = await client.query(query, [testInterval]);
      const { pg_string, interval_val } = result.rows[0];

      const pgParsedFromOurString = await getPgInterval(tsInterval.toPostgresString());
      const ourInterval = new Interval(interval_val);
      
      expect(ourInterval.getStorage()).toEqual(tsInterval.getStorage());
      
      const pgFromOurString = new Interval(pgParsedFromOurString);
      expect(pgFromOurString.getStorage()).toEqual(tsInterval.getStorage());
    });
  });

  describe('Justification Rules', () => {
    test('should handle equivalent intervals', async () => {
      const equivalentPairs = [
        ['1 month 30 days', '30 days 1 month'],
        ['24 hours', '1 day'],
        ['60 minutes', '1 hour'],
        ['3600 seconds', '1 hour']
      ];

      for (const [interval1, interval2] of equivalentPairs) {
        const pgResult = await client.query(
          'SELECT $1::interval = $2::interval as is_equal',
          [interval1, interval2]
        );
        const { is_equal } = pgResult.rows[0];

        const tsInterval1 = new Interval(interval1);
        const tsInterval2 = new Interval(interval2);

        expect(tsInterval1.equals(tsInterval2)).toBe(is_equal);
      }
    });
  });

  describe('ISO 8601 Format', () => {
    const isoCases = [
      { iso: 'P1Y', pg: '1 year' },
      { iso: 'P1M', pg: '1 month' },
      { iso: 'P1D', pg: '1 day' },
      { iso: 'PT1H', pg: '1 hour' },
      { iso: 'PT1M', pg: '1 minute' },
      { iso: 'PT1S', pg: '1 second' },
      { iso: 'P1Y2M3DT4H5M6.789S', pg: '1 year 2 months 3 days 4:05:06.789' }
    ];

    test.each(isoCases)('should correctly parse ISO format: $iso', async ({ iso, pg }) => {
      const tsFromIso = new Interval(iso);
      const pgInterval = await getPgInterval(pg);
      const pgConverted = new Interval(pgInterval);

      expect(tsFromIso.getStorage()).toEqual(pgConverted.getStorage());
    });
  });
});