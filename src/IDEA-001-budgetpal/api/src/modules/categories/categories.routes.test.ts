import { fileURLToPath } from 'node:url';
import type Database from 'better-sqlite3';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';
import { loadConfig } from '../../kernel/config.js';
import { openDb } from '../../kernel/db/index.js';
import { runMigrations } from '../../kernel/db/migrate.js';
import { createLoggedInUser, type LoggedInUser } from '../../../test/helpers/auth.js';

const migrationsDir = fileURLToPath(new URL('../../../migrations', import.meta.url));

interface Problem {
  status: number;
  detail: string;
  errors?: Array<{ field: string; message: string }>;
}

let db: Database.Database;
let app: FastifyInstance;
let alice: LoggedInUser;
let bob: LoggedInUser;

const post = (user: LoggedInUser | undefined, payload: unknown) =>
  app.inject({ method: 'POST', url: '/api/categories', headers: user?.headers, payload: payload as object });
const get = (user?: LoggedInUser) => app.inject({ method: 'GET', url: '/api/categories', headers: user?.headers });
const rowCount = (): number => (db.prepare('SELECT COUNT(*) AS n FROM categories').get() as { n: number }).n;

beforeEach(async () => {
  db = openDb(':memory:');
  runMigrations(db, migrationsDir);
  // The default modules directory: the categories module is found by the loader, not registered by hand.
  app = await buildApp(loadConfig({ LOG_LEVEL: 'silent' }), { db });
  await app.ready();
  alice = createLoggedInUser(app, 'alice@example.test');
  bob = createLoggedInUser(app, 'bob@example.test');
});
afterEach(async () => {
  await app.close();
  if (db.open) db.close();
});

describe('create and list (Story-001 AC-1)', () => {
  it('T-007 POST returns 201 with id, name and kind and GET lists it', async () => {
    const created = await post(alice, { name: '  Food ', kind: 'expense' });
    expect(created.statusCode).toBe(201);
    const body = created.json() as { id: number; name: string; kind: string; createdAt: string };
    expect(body).toMatchObject({ name: 'Food', kind: 'expense' });
    expect(Number.isInteger(body.id)).toBe(true);

    const listed = await get(alice);
    expect(listed.statusCode).toBe(200);
    expect(listed.json()).toEqual([body]);
  });
});

describe('duplicate names (Story-001 AC-2)', () => {
  it('T-009 "food" after "Food" is a 409 problem+json and the list is unchanged; another user may use "Food"', async () => {
    expect((await post(alice, { name: 'Food', kind: 'expense' })).statusCode).toBe(201);
    const before = (await get(alice)).json();

    const duplicate = await post(alice, { name: 'food', kind: 'income' });
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.headers['content-type']).toContain('application/problem+json');
    expect((duplicate.json() as Problem).status).toBe(409);
    expect((await get(alice)).json()).toEqual(before);

    const other = await post(bob, { name: 'Food', kind: 'expense' });
    expect(other.statusCode).toBe(201);
  });
});

describe('validation (Story-001 AC-3)', () => {
  it.each([
    ['an empty name', { name: '', kind: 'expense' }, 'name'],
    ['a whitespace-only name', { name: '   ', kind: 'expense' }, 'name'],
    ['a name over 60 characters', { name: 'x'.repeat(61), kind: 'expense' }, 'name'],
    ['kind "other"', { name: 'Food', kind: 'other' }, 'kind'],
    ['a missing kind', { name: 'Food' }, 'kind'],
    ['an extra field', { name: 'Food', kind: 'expense', color: 'red' }, '(body)'],
  ])('T-011 %s returns 400 problem+json with field errors and writes nothing', async (_label, payload, field) => {
    const res = await post(alice, payload);
    expect(res.statusCode).toBe(400);
    expect(res.headers['content-type']).toContain('application/problem+json');
    const problem = res.json() as Problem;
    expect(problem.status).toBe(400);
    expect(problem.errors?.some((e) => e.field === field && e.message.length > 0)).toBe(true);
    expect(rowCount()).toBe(0);
  });

  it('T-011 a 60-character name is accepted', async () => {
    expect((await post(alice, { name: 'x'.repeat(60), kind: 'income' })).statusCode).toBe(201);
  });
});

describe('authentication and isolation (Story-001 AC-4)', () => {
  it('T-012 POST and GET without a session return 401 and write nothing', async () => {
    const created = await post(undefined, { name: 'Food', kind: 'expense' });
    expect(created.statusCode).toBe(401);
    expect(created.headers['content-type']).toContain('application/problem+json');
    const listed = await get();
    expect(listed.statusCode).toBe(401);
    expect(listed.headers['content-type']).toContain('application/problem+json');
    expect((await get({ ...alice, headers: { cookie: 'budgetpal_session=not-a-session' } })).statusCode).toBe(401);
    expect(rowCount()).toBe(0);
  });

  it('T-013 with two users, GET returns only the caller\'s categories', async () => {
    await post(alice, { name: 'Food', kind: 'expense' });
    await post(alice, { name: 'Salary', kind: 'income' });
    await post(bob, { name: 'Rent', kind: 'expense' });

    const aliceList = (await get(alice)).json() as Array<{ name: string }>;
    const bobList = (await get(bob)).json() as Array<{ name: string }>;
    expect(aliceList.map((c) => c.name)).toEqual(['Food', 'Salary']);
    expect(bobList.map((c) => c.name)).toEqual(['Rent']);
  });
});

describe('registration and OpenAPI (Story-001 AC-5)', () => {
  it('T-014 the router is auto-registered under /api/categories and /docs/json has both paths with body and response schemas', async () => {
    const spec = (await app.inject('/docs/json')).json() as {
      paths: Record<
        string,
        Record<
          string,
          { requestBody?: { content: Record<string, { schema: unknown }> }; responses: Record<string, unknown> }
        >
      >;
    };
    const operations = spec.paths['/api/categories'];
    expect(Object.keys(operations ?? {}).sort()).toEqual(['get', 'post']);

    const postOperation = operations?.post;
    expect(postOperation?.requestBody?.content['application/json']?.schema).toBeDefined();
    expect(Object.keys(postOperation?.responses ?? {}).sort()).toEqual(['201', '400', '401', '409']);
    expect(Object.keys(operations?.get?.responses ?? {}).sort()).toEqual(['200', '401']);
  });
});
