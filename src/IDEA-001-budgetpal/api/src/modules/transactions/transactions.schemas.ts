import { z } from 'zod';

/** Largest amount in minor units (10^12 - 1). */
export const MAX_AMOUNT_MINOR = 999_999_999_999;
export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 200;

/** A real calendar date `YYYY-MM-DD` (rejects 2026-02-30). */
const isRealDate = (value: string): boolean => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

const id = z.number().int().positive();
const occurredOn = z.string().refine(isRealDate, 'Date must be a real date as YYYY-MM-DD');
const amountMinor = z
  .number()
  .int('Amount must be a whole number of minor units')
  .min(1, 'Amount must be greater than zero')
  .max(MAX_AMOUNT_MINOR, 'Amount is out of range');
const description = z.string().min(1, 'Description is required').max(200, 'Description must be at most 200 characters');
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must be YYYY-MM');

/** Request body for create. Unknown keys are rejected. */
export const createTransactionSchema = z
  .object({ accountId: id, categoryId: id, occurredOn, amountMinor, description })
  .strict();

/** Request body for patch: any subset of the create fields, at least one. */
export const patchTransactionSchema = createTransactionSchema
  .partial()
  .strict()
  .refine((body) => Object.keys(body).length > 0, 'At least one field is required');

/** Query for list. Query values arrive as strings, so numbers are coerced. */
export const listTransactionsQuerySchema = z
  .object({
    month: month.optional(),
    accountId: z.coerce.number().int().positive().optional(),
    categoryId: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();

export const transactionIdParamsSchema = z.object({ id: z.coerce.number().int().positive() });

export const transactionSchema = z.object({
  id: z.number().int(),
  accountId: z.number().int(),
  categoryId: z.number().int(),
  occurredOn: z.string(),
  amountMinor: z.number().int(),
  description: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type PatchTransactionInput = z.infer<typeof patchTransactionSchema>;
export type ListTransactionsQuery = z.infer<typeof listTransactionsQuerySchema>;
export type Transaction = z.infer<typeof transactionSchema>;
