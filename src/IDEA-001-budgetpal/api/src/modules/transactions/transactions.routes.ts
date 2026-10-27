import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { sendProblem } from '../../kernel/errors.js';
import { requireUser } from '../../kernel/require-user.js';
import {
  createTransactionSchema,
  listTransactionsQuerySchema,
  patchTransactionSchema,
  transactionIdParamsSchema,
  transactionSchema,
} from './transactions.schemas.js';
import * as service from './transactions.service.js';

export const TRANSACTIONS_PATH = '/api/transactions';

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

const transactionPageSchema = z.object({
  items: z.array(transactionSchema),
  total: z.number().int(),
  limit: z.number().int(),
  offset: z.number().int(),
});

const pathOf =(url: string): string => url.split('?')[0] ?? url;

/**
 * `POST /api/transactions`, `PATCH` and `DELETE /api/transactions/:id`. The session guard runs in
 * `onRequest`, before body validation, so a request without a session is a 401 whatever its body
 * holds (GR-002). The handlers log only the event and the id: a transaction's description and
 * amount never reach the log (GR-008).
 */
export function registerTransactionRoutes(app: FastifyInstance): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    TRANSACTIONS_PATH,
    {
      onRequest: requireUser,
      schema: {
        summary: 'List transactions, newest first',
        tags: ['transactions'],
        querystring: listTransactionsQuerySchema,
        response: {
          200: transactionPageSchema,
          400: problemContent('A query value is invalid, or the query has an unknown key'),
          401: problemContent('There is no valid session'),
        },
      },
    },
    async (request) => {
      const userId = (request.user as { id: number }).id;
      return service.list(app.db, userId, request.query);
    },
  );

  typed.post(
    TRANSACTIONS_PATH,
    {
      onRequest: requireUser,
      schema: {
        summary: 'Add a transaction',
        tags: ['transactions'],
        body: createTransactionSchema,
        response: {
          201: transactionSchema,
          400: problemContent('The fields are invalid, or the account or category is not one of the user\'s'),
          401: problemContent('There is no valid session'),
        },
      },
    },
    async (request, reply) => {
      const userId = (request.user as { id: number }).id;
      const outcome = service.create(app.db, userId, request.body, pathOf(request.url));
      if (!outcome.ok) return sendProblem(reply, outcome.problem);
      request.log.info({ event: 'transaction.created', transactionId: outcome.value.id }, 'transaction created');
      return reply.status(201).send(outcome.value);
    },
  );

  typed.patch(
    `${TRANSACTIONS_PATH}/:id`,
    {
      onRequest: requireUser,
      schema: {
        summary: 'Change fields of a transaction',
        tags: ['transactions'],
        params: transactionIdParamsSchema,
        body: patchTransactionSchema,
        response: {
          200: transactionSchema,
          400: problemContent('The fields are invalid, or the account or category is not one of the user\'s'),
          401: problemContent('There is no valid session'),
          404: problemContent('The user has no transaction with this id'),
        },
      },
    },
    async (request, reply) => {
      const userId = (request.user as { id: number }).id;
      const outcome = service.update(app.db, userId, request.params.id, request.body, pathOf(request.url));
      if (!outcome.ok) return sendProblem(reply, outcome.problem);
      request.log.info({ event: 'transaction.updated', transactionId: outcome.value.id }, 'transaction updated');
      return outcome.value;
    },
  );

  typed.delete(
    `${TRANSACTIONS_PATH}/:id`,
    {
      onRequest: requireUser,
      schema: {
        summary: 'Delete a transaction',
        tags: ['transactions'],
        params: transactionIdParamsSchema,
        response: {
          204: z.null().describe('The transaction was deleted'),
          400: problemContent('The id is not a positive integer'),
          401: problemContent('There is no valid session'),
          404: problemContent('The user has no transaction with this id'),
        },
      },
    },
    async (request, reply) => {
      const userId = (request.user as { id: number }).id;
      const outcome = service.remove(app.db, userId, request.params.id, pathOf(request.url));
      if (!outcome.ok) return sendProblem(reply, outcome.problem);
      request.log.info({ event: 'transaction.deleted', transactionId: request.params.id }, 'transaction deleted');
      return reply.status(204).send(null);
    },
  );
}
