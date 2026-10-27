import type { FastifyReply, FastifyRequest, preHandlerAsyncHookHandler } from 'fastify';
import type { ZodIssue, ZodTypeAny, z } from 'zod';
import { sendProblem } from './errors.js';
import { validationProblem } from './problem.js';

export interface ValidationSchemas<B extends ZodTypeAny, P extends ZodTypeAny, Q extends ZodTypeAny> {
  body?: B;
  params?: P;
  query?: Q;
}

export interface Validated<B, P, Q> {
  body: B;
  params: P;
  query: Q;
}

type Output<S extends ZodTypeAny | undefined> = S extends ZodTypeAny ? z.output<S> : undefined;

/** The preHandler, plus `read(request)` which returns the parsed data typed from the schemas. */
export interface Validator<B extends ZodTypeAny, P extends ZodTypeAny, Q extends ZodTypeAny>
  extends preHandlerAsyncHookHandler {
  read(request: FastifyRequest): Validated<Output<B>, Output<P>, Output<Q>>;
}

const store = new WeakMap<FastifyRequest, Validated<unknown, unknown, unknown>>();

/**
 * Shared request validation (D-03): parses body, params and query with zod `safeParse`. Any failure is
 * a 400 `application/problem+json` with `errors[{field, message}]` and the handler never runs. Use
 * `.strict()` on object schemas so unknown fields are rejected. On success the parsed (coerced,
 * stripped) values are available from `validator.read(request)`.
 *
 *   const v = validate({ body: Credentials });
 *   app.post('/x', { preHandler: v }, async (request) => v.read(request).body);
 */
export function validate<
  B extends ZodTypeAny = ZodTypeAny,
  P extends ZodTypeAny = ZodTypeAny,
  Q extends ZodTypeAny = ZodTypeAny,
>(schemas: ValidationSchemas<B, P, Q>): Validator<B, P, Q> {
  const preHandler = async function (this: unknown, request: FastifyRequest, reply: FastifyReply) {
    const instance = request.url.split('?')[0] ?? request.url;
    const failures: Array<{ source: 'body' | 'params' | 'query'; issues: ZodIssue[] }> = [];
    const parsed: Validated<unknown, unknown, unknown> = { body: undefined, params: undefined, query: undefined };

    for (const source of ['body', 'params', 'query'] as const) {
      const schema = schemas[source];
      if (!schema) continue;
      const result = schema.safeParse(request[source]);
      if (result.success) parsed[source] = result.data;
      else failures.push({ source, issues: result.error.issues });
    }

    if (failures.length > 0) {
      const problems = failures.map((failure) => validationProblem(failure.issues, instance, failure.source));
      const [first] = problems;
      if (!first) return reply;
      first.errors = problems.flatMap((problem) => problem.errors ?? []);
      return sendProblem(reply, first);
    }

    store.set(request, parsed);
    return undefined;
  } as preHandlerAsyncHookHandler;

  return Object.assign(preHandler, {
    read(request: FastifyRequest): Validated<Output<B>, Output<P>, Output<Q>> {
      const parsed = store.get(request);
      if (!parsed) throw new Error('validate(): read() called on a request that was not validated by this preHandler');
      return parsed as Validated<Output<B>, Output<P>, Output<Q>>;
    },
  });
}
