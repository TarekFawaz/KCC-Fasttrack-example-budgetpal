import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { sendProblem } from '../../kernel/errors.js';
import { checkDatabase } from './health.repository.js';

const HealthResponse = z.object({
  status: z.literal('ok'),
  db: z.literal('ok'),
});

/** Public liveness check (deliberately unauthenticated): the api is up and the database answers. */
const health: FastifyPluginAsync = async (app) => {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/health',
    {
      schema: {
        summary: 'API and database health',
        tags: ['health'],
        response: { 200: HealthResponse },
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
