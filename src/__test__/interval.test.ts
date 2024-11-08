import { Client } from 'pg';
import { Interval } from '../interval';
import { beforeAll, afterAll, describe, test, expect } from '@jest/globals';

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
  const pgConverted = new Interval(pgInterval);
  expect(tsInterval.toPostgresString()).toEqual(pgInterval);
  expect(tsInterval.getStorage()).toEqual(pgConverted.getStorage());
}

async function runPgQuery<T>(query: string, params: any[] = []): Promise<T> {
  const result = await client.query(query, params);
  return result.rows[0];
}

async function compareArithmeticOperation(
  operation: 'add' | 'subtract' | 'multiply',
  interval1: string,
  interval2: string | number
): Promise<void> {
  let query: string;
  let params: any[];

  switch (operation) {
    case 'add':
      query = `
        SELECT 
          $1::interval + $2::interval as result,
          $1::interval as first,
          $2::interval as second
      `;
      params = [interval1, interval2];
      break;
    case 'subtract':
      query = `
        SELECT 
          $1::interval - $2::interval as result,
          $1::interval as first,
          $2::interval as second
      `;
      params = [interval1, interval2];
      break;
    case 'multiply':
      query = `
        SELECT 
          $1::interval * $2 as result,
          $1::interval as first
      `;
      params = [interval1, interval2];
      break;
    default:
      throw new Error('Unsupported operation');
  }

  const result = await runPgQuery<{
    result: string;
    first: string;
    second?: string;
  }>(query, params);

  const tsInterval1 = new Interval(result.first);
  let tsResult;

  if (operation === 'multiply') {
    tsResult = tsInterval1.multiply(interval2 as number);
  } else {
    const tsInterval2 = new Interval(result.second!);
    tsResult = operation === 'add' 
      ? tsInterval1.add(tsInterval2)
      : tsInterval1.subtract(tsInterval2);
  }

  const pgResult = new Interval(result.result);
  expect(tsResult.getStorage()).toEqual(pgResult.getStorage());
}

describe('PostgreSQL Interval Integration Tests', () => {
  describe('Simple Intervals', () => {
    const simpleIntervals = [
      { name: 'year', value: '1 year' },
      { name: 'months', value: '2 months' },
      { name: 'days', value: '3 days' },
      { name: 'hours', value: '4 hours' },
      { name: 'minutes', value: '5 minutes' },
      { name: 'seconds', value: '6 seconds' },
      { name: 'fractional hours', value: '1.5 hours' }
    ];

    test.each(simpleIntervals)('should parse $name: $value', async ({ value }) => {
      await compareWithPostgres(value);
    });
  });

  describe('Negative Intervals', () => {
    const negativeIntervals = [
      { name: 'days', value: '-30 days' },
      { name: 'ISO format', value: '-P1Y2M3DT4H5M6S' },
      { name: 'mixed signs', value: '1 year -23 hours' },
      { name: 'large negative', value: '-999999 years' },
      { name: 'complex mixed', value: '1 year -2 months 3 days -4 hours 5 minutes -6.789 seconds' }
    ];

    test.each(negativeIntervals)('should parse negative $name: $value', async ({ value }) => {
      await compareWithPostgres(value);
    });
  });

  describe('Combined Intervals', () => {
    const combinedIntervals = [
      { name: 'year-month-day', value: '1 year 2 months 3 days' },
      { name: 'day-time', value: '1 day 2 hours 3 minutes 4 seconds' },
      { name: 'ISO format', value: 'P1Y2M3DT4H5M6S' },
      { name: 'full with fractions', value: '1 year 2 months 3 days 4 hours 5 minutes 6.789 seconds' }
    ];

    test.each(combinedIntervals)('should parse combined $name: $value', async ({ value }) => {
      await compareWithPostgres(value);
    });
  });

  describe('Arithmetic Operations', () => {
    const arithmeticCases = [
      { operation: 'add' as const, first: '1 year', second: '6 months' },
      { operation: 'subtract' as const, first: '1 year', second: '6 months' },
      { operation: 'multiply' as const, first: '1 year 2 months', second: 2 }
    ];

    test.each(arithmeticCases)(
      'should perform $operation correctly',
      async ({ operation, first, second }) => {
        await compareArithmeticOperation(operation, first, second);
      }
    );
  });

  describe('Edge Cases', () => {
    const edgeCases = [
      { name: 'zero', value: '0 seconds' },
      { name: 'max years', value: '999999 years' },
      { name: 'fractional seconds', value: '0.99999999 seconds' },
      { name: 'max precision', value: 'P999Y11M30DT23H59M59.999999S' },
      { name: 'time only', value: '23:59:59.999999' }
    ];

    test.each(edgeCases)('should handle edge case: $name', async ({ value }) => {
      await compareWithPostgres(value);
    });
  });

  describe('String Representations', () => {
    test('should generate equivalent PostgreSQL string representation', async () => {
      const testInterval = '1 year 2 months 3 days 4:05:06.789';
      const tsInterval = new Interval(testInterval);
      
      const { pg_string, interval_val } = await runPgQuery<{
        pg_string: string;
        interval_val: string;
      }>(`
        SELECT 
          $1::interval::text as pg_string,
          $1::interval as interval_val
      `, [testInterval]);

      const ourInterval = new Interval(interval_val);
      expect(ourInterval.getStorage()).toEqual(tsInterval.getStorage());
      
      const pgParsedFromOurString = await getPgInterval(tsInterval.toPostgresString());
      const pgFromOurString = new Interval(pgParsedFromOurString);
      expect(pgFromOurString.getStorage()).toEqual(tsInterval.getStorage());
    });
  });

  describe('Justification Rules', () => {
    const equivalentPairs = [
      ['1 month 30 days', '30 days 1 month'],
      ['24 hours', '1 day'],
      ['60 minutes', '1 hour'],
      ['3600 seconds', '1 hour']
    ];

    test.each(equivalentPairs)(
      'should treat %s and %s as equal',
      async (interval1, interval2) => {
        const { is_equal } = await runPgQuery<{ is_equal: boolean }>(
          'SELECT $1::interval = $2::interval as is_equal',
          [interval1, interval2]
        );

        const tsInterval1 = new Interval(interval1);
        const tsInterval2 = new Interval(interval2);
        expect(tsInterval1.equals(tsInterval2)).toBe(is_equal);
      }
    );
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