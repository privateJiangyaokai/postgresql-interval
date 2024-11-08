const MICROSECONDS_PER_SECOND = 1_000_000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const MONTHS_PER_YEAR = 12;

const MICROSECONDS_PER_MINUTE = MICROSECONDS_PER_SECOND * SECONDS_PER_MINUTE;
const MICROSECONDS_PER_HOUR = MICROSECONDS_PER_MINUTE * MINUTES_PER_HOUR;
const MICROSECONDS_PER_DAY = MICROSECONDS_PER_HOUR * HOURS_PER_DAY;
const MICROSECONDS_PER_MILLISECOND = 1000;

const UNIT_ALIASES = new Map([
  ['years', 'year'],
  ['year', 'year'],
  ['yr', 'year'],
  ['y', 'year'],
  ['months', 'month'],
  ['month', 'month'],
  ['mons', 'month'],
  ['mon', 'month'],
  ['days', 'day'],
  ['day', 'day'],
  ['d', 'day'],
  ['hours', 'hour'],
  ['hour', 'hour'],
  ['hr', 'hour'],
  ['h', 'hour'],
  ['minutes', 'minute'],
  ['minute', 'minute'],
  ['mins', 'minute'],
  ['min', 'minute'],
  ['seconds', 'second'],
  ['second', 'second'],
  ['secs', 'second'],
  ['sec', 'second'],
  ['s', 'second'],
  ['milliseconds', 'millisecond'],
  ['millisecond', 'millisecond'],
  ['millisecs', 'millisecond'],
  ['millisec', 'millisecond'],
  ['msecs', 'millisecond'],
  ['msec', 'millisecond'],
  ['ms', 'millisecond'],
  ['microseconds', 'microsecond'],
  ['microsecond', 'microsecond'],
  ['microsecs', 'microsecond'],
  ['microsec', 'microsecond'],
  ['usecs', 'microsecond'],
  ['usec', 'microsecond'],
  ['us', 'microsecond']
]);

interface IntervalStorage {
  months: number;
  days: number;
  microseconds: number;
}

export class Interval {
  private storage: IntervalStorage;

  constructor(input?: string | IntervalStorage) {
    this.storage = {
      months: 0,
      days: 0,
      microseconds: 0
    };

    if (input) {
      if (typeof input === 'string') {
        this.parse(input.trim());
      } else {
        this.storage = { ...input };
      }
    }
  }

  private getCanonicalUnit(unit: string): string | undefined {
    return UNIT_ALIASES.get(unit.toLowerCase());
  }

  private parse(input: string): void {
    if (this.tryParseNegativeISO(input)) return;
    if (this.tryParseISO8601(input)) return;
    if (this.tryParseTimeFormat(input)) return;
    this.parseVerboseFormat(input);
  }

  private tryParseNegativeISO(input: string): boolean {
    if (!input.startsWith('-P')) return false;
    
    const positiveInput = input.slice(1);
    this.parse(positiveInput);
    this.negateAllComponents();
    return true;
  }

  private tryParseISO8601(input: string): boolean {
    const match = input.match(/^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/);
    if (!match) return false;

    const [_, years, months, days, hours, minutes, seconds] = match;
    
    if (years) this.addMonths(parseInt(years) * MONTHS_PER_YEAR);
    if (months) this.addMonths(parseInt(months));
    if (days) this.addDays(parseInt(days));
    if (hours || minutes || seconds) {
      this.addTime(
        parseInt(hours || '0'),
        parseInt(minutes || '0'),
        parseFloat(seconds || '0')
      );
    }
    return true;
  }

  private tryParseTimeFormat(input: string): boolean {
    const match = input.match(/^(-)?(\d+):(\d+):(\d+)(?:\.(\d+))?$/);
    if (!match) return false;

    const [_, negative, hours, minutes, seconds, microseconds] = match;
    const multiplier = negative ? -1 : 1;
    
    this.addTime(
      parseInt(hours) * multiplier,
      parseInt(minutes) * multiplier,
      parseFloat(`${seconds}${microseconds ? `.${microseconds}` : ''}`) * multiplier
    );
    return true;
  }

  private parseVerboseFormat(input: string): void {
    const parts = input.split(/\s+/);
    let currentValue = 0;
    let isNegative = false;

    for (const part of parts) {
      if (this.handleNegativeSign(part)) {
        isNegative = true;
        continue;
      }

      if (this.tryParseNumber(part, value => {
        currentValue = value;
        isNegative = part.startsWith('-');
      })) continue;

      if (this.tryParseUnit(part, currentValue, isNegative)) {
        currentValue = 0;
        isNegative = false;
      }
    }
  }

  private handleNegativeSign(part: string): boolean {
    return part === '-';
  }

  private tryParseNumber(part: string, onSuccess: (value: number) => void): boolean {
    if (!/^-?\d+(\.\d+)?$/.test(part)) return false;
    onSuccess(parseFloat(part));
    return true;
  }

  private tryParseUnit(part: string, value: number, isNegative: boolean): boolean {
    if (!/^[a-z]+s?$/i.test(part)) return false;

    const unitBase = part.replace(/s$/, '');
    const canonicalUnit = this.getCanonicalUnit(unitBase);
    if (!canonicalUnit) return false;

    const multiplier = isNegative ? -1 : 1;
    const finalValue = value * multiplier;

    this.addValueWithUnit(canonicalUnit, finalValue);
    return true;
  }

