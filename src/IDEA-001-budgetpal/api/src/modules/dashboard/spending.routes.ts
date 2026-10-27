import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { loadConfig } from '../../kernel/config.js';
import { requireUser } from '../../kernel/require-user.js';
import { problemContent, spendingQuerySchema, spendingResponseSchema } from './schemas.js';

export const SPENDING_PATH = '/api/dashboard/spending';

/**
 * Scaffold route for `GET /api/dashboard/spending`: guarded, validated and documented. Story-001
 * replaces the placeholder handler with the SQL aggregate (service + repository).
 */
export function registerSpendingRoutes(app: FastifyInstance): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  typed.get(
    SPENDING_PATH,
    {
      onRequest: requireUser,
      schema: {
        summary: 'Expense totals per category for one month',
        tags: ['dashboard'],
        querystring: spendingQuerySchema,
        response: {
          200: spendingResponseSchema,
          400: problemContent('The month is missing or invalid, or the query has an unknown key'),
          401: problemContent('There is no valid session'),
        },
      },
    },
    async (request) => ({
      month: request.query.month,
      currency: loadConfig().currency,
      totalMinor: 0,
      categories: [],
    }),
  );
}
