import { z } from 'zod';

export const DEFAULT_TREND_MONTHS = 6;
export const MAX_TREND_MONTHS = 24;

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const monthString = z.string().regex(MONTH_PATTERN, 'Month must be YYYY-MM');

/** `GET /api/dashboard/spending` query. Unknown keys are rejected. */
export const spendingQuerySchema = z.object({ month: monthString }).strict();

/** `GET /api/dashboard/trend` query. Query values arrive as strings, so `months` is coerced. */
export const trendQuerySchema = z
  .object({
    months: z.coerce.number().int().min(1).max(MAX_TREND_MONTHS).default(DEFAULT_TREND_MONTHS),
    end: monthString.optional(),
  })
  .strict();

export const spendingResponseSchema = z.object({
  month: z.string(),
  currency: z.string(),
  totalMinor: z.number().int(),
  categories: z.array(z.object({ categoryId: z.number().int(), name: z.string(), amountMinor: z.number().int() })),
});

export const trendResponseSchema = z.object({
  currency: z.string(),
  points: z.array(z.object({ month: z.string(), totalMinor: z.number().int() })),
});

export type SpendingQuery = z.infer<typeof spendingQuerySchema>;
export type TrendQuery = z.infer<typeof trendQuerySchema>;

const pad = (n: number): string => String(n).padStart(2, '0');

/** Half-open date range `[from, to)` covering one calendar month, as `YYYY-MM-DD` text. */
export function monthRange(month: string): { from: string; to: string } {
  if (!MONTH_PATTERN.test(month)) throw new RangeError(`invalid month: ${month}`);
  const year = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  const nextYear = m === 12 ? year + 1 : year;
  const nextMonth = m === 12 ? 1 : m + 1;
  return { from: `${month}-01`, to: `${String(nextYear).padStart(4, '0')}-${pad(nextMonth)}-01` };
}

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
