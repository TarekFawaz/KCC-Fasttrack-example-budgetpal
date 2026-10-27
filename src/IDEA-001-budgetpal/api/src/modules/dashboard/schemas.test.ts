import { describe, expect, it } from 'vitest';
import { monthRange, spendingQuerySchema, trendQuerySchema } from './schemas.js';

describe('dashboard query schemas (Enabler-001)', () => {
  it('T-003 rejects bad month, months and end values, defaults months to 6, rejects unknown keys (AC-3)', () => {
    expect(spendingQuerySchema.safeParse({ month: '2026-13' }).success).toBe(false);
    expect(spendingQuerySchema.safeParse({ month: '2026-02' }).success).toBe(true);
    expect(spendingQuerySchema.safeParse({ month: '2026-02', extra: 1 }).success).toBe(false);
    expect(trendQuerySchema.safeParse({ months: '0' }).success).toBe(false);
    expect(trendQuerySchema.safeParse({ months: '25' }).success).toBe(false);
    expect(trendQuerySchema.safeParse({ end: 'abc' }).success).toBe(false);
    expect(trendQuerySchema.safeParse({ end: '2026-99' }).success).toBe(false);
    expect(trendQuerySchema.safeParse({ nope: 1 }).success).toBe(false);
    expect(trendQuerySchema.parse({})).toEqual({ months: 6 });
    expect(trendQuerySchema.parse({ months: '24', end: '2026-03' })).toEqual({ months: 24, end: '2026-03' });
  });

  it('T-004 monthRange is half-open, rolls December over and handles leap February (AC-3)', () => {
    expect(monthRange('2026-02')).toEqual({ from: '2026-02-01', to: '2026-03-01' });
    expect(monthRange('2025-12')).toEqual({ from: '2025-12-01', to: '2026-01-01' });
    expect(monthRange('2028-02')).toEqual({ from: '2028-02-01', to: '2028-03-01' });
    expect(() => monthRange('2026-13')).toThrow(RangeError);
  });
});
