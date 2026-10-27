import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { loadConfig } from '../../kernel/config.js';
import { requireUser } from '../../kernel/require-user.js';
import { problemContent, spendingQuerySchema, spendingResponseSchema } from './schemas.js';
import * as service from './spending.service.js';

export const SPENDING_PATH = '/api/dashboard/spending';

/**
 * `GET /api/dashboard/spending`: the signed-in user's expense totals per category for one month.
 * The session guard runs in `onRequest`, so a request without a session is a 401 whatever its query
 * holds (GR-002). The handler logs the event only: never an amount or a category name (GR-008).
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
    async (request) => {
      const userId = (request.user as { id: number }).id;
      const summary = service.spendingForMonth(app.db, userId, request.query.month, loadConfig().currency);
      request.log.info({ event: 'dashboard.spending' }, 'spending summary served');
      return summary;
    },
  );
}
