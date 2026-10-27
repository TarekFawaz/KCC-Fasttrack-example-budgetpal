import { z } from 'zod';

export const ACCOUNT_TYPES = ['checking', 'savings', 'credit_card', 'cash', 'other'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

/** Largest absolute opening balance in minor units (10^12). */
export const MAX_BALANCE_MINOR = 1_000_000_000_000;

const name = z.string().trim().min(1, 'Name is required').max(60, 'Name must be at most 60 characters');
const type = z.enum(ACCOUNT_TYPES);
const openingBalanceMinor = z
  .number()
  .int('Opening balance must be a whole number of minor units')
  .min(-MAX_BALANCE_MINOR, 'Opening balance is out of range')
  .max(MAX_BALANCE_MINOR, 'Opening balance is out of range');

/** Request body for create. Unknown keys are rejected. */
export const createAccountSchema = z
  .object({
    name,
    type,
    openingBalanceMinor: openingBalanceMinor.default(0),
  })
  .strict();

/** Request body for update: a full replacement of the editable fields. */
export const updateAccountSchema = createAccountSchema;

/** Path params. The id is a positive integer. */
export const accountIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const accountSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  type,
  openingBalanceMinor: z.number().int(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
export type Account = z.infer<typeof accountSchema>;
