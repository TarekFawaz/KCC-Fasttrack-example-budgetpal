import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { sendProblem, type Problem } from '../../kernel/errors.js';
import { requireUser } from '../../kernel/require-user.js';
import { category, createCategory } from './categories.schema.js';
import * as service from './categories.service.js';

export const CATEGORIES_PATH = '/api/categories';

/** RFC 9457 body, documented under the media type it is returned with. */
const ProblemResponse = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string(),
  instance: z.string().optional(),
  errors: z.array(z.object({ field: z.string(), message: z.string() })).optional(),
}) satisfies z.ZodType<Problem>;

const problemContent = (description: string) => ({
  description,
  content: { 'application/problem+json': { schema: ProblemResponse } },
});

/** `POST` and `GET` `/api/categories`; both behind `requireUser` (GR-002). */
export function registerCategoryRoutes(app: FastifyInstance): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.post(
    CATEGORIES_PATH,
    {
      preHandler: requireUser,
      schema: {
        summary: 'Create a category',
        tags: ['categories'],
        body: createCategory,
        response: {
          201: category,
          400: problemContent('The name or kind is invalid'),
          401: problemContent('There is no valid session'),
          409: problemContent('The user already has a category with this name'),
        },
      },
    },
    async (request, reply) => {
      const userId = request.user?.id;
      if (userId === undefined) throw new Error('requireUser did not set request.user');
      const outcome = service.create(app.db, userId, request.body, CATEGORIES_PATH);
      if (!outcome.ok) return sendProblem(reply, outcome.problem);
      return reply.status(201).send(outcome.value);
    },
  );

  typed.get(
    CATEGORIES_PATH,
    {
      preHandler: requireUser,
      schema: {
        summary: "List the signed-in user's categories",
        tags: ['categories'],
        response: {
          200: z.array(category),
          401: problemContent('There is no valid session'),
        },
      },
    },
    async (request, reply) => {
      const userId = request.user?.id;
      if (userId === undefined) throw new Error('requireUser did not set request.user');
      return reply.status(200).send(service.list(app.db, userId));
    },
  );
}
