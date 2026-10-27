import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { sendProblem } from '../../kernel/errors.js';
import { requireUser } from '../../kernel/require-user.js';
import { budgetParamsSchema, budgetSchema, problemContent, setBudgetBodySchema } from './budgets.schema.js';
import * as service from './budgets.service.js';

/**
 * The web client calls `/api/budgets/...`; the proxy strips `/api` (SPEC-001), so the API
 * registers the unprefixed path.
 */
export const BUDGET_PATH = '/budgets/:month/:categoryId';

const pathOf = (url: string): string => url.split('?')[0] ?? url;

/**
 * `PUT` and `DELETE /budgets/:month/:categoryId`. The session guard runs in `onRequest`, before
 * validation, so a request without a session is a 401 whatever it holds (GR-002). The handlers
 * log the event, category and month only: an amount never reaches the log (GR-008).
 */
export function registerBudgetRoutes(app: FastifyInstance): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.put(
    BUDGET_PATH,
    {
      onRequest: requireUser,
      schema: {
        summary: 'Set or replace the budget of an expense category for a month',
        tags: ['budgets'],
        params: budgetParamsSchema,
        body: setBudgetBodySchema,
        response: {
          200: budgetSchema.describe('An existing budget was replaced'),
          201: budgetSchema.describe('A new budget was created'),
          400: problemContent('The month, the amount or the body is invalid, or the category is an income category'),
          401: problemContent('There is no valid session'),
          404: problemContent('The user has no category with this id'),
        },
      },
    },
    async (request, reply) => {
      const userId = (request.user as { id: number }).id;
      const { month, categoryId } = request.params;
      const outcome = service.set(app.db, userId, month, categoryId, request.body.amountMinor, pathOf(request.url));
      if (!outcome.ok) return sendProblem(reply, outcome.problem);
      request.log.info({ event: 'budget.set', categoryId, month, created: outcome.value.created }, 'budget set');
      return reply.status(outcome.value.created ? 201 : 200).send(outcome.value.budget);
    },
  );

  typed.delete(
    BUDGET_PATH,
    {
      onRequest: requireUser,
      schema: {
        summary: 'Remove the budget of a category for a month',
        tags: ['budgets'],
        params: budgetParamsSchema,
        response: {
          204: z.null().describe('The budget was removed'),
          400: problemContent('The month or the category id is invalid'),
          401: problemContent('There is no valid session'),
          404: problemContent('The user has no budget for this category and month'),
        },
      },
    },
    async (request, reply) => {
      const userId = (request.user as { id: number }).id;
      const { month, categoryId } = request.params;
      const outcome = service.remove(app.db, userId, month, categoryId, pathOf(request.url));
      if (!outcome.ok) return sendProblem(reply, outcome.problem);
      request.log.info({ event: 'budget.removed', categoryId, month }, 'budget removed');
      return reply.status(204).send(null);
    },
  );
}