  private addValueWithUnit(unit: string, value: number): void {
    switch (unit) {
      case 'year':
        this.addMonths(value * MONTHS_PER_YEAR);
        break;
      case 'month':
        this.addMonths(value);
        break;
      case 'day':
        this.addDays(value);
        break;
      case 'hour':
        this.addTime(value, 0, 0);
        break;
      case 'minute':
        this.addTime(0, value, 0);
        break;
      case 'second':
        this.addTime(0, 0, value);
        break;
      case 'millisecond':
        this.addMicroseconds(value * MICROSECONDS_PER_MILLISECOND);
        break;
      case 'microsecond':
        this.addMicroseconds(value);
        break;
    }
  }

  private negateAllComponents(): void {
    this.storage.months = -this.storage.months;
    this.storage.days = -this.storage.days;
    this.storage.microseconds = -this.storage.microseconds;
  }

  private addMicroseconds(microseconds: number): void {
    this.storage.microseconds += Math.round(microseconds);
  }

  private addMonths(months: number): void {
    this.storage.months += months;
  }

  private addDays(days: number): void {
    this.storage.days += days;
  }

  private addTime(hours: number, minutes: number, seconds: number): void {
    const totalMicroseconds = 
      hours * MICROSECONDS_PER_HOUR +
      minutes * MICROSECONDS_PER_MINUTE +
      Math.round(seconds * MICROSECONDS_PER_SECOND);
    
    this.storage.microseconds += totalMicroseconds;
  }

  private normalizeStorage(): IntervalStorage {
    const { days: extraDays, remainder: normalizedMicros } = this.normalizeMicroseconds();
    return {
      months: this.storage.months,
      days: this.storage.days + extraDays,
      microseconds: normalizedMicros
    };
  }

  private normalizeMicroseconds(): { days: number; remainder: number } {
    let totalDays = Math.floor(this.storage.microseconds / MICROSECONDS_PER_DAY);
    let remainder = this.storage.microseconds % MICROSECONDS_PER_DAY;
    
    if (this.storage.microseconds < 0 && remainder !== 0) {
      totalDays -= 1;
      remainder += MICROSECONDS_PER_DAY;
    }

    return { days: totalDays, remainder };
  }

  public add(other: Interval): Interval {
    const [a, b] = [this.normalizeStorage(), other.normalizeStorage()];
    return new Interval({
      months: a.months + b.months,
      days: a.days + b.days,
      microseconds: a.microseconds + b.microseconds
    });
  }

  public subtract(other: Interval): Interval {
    const [a, b] = [this.normalizeStorage(), other.normalizeStorage()];
    return new Interval({
      months: a.months - b.months,
      days: a.days - b.days,
      microseconds: a.microseconds - b.microseconds
    });
  }

  public multiply(factor: number): Interval {
    const norm = this.normalizeStorage();
    return new Interval({
      months: Math.round(norm.months * factor),
      days: Math.round(norm.days * factor),
      microseconds: Math.round(norm.microseconds * factor)
    });
  }

  public equals(other: Interval): boolean {
    const [a, b] = [this.normalizeStorage(), other.normalizeStorage()];
    return (
      a.months === b.months &&
      a.days === b.days &&
      a.microseconds === b.microseconds
    );
  }

  public toPostgresString(): string {
    const norm = this.normalizeStorage();
    const parts: string[] = [];

    this.appendYearsAndMonths(parts, norm.months);
    this.appendDays(parts, norm.days);
    this.appendTime(parts, norm.microseconds, norm.months === 0 && norm.days === 0);

    return parts.join(' ') || '00:00:00';
  }

  private appendYearsAndMonths(parts: string[], totalMonths: number): void {
    const absMonths = Math.abs(totalMonths);
    const years = Math.floor(absMonths / MONTHS_PER_YEAR);
    const months = absMonths % MONTHS_PER_YEAR;

    if (years > 0) {
      parts.push(`${Math.sign(totalMonths) * years} year${years !== 1 ? 's' : ''}`);
    }
    if (months > 0) {
      parts.push(`${Math.sign(totalMonths) * months} mon${months !== 1 ? 's' : ''}`);
    }
  }

  private appendDays(parts: string[], days: number): void {
    if (days !== 0) {
      parts.push(`${days} day${Math.abs(days) !== 1 ? 's' : ''}`);
    }
  }

  private appendTime(parts: string[], microseconds: number, forceDisplay: boolean): void {
    if (microseconds === 0 && !forceDisplay) return;

    const { hours, minutes, seconds, remainingMicros, isNegative } = this.decomposeTime(microseconds);
    let timeStr = `${isNegative ? '-' : ''}${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    if (remainingMicros > 0) {
      timeStr += `.${remainingMicros.toString().padStart(6, '0')}`;
    }
    
    parts.push(timeStr);
  }

  private decomposeTime(microseconds: number): { 
    hours: number; 
    minutes: number; 
    seconds: number; 
    remainingMicros: number;
    isNegative: boolean;
  } {
    let remaining = Math.abs(microseconds);
    const hours = Math.floor(remaining / MICROSECONDS_PER_HOUR);
    remaining %= MICROSECONDS_PER_HOUR;

    const minutes = Math.floor(remaining / MICROSECONDS_PER_MINUTE);
    remaining %= MICROSECONDS_PER_MINUTE;

    const seconds = Math.floor(remaining / MICROSECONDS_PER_SECOND);
    remaining %= MICROSECONDS_PER_SECOND;

    return {
      hours,
      minutes,
      seconds,
      remainingMicros: remaining,
      isNegative: microseconds < 0
    };
  }

  public getStorage(): IntervalStorage {
    return this.normalizeStorage();
  }
}