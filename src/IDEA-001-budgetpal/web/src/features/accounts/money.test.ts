import { describe, expect, it } from 'vitest';
import { MAX_MINOR, formatMoney, fromMinorUnits, installCurrency, minorDigits, toMinorUnits } from './money';

describe('toMinorUnits (T-021)', () => {
  it.each([
    ['1234.50', 123450],
    ['-20', -2000],
    ['0.1', 10],
    ['.5', 50],
    ['5.', 500],
    ['  7.05 ', 705],
    ['+3', 300],
    ['-0', 0],
    ['0', 0],
    ['1000000000.00', 100_000_000_000],
  ])('T-021 %j is %d minor units for a 2-digit currency', (text, expected) => {
    expect(toMinorUnits(text, 2)).toBe(expected);
  });

  it('T-021 never loses a cent to float rounding', () => {
    // 1.005 * 100 === 100.49999999999999 in floats; string math has no such case.
    expect(toMinorUnits('1.00', 2)).toBe(100);
    expect(toMinorUnits('0.29', 2)).toBe(29);
    expect(toMinorUnits('4.35', 2)).toBe(435);
    expect(toMinorUnits('9007199254740.99', 2)).toBeNull();
  });

  it.each(['1.234', 'abc', '1,5', '1e3', '--2', '1.2.3', '', '  ', '.', '-', '$5', '0x10'])(
    'T-021 rejects %j',
    (text) => {
      expect(toMinorUnits(text, 2)).toBeNull();
    },
  );

  it('T-021 rejects an amount beyond the supported range and accepts the limit', () => {
    expect(toMinorUnits('10000000000.00', 2)).toBe(MAX_MINOR);
    expect(toMinorUnits('10000000000.01', 2)).toBeNull();
    expect(toMinorUnits('-10000000000.01', 2)).toBeNull();
  });

  it('T-021 follows the currency digits: none for JPY, three for KWD', () => {
    expect(minorDigits('JPY')).toBe(0);
    expect(minorDigits('USD')).toBe(2);
    expect(minorDigits('KWD')).toBe(3);
    expect(toMinorUnits('1500', 0)).toBe(1500);
    expect(toMinorUnits('1500.5', 0)).toBeNull();
    expect(toMinorUnits('1.234', 3)).toBe(1234);
  });
});

describe('fromMinorUnits and formatMoney (T-020)', () => {
  it.each([
    [123450, 2, '1234.50'],
    [-2000, 2, '-20.00'],
    [5, 2, '0.05'],
    [0, 2, '0.00'],
    [1500, 0, '1500'],
    [1234, 3, '1.234'],
  ])('T-020 %d minor units with %d digits is %j', (minor, digits, expected) => {
    expect(fromMinorUnits(minor, digits)).toBe(expected);
  });

  it('T-021 fromMinorUnits is the inverse of toMinorUnits', () => {
    for (const minor of [0, 1, 99, 100, 123450, -1, -123456789, MAX_MINOR, -MAX_MINOR]) {
      expect(toMinorUnits(fromMinorUnits(minor, 2), 2)).toBe(minor);
    }
  });

  it('T-020 formats through Intl in the given currency, exactly', () => {
    expect(formatMoney(123450, 'USD')).toBe(new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(1234.5));
    expect(formatMoney(-2000, 'EUR')).toBe(new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' }).format(-20));
    expect(formatMoney(1500, 'JPY')).toBe(new Intl.NumberFormat(undefined, { style: 'currency', currency: 'JPY' }).format(1500));
    // Every digit of the largest amounts survives (the decimal string is handed to Intl as is).
    expect(formatMoney(MAX_MINOR - 1, 'USD').replaceAll(/\D/g, '')).toBe('999999999999');
  });

  it('T-020 the install currency is USD unless a valid VITE_CURRENCY says otherwise', () => {
    expect(installCurrency()).toMatch(/^[A-Z]{3}$/);
  });
});
