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
const MONTH = '2026-03';

interface Problem {
  status: number;
  errors?: Array<{ field: string; message: string }>;
}

let db: Database.Database;
let app: FastifyInstance;
let alice: LoggedInUser;
let bob: LoggedInUser;
let aliceExpense: number;
let aliceIncome: number;
let bobExpense: number;

const addCategory = (userId: number, name: string, kind: 'expense' | 'income'): number =>
  Number(
    db
      .prepare('INSERT INTO categories (user_id, name, kind, created_at) VALUES (?, ?, ?, ?)')
      .run(userId, name, kind, '2026-01-01T00:00:00.000Z').lastInsertRowid,
  );
const rows = (): Array<{ user_id: number; category_id: number; month: string; amount_minor: number }> =>
  db.prepare('SELECT user_id, category_id, month, amount_minor FROM budgets ORDER BY id').all() as never;

const url = (month: string, categoryId: number | string): string => `/budgets/${month}/${categoryId}`;
const put = (user: LoggedInUser | undefined, path: string, payload: unknown) =>
  app.inject({ method: 'PUT', url: path, payload: payload as object, ...(user ? { headers: user.headers } : {}) });
const del = (user: LoggedInUser | undefined, path: string) =>
  app.inject({ method: 'DELETE', url: path, ...(user ? { headers: user.headers } : {}) });

beforeEach(async () => {
  db = openDb(':memory:');
  runMigrations(db, migrationsDir);
  app = await buildApp(loadConfig({ LOG_LEVEL: 'silent' }), { db });
  await app.ready();
  alice = createLoggedInUser(app, 'alice@example.test');
  bob = createLoggedInUser(app, 'bob@example.test');
  aliceExpense = addCategory(alice.id, 'Groceries', 'expense');
  aliceIncome = addCategory(alice.id, 'Salary', 'income');
  bobExpense = addCategory(bob.id, 'Rent', 'expense');
});
afterEach(async () => {
  await app.close();
  if (db.open) db.close();
});

describe('budgets routes: set', () => {
  it('T-006 PUT creates (201) then replaces (200) and returns the budget', async () => {
    const first = await put(alice, url(MONTH, aliceExpense), { amountMinor: 50_000 });
    expect(first.statusCode).toBe(201);
    expect(first.json()).toMatchObject({ categoryId: aliceExpense, month: MONTH, amountMinor: 50_000 });
    expect(typeof first.json().id).toBe('number');

    const second = await put(alice, url(MONTH, aliceExpense), { amountMinor: 65_000 });
    expect(second.statusCode).toBe(200);
    expect(second.json()).toMatchObject({ id: first.json().id, amountMinor: 65_000 });
    expect(rows()).toEqual([{ user_id: alice.id, category_id: aliceExpense, month: MONTH, amount_minor: 65_000 }]);

    const otherMonth = await put(alice, url('2026-04', aliceExpense), { amountMinor: 1 });
    expect(otherMonth.statusCode).toBe(201);
    expect(rows()).toHaveLength(2);
  });

  it('T-007 an income category is 400, an unknown or another user\'s category is 404, nothing is written', async () => {
    const income = await put(alice, url(MONTH, aliceIncome), { amountMinor: 100 });
    expect(income.statusCode).toBe(400);
    expect(income.headers['content-type']).toContain('application/problem+json');
    expect((income.json() as Problem).errors?.[0]?.field).toBe('categoryId');

    expect((await put(alice, url(MONTH, 99_999), { amountMinor: 100 })).statusCode).toBe(404);
    const foreign = await put(alice, url(MONTH, bobExpense), { amountMinor: 100 });
    expect(foreign.statusCode).toBe(404);
    expect(foreign.headers['content-type']).toContain('application/problem+json');
    expect(rows()).toEqual([]);
  });

  it('T-009 an invalid month, amount, category id or unknown field is 400 problem+json with field errors', async () => {
    const cases: Array<[string, string, unknown, string]> = [
      ['bad month', url('2026-13', aliceExpense), { amountMinor: 100 }, 'month'],
      ['zero', url(MONTH, aliceExpense), { amountMinor: 0 }, 'amountMinor'],
      ['negative', url(MONTH, aliceExpense), { amountMinor: -5 }, 'amountMinor'],
      ['fractional', url(MONTH, aliceExpense), { amountMinor: 12.5 }, 'amountMinor'],
      ['string', url(MONTH, aliceExpense), { amountMinor: '100' }, 'amountMinor'],
      ['over max', url(MONTH, aliceExpense), { amountMinor: 1_000_000_000_000 }, 'amountMinor'],
      ['unknown field', url(MONTH, aliceExpense), { amountMinor: 100, extra: true }, ''],
      ['missing body field', url(MONTH, aliceExpense), {}, 'amountMinor'],
      ['bad category id', url(MONTH, 'abc'), { amountMinor: 100 }, 'categoryId'],
    ];
    for (const [label, path, body, field] of cases) {
      const res = await put(alice, path, body);
      expect(res.statusCode, label).toBe(400);
      expect(res.headers['content-type'], label).toContain('application/problem+json');
      const problem = res.json() as Problem;
      expect(problem.errors?.length, label).toBeGreaterThan(0);
      if (field) expect(problem.errors?.some((e) => e.field.endsWith(field)), label).toBe(true);
    }
    expect(rows()).toEqual([]);
  });
});

