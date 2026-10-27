import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { registerProblemHandler } from './problem.js';
import { validate } from './validate.js';

const Body = z.object({ email: z.string().email(), name: z.string().min(1) }).strict();
const Params = z.object({ id: z.string().regex(/^\d+$/, 'must be digits') });
const Query = z.object({ limit: z.coerce.number().int().min(1).max(100) });

const handler = vi.fn();
let app: FastifyInstance;

interface ProblemBody {
  status: number;
  title: string;
  errors?: Array<{ field: string; message: string }>;
}

beforeEach(async () => {
  handler.mockReset();
  app = Fastify({ logger: false });
  registerProblemHandler(app);

  const bodyOnly = validate({ body: Body });
  app.post('/body', { preHandler: bodyOnly }, async (request) => {
    handler();
    return bodyOnly.read(request).body;
  });

  const paramsQuery = validate({ params: Params, query: Query });
  app.get('/items/:id', { preHandler: paramsQuery }, async (request) => {
    handler();
    const { params, query } = paramsQuery.read(request);
    return { id: params.id, limit: query.limit, limitType: typeof query.limit };
  });

  app.get('/boom', async () => {
    throw new Error('secret detail: db password is hunter2');
  });
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

describe('validate(): body', () => {
  it('T-001 rejects a bad, a missing and an unknown body field with a 400 problem and never calls the handler', async () => {
    const cases: Array<{ payload: unknown; field: string }> = [
      { payload: { email: 'not-an-email', name: 'Ann' }, field: 'email' },
      { payload: { email: 'a@b.co' }, field: 'name' },
      { payload: { email: 'a@b.co', name: 'Ann', admin: true }, field: '(body)' },
    ];
    for (const { payload, field } of cases) {
      const res = await app.inject({ method: 'POST', url: '/body', payload: payload as object });
      expect(res.statusCode).toBe(400);
      expect(res.headers['content-type']).toContain('application/problem+json');
      const body = res.json<ProblemBody>();
      expect(body).toMatchObject({ status: 400, title: 'Bad Request' });
      expect(Array.isArray(body.errors)).toBe(true);
      for (const entry of body.errors ?? []) {
        expect(typeof entry.field).toBe('string');
        expect(typeof entry.message).toBe('string');
      }
      expect(body.errors?.map((e) => e.field)).toContain(field);
    }
    expect(handler).not.toHaveBeenCalled();
  });

  it('T-001 treats a missing body as a validation failure', async () => {
    const res = await app.inject({ method: 'POST', url: '/body' });
    expect(res.statusCode).toBe(400);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('validate(): params and query', () => {
  it('T-002 rejects invalid params and invalid query with the same 400 shape', async () => {
    const badParams = await app.inject('/items/abc?limit=5');
    const badQuery = await app.inject('/items/12?limit=zero');
    for (const res of [badParams, badQuery]) {
      expect(res.statusCode).toBe(400);
      expect(res.headers['content-type']).toContain('application/problem+json');
      const body = res.json<ProblemBody>();
      expect(body).toMatchObject({ status: 400, title: 'Bad Request' });
      expect(body.errors?.length).toBeGreaterThan(0);
    }
    expect(badParams.json<ProblemBody>().errors?.[0]?.field).toBe('params.id');
    expect(badQuery.json<ProblemBody>().errors?.[0]?.field).toBe('query.limit');
    expect(handler).not.toHaveBeenCalled();
  });

  it('T-002 reports params and query failures together', async () => {
    const res = await app.inject('/items/abc?limit=zero');
    expect(res.statusCode).toBe(400);
    expect(res.json<ProblemBody>().errors?.map((e) => e.field)).toEqual(['params.id', 'query.limit']);
  });
});

describe('validate(): unexpected errors', () => {
  it('T-003 turns a thrown Error into a generic 500 problem without its message or a stack', async () => {
    const res = await app.inject('/boom');
    expect(res.statusCode).toBe(500);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.json<ProblemBody>()).toMatchObject({ status: 500, title: 'Internal Server Error' });
    expect(res.body).not.toContain('secret detail');
    expect(res.body).not.toContain('hunter2');
    expect(res.body).not.toMatch(/stack|\bat .*\(|\.ts:\d+/i);
  });
});

describe('validate(): valid input', () => {
  it('T-004 hands the handler parsed, typed data (query coerced to a number)', async () => {
    const res = await app.inject('/items/42?limit=7');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ id: '42', limit: 7, limitType: 'number' });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('T-004 returns the parsed body', async () => {
    const res = await app.inject({ method: 'POST', url: '/body', payload: { email: 'a@b.co', name: 'Ann' } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ email: 'a@b.co', name: 'Ann' });
  });
});
