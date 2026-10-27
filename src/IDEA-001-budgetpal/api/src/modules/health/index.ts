import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { sendProblem, type Problem } from '../../kernel/errors.js';
import { checkDatabase } from './health.repository.js';

const HealthResponse = z.object({
  status: z.literal('ok'),
  db: z.literal('ok'),
});

/** RFC 9457 body of `sendProblem`; documents the 503 under the media type it is returned with. */
const ProblemResponse = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string(),
  instance: z.string().optional(),
  errors: z.array(z.object({ field: z.string(), message: z.string() })).optional(),
}) satisfies z.ZodType<Problem>;

/** Public liveness check (deliberately unauthenticated): the api is up and the database answers. */
const health: FastifyPluginAsync = async (app) => {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/health',
    {
      schema: {
        summary: 'API and database health',
        tags: ['health'],
        response: {
          200: HealthResponse,
          503: {
            description: 'The database is not available',
            content: { 'application/problem+json': { schema: ProblemResponse } },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        checkDatabase(app.db);
      } catch (error) {
        // The driver message stays in the log; the client gets a fixed body (SR-017).
        request.log.error({ err: error }, 'health check: database query failed');
        return sendProblem(reply, {
          type: 'about:blank',
          title: 'Service Unavailable',
          status: 503,
          detail: 'The database is not available.',
          instance: '/health',
        });
      }
      return { status: 'ok' as const, db: 'ok' as const };
    },
  );
};

export default health;
