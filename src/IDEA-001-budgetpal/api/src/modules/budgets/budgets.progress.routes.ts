import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireUser } from '../../kernel/require-user.js';
import { monthSchema, problemContent } from './budgets.schema.js';
import { progress } from './budgets.progress.service.js';

/** `GET /budgets?month=YYYY-MM`: `month` is required and unknown query keys are rejected. */
export const progressQuerySchema = z.object({ month: monthSchema }).strict();

const progressItemSchema = z.object({
  categoryId: z.number().int(),
  categoryName: z.string(),
  budgetMinor: z.number().int(),
  spentMinor: z.number().int(),
  percent: z.number().int(),
  status: z.enum(['ok', 'warning', 'over']),
});

const unbudgetedItemSchema = z.object({
  categoryId: z.number().int(),
  categoryName: z.string(),
  spentMinor: z.number().int(),
});

export const progressResponseSchema = z.object({
  month: z.string(),
  items: z.array(progressItemSchema),
  unbudgeted: z.array(unbudgetedItemSchema),
});

/**
 * `GET /budgets` (the web client calls `/api/budgets`; the proxy strips `/api`). Read-only: no state
 * changes (GR-005). The log line holds the month and counts only, never an amount (GR-008).
 */
export function registerProgressRoutes(app: FastifyInstance): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    '/budgets',
    {
      onRequest: requireUser,
      schema: {
        summary: 'Budgets of a month with spent, percent and status',
        tags: ['budgets'],
        querystring: progressQuerySchema,
        response: {
          200: progressResponseSchema.describe('Budgeted categories and unbudgeted spending for the month'),
          400: problemContent('The month is missing or invalid, or the query holds an unknown key'),
          401: problemContent('There is no valid session'),
        },
      },
    },
    async (request, reply) => {
      const userId = (request.user as { id: number }).id;
      const { month } = request.query;
      const result = progress(app.db, userId, month);
      request.log.info(
        { event: 'budget.progress', month, items: result.items.length, unbudgeted: result.unbudgeted.length },
        'budget progress read',
      );
      return reply.status(200).send(result);
    },
  );
}
