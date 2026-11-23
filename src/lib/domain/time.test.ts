import { describe, expect, it } from 'vitest';
import { addDays, formatDate, formatShortDate, nowInKyiv, todayInKyiv } from './time';

describe('Kyiv time', () => {
  it('uses the Kyiv date just after Kyiv midnight, not the UTC date', () => {
    expect(todayInKyiv(new Date('2026-08-13T22:30:00Z'))).toBe('2026-08-14');
  });

  it('formats Kyiv local date-time', () => {
    expect(nowInKyiv(new Date('2026-08-13T22:30:00Z'))).toBe('2026-08-14T01:30');
  });

  it('handles winter time (UTC+2)', () => {
    expect(nowInKyiv(new Date('2026-12-01T10:05:00Z'))).toBe('2026-12-01T12:05');
  });
});

describe('addDays', () => {
  it('crosses year boundaries', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
  });

  it('goes backwards', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('formatShortDate', () => {
  it('formats as DD.MM', () => {
    expect(formatShortDate('2026-08-14')).toBe('14.08');
    expect(formatShortDate('2026-09-02T14:00')).toBe('02.09');
  });
});

describe('formatDate', () => {
  it('formats as DD.MM.YYYY', () => {
    expect(formatDate('2026-08-14')).toBe('14.08.2026');
    expect(formatDate('2024-07-02T14:00')).toBe('02.07.2024');
  });
});
