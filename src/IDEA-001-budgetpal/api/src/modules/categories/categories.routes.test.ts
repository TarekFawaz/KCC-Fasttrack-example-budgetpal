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

// ---- Story-002: PATCH and DELETE /api/categories/:id ----

const patch = (user: LoggedInUser | undefined, id: number | string, payload: unknown) =>
  app.inject({ method: 'PATCH', url: `/api/categories/${id}`, headers: user?.headers, payload: payload as object });
const del = (user: LoggedInUser | undefined, id: number | string) =>
  app.inject({ method: 'DELETE', url: `/api/categories/${id}`, headers: user?.headers });
const makeCategory = async (user: LoggedInUser, name: string, kind: 'expense' | 'income' = 'expense') =>
  (await post(user, { name, kind })).json() as { id: number; name: string; kind: string };

describe('update (Story-002 AC-1)', () => {
  it('T-015 PATCH name and kind returns 200 with the updated values and the list shows them', async () => {
    const food = await makeCategory(alice, 'Food');
    const renamed = await patch(alice, food.id, { name: '  Groceries ', kind: 'income' });
    expect(renamed.statusCode).toBe(200);
    expect(renamed.json()).toMatchObject({ id: food.id, name: 'Groceries', kind: 'income' });

    const onlyKind = await patch(alice, food.id, { kind: 'expense' });
    expect(onlyKind.json()).toMatchObject({ name: 'Groceries', kind: 'expense' });

    expect((await get(alice)).json()).toEqual([onlyKind.json()]);
  });
});

describe('OpenAPI for id routes (Story-002 AC-1)', () => {
  it('T-016 /docs/json has PATCH and DELETE on /api/categories/{id} with params and body schemas', async () => {
    const spec = (await app.inject('/docs/json')).json() as {
      paths: Record<
        string,
        Record<
          string,
          {
            parameters?: Array<{ name: string; in: string }>;
            requestBody?: { content: Record<string, { schema: unknown }> };
            responses: Record<string, unknown>;
          }
        >
      >;
    };
    const operations = spec.paths['/api/categories/{id}'];
    expect(Object.keys(operations ?? {}).sort()).toEqual(['delete', 'patch']);
    expect(operations?.patch?.parameters?.some((p) => p.name === 'id' && p.in === 'path')).toBe(true);
    expect(operations?.delete?.parameters?.some((p) => p.name === 'id' && p.in === 'path')).toBe(true);
    expect(operations?.patch?.requestBody?.content['application/json']?.schema).toBeDefined();
    expect(Object.keys(operations?.patch?.responses ?? {}).sort()).toEqual(['200', '400', '401', '404', '409']);
    expect(Object.keys(operations?.delete?.responses ?? {}).sort()).toEqual(['204', '400', '401', '404', '409']);
  });
});

describe('duplicate rename (Story-002 AC-2)', () => {
  it('T-017 renaming to another category name in a different case is 409 and changes nothing; its own name is 200', async () => {
    await makeCategory(alice, 'Rent');
    const food = await makeCategory(alice, 'Food');
    const before = (await get(alice)).json();

    const clash = await patch(alice, food.id, { name: 'rent' });
    expect(clash.statusCode).toBe(409);
    expect(clash.headers['content-type']).toContain('application/problem+json');
    expect((clash.json() as Problem).status).toBe(409);
    expect((await get(alice)).json()).toEqual(before);

    const same = await patch(alice, food.id, { name: 'Food' });
    expect(same.statusCode).toBe(200);
    const otherCase = await patch(alice, food.id, { name: 'FOOD' });
    expect(otherCase.statusCode).toBe(200);
    expect(otherCase.json()).toMatchObject({ name: 'FOOD' });
  });
});

describe('validation (Story-002 AC-3)', () => {
  it.each([
    ['an empty name', { name: '' }, 'name'],
    ['a name over 60 characters', { name: 'x'.repeat(61) }, 'name'],
    ['kind "other"', { kind: 'other' }, 'kind'],
    ['an extra field', { name: 'Food', color: 'red' }, '(body)'],
    ['an empty object', {}, '(body)'],
  ])('T-019 %s returns 400 problem+json with field errors', async (_label, payload, field) => {
    const food = await makeCategory(alice, 'Food');
    const before = (await get(alice)).json();
    const res = await patch(alice, food.id, payload);
    expect(res.statusCode).toBe(400);
    expect(res.headers['content-type']).toContain('application/problem+json');
    const problem = res.json() as Problem;
    expect(problem.errors?.some((e) => e.field === field && e.message.length > 0)).toBe(true);
    expect((await get(alice)).json()).toEqual(before);
  });

  it.each(['abc', '1.5', '0', '-3'])('T-019 id "%s" returns 400 problem+json for PATCH and DELETE', async (id) => {
    const patched = await patch(alice, id, { name: 'Food' });
    const deleted = await del(alice, id);
    for (const res of [patched, deleted]) {
      expect(res.statusCode).toBe(400);
      expect(res.headers['content-type']).toContain('application/problem+json');
      expect((res.json() as Problem).errors?.some((e) => e.field.includes('id'))).toBe(true);
    }
  });
});

describe('delete (Story-002 AC-4, AC-5)', () => {
  it('T-020 DELETE of an unused category returns 204 and it no longer lists', async () => {
    const food = await makeCategory(alice, 'Food');
    await makeCategory(alice, 'Rent');
    const res = await del(alice, food.id);
    expect(res.statusCode).toBe(204);
    expect(res.body).toBe('');
    expect(((await get(alice)).json() as Array<{ name: string }>).map((c) => c.name)).toEqual(['Rent']);
    expect((await del(alice, food.id)).statusCode).toBe(404);
  });

  it('T-021 DELETE of a category referenced by a RESTRICT row returns 409 "in use" and the category remains', async () => {
    // SPEC-005 and SPEC-007 declare the real referencing tables; a temporary one proves the rule here.
    db.exec(
      'CREATE TABLE temp_refs (id INTEGER PRIMARY KEY, category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT)',
    );
    const food = await makeCategory(alice, 'Food');
    db.prepare('INSERT INTO temp_refs (category_id) VALUES (?)').run(food.id);

    const res = await del(alice, food.id);
    expect(res.statusCode).toBe(409);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect((res.json() as Problem).detail).toMatch(/in use/i);
    expect(((await get(alice)).json() as Array<{ id: number }>).map((c) => c.id)).toEqual([food.id]);

    db.prepare('DELETE FROM temp_refs').run();
    expect((await del(alice, food.id)).statusCode).toBe(204);
  });
});

describe('isolation and authentication (Story-002 AC-6)', () => {
  it('T-022 user B PATCH and DELETE on A id return 404 and A category is unchanged; no session is 401', async () => {
    const food = await makeCategory(alice, 'Food');
    const before = (await get(alice)).json();

    const patched = await patch(bob, food.id, { name: 'Stolen', kind: 'income' });
    expect(patched.statusCode).toBe(404);
    expect(patched.headers['content-type']).toContain('application/problem+json');
    const deleted = await del(bob, food.id);
    expect(deleted.statusCode).toBe(404);
    expect(deleted.headers['content-type']).toContain('application/problem+json');
    expect((await get(alice)).json()).toEqual(before);
    expect((await get(bob)).json()).toEqual([]);

    expect((await patch(undefined, food.id, { name: 'Food' })).statusCode).toBe(401);
    const noSession = await del(undefined, food.id);
    expect(noSession.statusCode).toBe(401);
    expect(noSession.headers['content-type']).toContain('application/problem+json');
    expect(rowCount()).toBe(1);
  });
});
