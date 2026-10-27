import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { sendProblem } from '../../kernel/errors.js';
import { requireUser } from '../../kernel/require-user.js';
import { accountSchema, createAccountSchema } from './accounts.schemas.js';
import { createAccount, listAccounts } from './accounts.service.js';

/** RFC 9457 body, documented under the media type it is returned with. */
const problemSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string(),
  instance: z.string().optional(),
  errors: z.array(z.object({ field: z.string(), message: z.string() })).optional(),
});

const problemContent = (description: string) => ({
  description,
  content: { 'application/problem+json': { schema: problemSchema } },
});

const pathOf = (url: string): string => url.split('?')[0] ?? url;

/**
 * `POST /api/accounts` and `GET /api/accounts`. The session guard runs in `onRequest`, before body
 * validation, so a request without a session is a 401 whatever its body holds. Every call is scoped
 * to `request.user.id` (GR-002).
 */
export function registerAccountRoutes(app: FastifyInstance): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.post(
    '/api/accounts',
    {
      onRequest: requireUser,
      schema: {
        summary: 'Create an account',
        tags: ['accounts'],
        body: createAccountSchema,
        response: {
          201: accountSchema,
          400: problemContent('The account fields are invalid'),
          401: problemContent('There is no valid session'),
          409: problemContent('The user already has an account with this name'),
        },
      },
    },
    async (request, reply) => {
      const userId = (request.user as { id: number }).id;
      const result = createAccount(app.db, userId, request.body, pathOf(request.url));
      if (!result.ok) return sendProblem(reply, result.problem);
      return reply.status(201).send(result.value);
    },
  );

  typed.get(
    '/api/accounts',
    {
      onRequest: requireUser,
      schema: {
        summary: "List the user's accounts, ordered by name",
        tags: ['accounts'],
        response: {
          200: z.array(accountSchema),
          401: problemContent('There is no valid session'),
        },
      },
    },
    async (request) => listAccounts(app.db, (request.user as { id: number }).id),
  );
}
