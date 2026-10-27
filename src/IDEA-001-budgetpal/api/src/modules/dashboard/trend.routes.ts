import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { loadConfig } from '../../kernel/config.js';
import { requireUser } from '../../kernel/require-user.js';
import { problemContent, trendQuerySchema, trendResponseSchema } from './schemas.js';
import * as service from './trend.service.js';

export const TREND_PATH = '/api/dashboard/trend';

/**
 * `GET /api/dashboard/trend`: the signed-in user's monthly expense totals for the last N months.
 * The session guard runs in `onRequest` (GR-002). The handler logs the event only, never an
 * amount (GR-008).
 */
export function registerTrendRoutes(app: FastifyInstance): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  typed.get(
    TREND_PATH,
    {
      onRequest: requireUser,
      schema: {
        summary: 'Monthly expense totals for the last N months',
        tags: ['dashboard'],
        querystring: trendQuerySchema,
        response: {
          200: trendResponseSchema,
          400: problemContent('A query value is invalid, or the query has an unknown key'),
          401: problemContent('There is no valid session'),
        },
      },
    },
    async (request) => {
      const userId = (request.user as { id: number }).id;
      const { months, end } = request.query;
      const trend = service.trendForUser(app.db, userId, loadConfig().currency, { months, ...(end ? { end } : {}) });
      request.log.info({ event: 'dashboard.trend' }, 'trend served');
      return trend;
    },
  );
}
