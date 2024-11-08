# PostgreSQL Interval TypeScript Implementation

A TypeScript implementation of PostgreSQL's interval type that accurately handles parsing, arithmetic operations, and string formatting according to PostgreSQL's specifications.

⚠️ **Note: This implementation is currently a work in progress. Several features are still broken or inconsistent with PostgreSQL's behavior, particularly around negative intervals, arithmetic operations, and complex mixed-sign cases.**

## Features

- Full compatibility with PostgreSQL interval parsing and formatting
- Support for all PostgreSQL interval input formats:
  - ISO 8601 duration format (`P1Y2M3DT4H5M6.789S`)
  - Postgres verbose format (`1 year 2 months 3 days 04:05:06.789`)
  - SQL standard format (`1-2` for year-month)
  - Time format (`HH:MM:SS.NNNNNN`)
- Proper handling of negative intervals and mixed signs
- Microsecond precision
- Support for all common unit abbreviations (year, yr, mon, day, hr, min, sec, ms, us)
- Arithmetic operations (add, subtract, multiply)

## Installation

Should be, but not published yet: 
```bash
npm install postgresql-interval
```

## Usage

### Basic Usage

```typescript
import { Interval } from 'postgresql-interval';

// Create intervals from various formats
const interval1 = new Interval('1 year 2 months');
const interval2 = new Interval('P1Y2M');
const interval3 = new Interval('04:05:06.789');

// Convert to PostgreSQL string format
console.log(interval1.toPostgresString()); // "1 year 2 mons"
```

### Parsing Examples

```typescript
// Different ways to specify the same duration
new Interval('2 years');         // "2 years"
new Interval('24 months');       // "2 years"
new Interval('P2Y');            // "2 years"

// Time components
new Interval('2 hours');        // "02:00:00"
new Interval('2:30:00');        // "02:30:00"
new Interval('PT2H30M');       // "02:30:00"

// Mixed precision
new Interval('1.5 hours');     // "01:30:00"
new Interval('2.5 days');      // "2 days 12:00:00"

// Microsecond precision
new Interval('0.123456 seconds');  // "00:00:00.123456"
new Interval('2 milliseconds');    // "00:00:00.002"
new Interval('2 microseconds');    // "00:00:00.000002"
```

### Arithmetic Operations

```typescript
const interval1 = new Interval('1 year');
const interval2 = new Interval('6 months');

// Addition
const sum = interval1.add(interval2);
console.log(sum.toPostgresString()); // "1 year 6 mons"

// Subtraction
const diff = interval1.subtract(interval2);
console.log(diff.toPostgresString()); // "6 mons"

// Multiplication
const doubled = interval1.multiply(2);
console.log(doubled.toPostgresString()); // "2 years"
```

### Negative Intervals

```typescript
// Explicit negative intervals
new Interval('-1 year');              // "-1 year"
new Interval('-P1Y');                 // "-1 year"
new Interval('-12:00:00');           // "-12:00:00"

// Mixed positive and negative components
new Interval('1 year -2 months');     // "10 mons"
new Interval('1 day -12 hours');      // "12:00:00"
```

### Storage Format

The interval is stored internally using three components:
- `months`: total number of months (including years converted to months)
- `days`: total number of days
- `microseconds`: total number of microseconds (including hours, minutes, seconds)

```typescript
const interval = new Interval('1 year 2 months 3 days 04:05:06.789');
console.log(interval.getStorage());
// {
//   months: 14,      // 1 year (12) + 2 months
//   days: 3,
//   microseconds: 14706789000  // 4h 5m 6s 789ms in microseconds
// }
```

## Integration Testing

The implementation is tested against a real PostgreSQL database to ensure exact compatibility. Test cases cover:
- All input formats
- Edge cases
- Arithmetic operations
- String representations
- Justification rules
- Mixed sign handling
- Precision handling

## License

Apache-2.0

## Contributing

Contributions are welcome! Please submit issues and pull requests on GitHub.
