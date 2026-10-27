import { z } from 'zod';

/** Largest budget in minor units (10^12 - 1), the same bound as a transaction amount. */
export const MAX_AMOUNT_MINOR = 999_999_999_999;

/** A real month `YYYY-MM` (month number 01-12). */
export const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must be YYYY-MM');

/** `PUT` and `DELETE /budgets/:month/:categoryId` path parameters. Unknown keys are rejected. */
export const budgetParamsSchema = z
  .object({
    month: monthSchema,
    categoryId: z.coerce.number().int('Category id must be a whole number').positive('Category id must be positive'),
  })
  .strict();

/** `PUT` body: one positive safe integer amount in minor units. Unknown keys are rejected. */
export const setBudgetBodySchema = z
  .object({
    amountMinor: z
      .number({ invalid_type_error: 'Amount must be a number of minor units', required_error: 'Amount is required' })
      .int('Amount must be a whole number of minor units')
      .min(1, 'Amount must be greater than zero')
      .max(MAX_AMOUNT_MINOR, 'Amount is out of range'),
  })
  .strict();

export const budgetSchema = z.object({
  id: z.number().int(),
  categoryId: z.number().int(),
  month: z.string(),
  amountMinor: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/** RFC 9457 body, documented under the media type it is returned with. */
const problemSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string(),
  instance: z.string().optional(),
  errors: z.array(z.object({ field: z.string(), message: z.string() })).optional(),
});

export const problemContent = (description: string) => ({
  description,
  content: { 'application/problem+json': { schema: problemSchema } },
});

export type BudgetParams = z.infer<typeof budgetParamsSchema>;
export type SetBudgetBody = z.infer<typeof setBudgetBodySchema>;
export type BudgetDto = z.infer<typeof budgetSchema>;