describe('budgets routes: remove', () => {
  it('T-010 DELETE returns 204 and the budget is gone; a second DELETE is 404', async () => {
    await put(alice, url(MONTH, aliceExpense), { amountMinor: 100 });
    const first = await del(alice, url(MONTH, aliceExpense));
    expect(first.statusCode).toBe(204);
    expect(first.body).toBe('');
    expect(rows()).toEqual([]);

    const second = await del(alice, url(MONTH, aliceExpense));
    expect(second.statusCode).toBe(404);
    expect(second.headers['content-type']).toContain('application/problem+json');
  });

  it('T-010 DELETE with an invalid month is 400', async () => {
    expect((await del(alice, url('2026-00', aliceExpense))).statusCode).toBe(400);
  });
});

describe('budgets routes: isolation and authentication', () => {
  it('T-011 user B cannot replace or delete user A\'s budget (404) and A\'s row is unchanged', async () => {
    await put(alice, url(MONTH, aliceExpense), { amountMinor: 100 });
    const before = rows();

    expect((await put(bob, url(MONTH, aliceExpense), { amountMinor: 999 })).statusCode).toBe(404);
    expect((await del(bob, url(MONTH, aliceExpense))).statusCode).toBe(404);
    expect(rows()).toEqual(before);

    // B's own budget for the same month is separate from A's.
    expect((await put(bob, url(MONTH, bobExpense), { amountMinor: 7 })).statusCode).toBe(201);
    expect((await del(alice, url(MONTH, bobExpense))).statusCode).toBe(404);
    expect(rows()).toHaveLength(2);
  });

  it('T-012 PUT and DELETE without a session cookie return 401, whatever the body holds', async () => {
    const withBody = await put(undefined, url(MONTH, aliceExpense), { amountMinor: 100 });
    expect(withBody.statusCode).toBe(401);
    expect(withBody.headers['content-type']).toContain('application/problem+json');
    expect((await put(undefined, url(MONTH, aliceExpense), { amountMinor: -1 })).statusCode).toBe(401);
    expect((await del(undefined, url(MONTH, aliceExpense))).statusCode).toBe(401);
    expect((await put({ ...alice, headers: { cookie: 'sid=forged' } }, url(MONTH, aliceExpense), { amountMinor: 1 })).statusCode).toBe(
      401,
    );
    expect(rows()).toEqual([]);
  });
});

describe('budgets routes: OpenAPI', () => {
  it('T-013 /docs/json lists PUT and DELETE /budgets/{month}/{categoryId} with the zod-derived schemas', async () => {
    const res = await app.inject({ method: 'GET', url: '/docs/json' });
    expect(res.statusCode).toBe(200);
    const doc = res.json() as { paths: Record<string, Record<string, Record<string, unknown>>> };
    const entry = doc.paths['/budgets/{month}/{categoryId}'];
    expect(entry).toBeDefined();
    expect(Object.keys(entry ?? {}).sort()).toEqual(['delete', 'put']);

    const putOp = entry?.put as { parameters: Array<{ name: string }>; requestBody: unknown; responses: Record<string, unknown> };
    expect(putOp.parameters.map((p) => p.name).sort()).toEqual(['categoryId', 'month']);
    expect(JSON.stringify(putOp.requestBody)).toContain('amountMinor');
    expect(Object.keys(putOp.responses).sort()).toEqual(['200', '201', '400', '401', '404']);
    const delOp = entry?.delete as { responses: Record<string, unknown> };
    expect(Object.keys(delOp.responses).sort()).toEqual(['204', '400', '401', '404']);
  });
});
