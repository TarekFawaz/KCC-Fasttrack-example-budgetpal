import { STATUS_CODES } from 'node:http';
import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';
import type { ZodIssue } from 'zod';
import { sendProblem, type Problem } from './errors.js';

export type FieldError = { field: string; message: string };

const GENERIC_500 = 'An unexpected error occurred.';

/** Dotted field name for a zod issue path (`['items', 0, 'name']` -> `items.0.name`); `(body)` when empty. */
export function fieldOfPath(path: ReadonlyArray<string | number>): string {
  return path.length === 0 ? '(body)' : path.join('.');
}

/** RFC 9457 body (same shape SPEC-001 `errors.ts` sends) for a status, with optional field errors. */
export function buildProblem(
  status: number,
  detail: string,
  options: { instance?: string; errors?: FieldError[] } = {},
): Problem {
  return {
    type: 'about:blank',
    title: STATUS_CODES[status] ?? 'Error',
    status,
    detail,
    ...(options.instance === undefined ? {} : { instance: options.instance }),
    ...(options.errors === undefined ? {} : { errors: options.errors }),
  };
}

/** 400 problem for zod issues. `source` prefixes the field for params and query so the client can tell them apart. */
export function validationProblem(
  issues: ReadonlyArray<Pick<ZodIssue, 'path' | 'message'>>,
  instance: string,
  source: 'body' | 'params' | 'query' = 'body',
): Problem {
  return buildProblem(400, 'The request did not pass validation.', {
    instance,
    errors: issues.map((issue) => {
      const field = fieldOfPath(issue.path);
      return { field: source === 'body' || issue.path.length === 0 ? field : `${source}.${field}`, message: issue.message };
    }),
  });
}

const pathOf = (request: FastifyRequest): string => request.url.split('?')[0] ?? request.url;

/**
 * Error handler for the scope it is registered in: schema validation failures become a 400 with
 * field-level errors, client errors keep their status, and everything else is a generic 500 that
 * carries neither the internal message nor a stack (the cause goes to the log through pino's `err`).
 */
export function registerProblemHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    const instance = pathOf(request);

    if (hasZodFastifySchemaValidationErrors(error)) {
      return sendProblem(
        reply,
        buildProblem(400, 'The request did not pass validation.', {
          instance,
          errors: error.validation.map((issue) => ({
            field: issue.instancePath.replace(/^\//, '').replaceAll('/', '.') || '(body)',
            message: issue.message,
          })),
        }),
      );
    }

    const status = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500;
    if (status >= 500) {
      request.log.error({ err: error }, 'request failed');
      return sendProblem(reply, buildProblem(status, GENERIC_500, { instance }));
    }
    return sendProblem(reply, buildProblem(status, error.message, { instance }));
  });
}
