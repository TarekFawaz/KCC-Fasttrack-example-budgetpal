import { z } from 'zod';

export const CATEGORY_KINDS = ['expense', 'income'] as const;

const NameField = z
  .string({ required_error: 'Name is required.' })
  .trim()
  .min(1, 'Name is required.')
  .max(60, 'Name must be at most 60 characters.')
  .describe('Category name, 1 to 60 characters, unique per user ignoring letter case.');

const KindField = z
  .enum(CATEGORY_KINDS, { errorMap: () => ({ message: 'Kind must be expense or income.' }) })
  .describe('expense or income.');

export const createCategory = z.object({ name: NameField, kind: KindField }).strict();
export type CreateCategory = z.infer<typeof createCategory>;

/** At least one of `name` or `kind`. */
export const updateCategory = z
  .object({ name: NameField.optional(), kind: KindField.optional() })
  .strict()
  .refine((body) => body.name !== undefined || body.kind !== undefined, {
    message: 'Provide a name or a kind to change.',
  });
export type UpdateCategory = z.infer<typeof updateCategory>;

export const categoryParams = z
  .object({ id: z.coerce.number({ invalid_type_error: 'Id must be an integer.' }).int('Id must be an integer.').positive('Id must be positive.') })
  .strict();
export type CategoryParams = z.infer<typeof categoryParams>;

export const category = z
  .object({
    id: z.number().int(),
    name: z.string(),
    kind: z.enum(CATEGORY_KINDS),
    createdAt: z.string().describe('UTC ISO 8601 timestamp.'),
  })
  .strict();
export type Category = z.infer<typeof category>;
