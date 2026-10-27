import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { loadConfig } from '../../kernel/config.js';
import { requireUser } from '../../kernel/require-user.js';
import { problemContent, trendQuerySchema, trendResponseSchema } from './schemas.js';

export const TREND_PATH = '/api/dashboard/trend';

/**
 * Scaffold route for `GET /api/dashboard/trend`: guarded, validated and documented. Story-002
 * replaces the placeholder handler with the monthly aggregate (service + repository).
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
    async () => ({ currency: loadConfig().currency, points: [] }),
  );
}
