import { describe, expect, it } from 'vitest';
import {
  createTransactionSchema,
  listTransactionsQuerySchema,
  MAX_AMOUNT_MINOR,
  patchTransactionSchema,
} from './transactions.schemas.js';

const valid = { accountId: 1, categoryId: 2, occurredOn: '2026-02-28', amountMinor: 1250, description: 'Coffee' };

describe('transactions schemas', () => {
  it('T-003 accepts valid input', () => {
    expect(createTransactionSchema.safeParse(valid).success).toBe(true);
    expect(createTransactionSchema.safeParse({ ...valid, amountMinor: MAX_AMOUNT_MINOR }).success).toBe(true);
    expect(patchTransactionSchema.safeParse({ description: 'x' }).success).toBe(true);
    expect(listTransactionsQuerySchema.parse({})).toEqual({ limit: 50, offset: 0 });
    expect(listTransactionsQuerySchema.parse({ month: '2026-12', limit: '200', offset: '3' })).toMatchObject({
      month: '2026-12',
      limit: 200,
      offset: 3,
    });
  });

  it.each([
    ['unknown key', { ...valid, extra: 1 }],
    ['zero amount', { ...valid, amountMinor: 0 }],
    ['negative amount', { ...valid, amountMinor: -5 }],
    ['fractional amount', { ...valid, amountMinor: 1.5 }],
    ['oversized amount', { ...valid, amountMinor: MAX_AMOUNT_MINOR + 1 }],
    ['string amount', { ...valid, amountMinor: '12' }],
    ['impossible date', { ...valid, occurredOn: '2026-02-30' }],
    ['malformed date', { ...valid, occurredOn: '2026-2-3' }],
    ['empty description', { ...valid, description: '' }],
    ['201-char description', { ...valid, description: 'a'.repeat(201) }],
  ])('T-003 create rejects %s', (_label, body) => {
    expect(createTransactionSchema.safeParse(body).success).toBe(false);
  });

  it('T-003 patch rejects an empty body, unknown keys and invalid values', () => {
    expect(patchTransactionSchema.safeParse({}).success).toBe(false);
    expect(patchTransactionSchema.safeParse({ nope: 1 }).success).toBe(false);
    expect(patchTransactionSchema.safeParse({ amountMinor: 0 }).success).toBe(false);
  });

  it('T-003 list query rejects month 2026-13, bad paging and unknown keys', () => {
    expect(listTransactionsQuerySchema.safeParse({ month: '2026-13' }).success).toBe(false);
    expect(listTransactionsQuerySchema.safeParse({ limit: '201' }).success).toBe(false);
    expect(listTransactionsQuerySchema.safeParse({ offset: '-1' }).success).toBe(false);
    expect(listTransactionsQuerySchema.safeParse({ other: 'x' }).success).toBe(false);
  });
});
