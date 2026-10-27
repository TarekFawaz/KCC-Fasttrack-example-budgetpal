import { describe, expect, it } from 'vitest';
import { MAX_AMOUNT_MINOR, budgetParamsSchema, setBudgetBodySchema } from './budgets.schema.js';

describe('budgets.schema', () => {
  it('T-008 accepts a real month, a numeric-string category id and the amount bounds', () => {
    expect(budgetParamsSchema.parse({ month: '2026-03', categoryId: '12' })).toEqual({ month: '2026-03', categoryId: 12 });
    expect(budgetParamsSchema.safeParse({ month: '2026-12', categoryId: '1' }).success).toBe(true);
    expect(setBudgetBodySchema.safeParse({ amountMinor: 1 }).success).toBe(true);
    expect(setBudgetBodySchema.safeParse({ amountMinor: MAX_AMOUNT_MINOR }).success).toBe(true);
  });

  it('T-008 rejects a bad month, an unknown param and a bad category id', () => {
    for (const month of ['2026-13', '2026-00', '2026-1', '26-01', '2026-01-01', '', 'march']) {
      expect(budgetParamsSchema.safeParse({ month, categoryId: '1' }).success, month).toBe(false);
    }
    expect(budgetParamsSchema.safeParse({ month: '2026-01', categoryId: '0' }).success).toBe(false);
    expect(budgetParamsSchema.safeParse({ month: '2026-01', categoryId: 'abc' }).success).toBe(false);
    expect(budgetParamsSchema.safeParse({ month: '2026-01', categoryId: '1.5' }).success).toBe(false);
    expect(budgetParamsSchema.safeParse({ month: '2026-01', categoryId: '1', extra: 1 }).success).toBe(false);
  });

  it('T-008 rejects zero, negative, fractional, string, missing, over-max amounts and unknown fields', () => {
    for (const amountMinor of [0, -1, 12.5, '1250', null, MAX_AMOUNT_MINOR + 1, Number.NaN]) {
      expect(setBudgetBodySchema.safeParse({ amountMinor }).success, String(amountMinor)).toBe(false);
    }
    expect(setBudgetBodySchema.safeParse({}).success).toBe(false);
    expect(setBudgetBodySchema.safeParse({ amountMinor: 100, extra: 1 }).success).toBe(false);
  });
});
