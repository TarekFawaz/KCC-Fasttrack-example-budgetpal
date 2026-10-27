import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { STATUS_CODES } from 'node:http';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';

export const PROBLEM_JSON = 'application/problem+json; charset=utf-8';

export interface Problem {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
  errors?: Array<{ field: string; message: string }>;
}

export function sendProblem(reply: FastifyReply, problem: Problem): FastifyReply {
  return reply.status(problem.status).header('content-type', PROBLEM_JSON).send(JSON.stringify(problem));
}

function fieldOf(instancePath: string): string {
  return instancePath.replace(/^\//, '').replaceAll('/', '.') || '(body)';
}

/** RFC 9457 error bodies for unknown routes, validation failures and unexpected errors. */
export function registerErrorHandlers(app: FastifyInstance): void {
  app.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) =>
    sendProblem(reply, {
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      detail: 'No route matches the request.',
      instance: request.url.split('?')[0],
    }),
  );

  app.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    const instance = request.url.split('?')[0];

    if (hasZodFastifySchemaValidationErrors(error)) {
      return sendProblem(reply, {
        type: 'about:blank',
        title: 'Bad Request',
        status: 400,
        detail: 'The request did not pass validation.',
        instance,
        errors: error.validation.map((issue) => ({
          field: fieldOf(issue.instancePath),
          message: issue.message,
        })),
      });
    }

    const status = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500;
    if (status >= 500) {
      // The pino err serializer records the cause; the client gets a fixed message.
      request.log.error({ err: error }, 'request failed');
      return sendProblem(reply, {
        type: 'about:blank',
        title: STATUS_CODES[status] ?? 'Internal Server Error',
        status,
        detail: 'An unexpected error occurred.',
        instance,
      });
    }

    return sendProblem(reply, {
      type: 'about:blank',
      title: STATUS_CODES[status] ?? 'Bad Request',
      status,
      detail: error.message,
      instance,
    });
  });
}
