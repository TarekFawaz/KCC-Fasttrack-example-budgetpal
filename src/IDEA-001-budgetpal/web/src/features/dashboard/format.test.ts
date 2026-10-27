import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { currentMonth, formatMoney, formatPermille, MONTH_PATTERN, sharePermille } from './format';

const here = dirname(fileURLToPath(import.meta.url));
const collapse = (text: string) => text.replace(/\s+/g, ' ');

describe('dashboard format helpers', () => {
  it('T-023 shares add up to exactly 100.0% (largest remainder) and keep input order', () => {
    expect(sharePermille([1000, 500, 500], 2000)).toEqual([500, 250, 250]);
    const thirds = sharePermille([100, 100, 100], 300);
    expect(thirds.reduce((a, b) => a + b, 0)).toBe(1000);
    expect(thirds).toEqual([334, 333, 333]);
    const odd = sharePermille([1, 1, 1, 1, 1, 1, 1], 7);
    expect(odd.reduce((a, b) => a + b, 0)).toBe(1000);
  });

  it('T-023 a zero or empty total is safe (no division by zero, no NaN)', () => {
    expect(sharePermille([], 0)).toEqual([]);
    expect(sharePermille([0, 0], 0)).toEqual([0, 0]);
    expect(formatPermille(0)).toBe('0.0%');
  });

  it('T-023 shares are formatted from integers', () => {
    expect(formatPermille(334)).toBe('33.4%');
    expect(formatPermille(1000)).toBe('100.0%');
    expect(formatPermille(5)).toBe('0.5%');
  });

  it('T-023 money is formatted with Intl in the response currency from integer minor units', () => {
    const usd = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' });
    expect(collapse(formatMoney(123450, 'USD'))).toBe(collapse(usd.format('1234.50' as unknown as number)));
    expect(collapse(formatMoney(5, 'USD'))).toBe(collapse(usd.format('0.05' as unknown as number)));
    const jpy = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'JPY' });
    expect(collapse(formatMoney(1200, 'JPY'))).toBe(collapse(jpy.format('1200' as unknown as number)));
    expect(formatMoney(0, 'EUR')).toContain('0.00');
  });

  it('T-023 the current month is YYYY-MM in local time and matches the month pattern', () => {
    expect(currentMonth(new Date(2026, 2, 5))).toBe('2026-03');
    expect(currentMonth(new Date(2026, 11, 31))).toBe('2026-12');
    expect(MONTH_PATTERN.test('2026-12')).toBe(true);
    expect(MONTH_PATTERN.test('2026-13')).toBe(false);
    expect(MONTH_PATTERN.test('')).toBe(false);
  });

  it('T-023 dashboard sources use no toFixed and no parseFloat (GR-007)', () => {
    const forbidden = new RegExp(['to', 'Fixed\\s*\\('].join('') + '|' + ['parse', 'Float'].join(''));
    for (const file of ['format.ts', 'api.ts', 'DashboardPage.tsx', 'SpendingByCategory.tsx']) {
      expect(readFileSync(resolve(here, file), 'utf8'), file).not.toMatch(forbidden);
    }
  });
});
