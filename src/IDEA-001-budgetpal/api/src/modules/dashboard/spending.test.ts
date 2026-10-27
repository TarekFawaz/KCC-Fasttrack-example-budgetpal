import { fileURLToPath } from 'node:url';
import { Writable } from 'node:stream';
import type Database from 'better-sqlite3';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../app.js';
import { loadConfig } from '../../kernel/config.js';
import { openDb } from '../../kernel/db/index.js';
import { runMigrations } from '../../kernel/db/migrate.js';
import { createLoggedInUser, type LoggedInUser } from '../../../test/helpers/auth.js';
import { summarize } from './spending.service.js';

const migrationsDir = fileURLToPath(new URL('../../../migrations', import.meta.url));
const PATH = '/api/dashboard/spending';

interface Spending {
  month: string;
  currency: string;
  totalMinor: number;
  categories: Array<{ categoryId: number; name: string; amountMinor: number }>;
}

let db: Database.Database;
let app: FastifyInstance;
let alice: LoggedInUser;
let bob: LoggedInUser;
let logLines: string;

const addAccount = (userId: number): number =>
  Number(
    db
      .prepare('INSERT INTO accounts (user_id, name, type, opening_balance_minor, created_at, updated_at) VALUES (?, ?, ?, 0, 1, 1)')
      .run(userId, `acct-${userId}`, 'checking').lastInsertRowid,
  );
const addCategory = (userId: number, name: string, kind: 'expense' | 'income' = 'expense'): number =>
  Number(
    db
      .prepare('INSERT INTO categories (user_id, name, kind, created_at) VALUES (?, ?, ?, ?)')
      .run(userId, name, kind, '2026-01-01T00:00:00.000Z').lastInsertRowid,
  );
const addTx = (userId: number, accountId: number, categoryId: number, occurredOn: string, amountMinor: number): void => {
  db.prepare(
    'INSERT INTO transactions (user_id, account_id, category_id, occurred_on, amount_minor, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(userId, accountId, categoryId, occurredOn, amountMinor, 'seed', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
};
const get = (user: LoggedInUser | undefined, query: string) =>
  app.inject({ method: 'GET', url: `${PATH}${query}`, ...(user ? { headers: user.headers } : {}) });

let aliceAccount: number;

beforeEach(async () => {
  // The routes read the currency from the environment (D-13), like the rest of the kernel config.
  vi.stubEnv('CURRENCY', 'EUR');
  db = openDb(':memory:');
  runMigrations(db, migrationsDir);
  logLines = '';
  const logStream = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      logLines += chunk.toString();
      callback();
    },
  });
  app = await buildApp(loadConfig({ LOG_LEVEL: 'info', CURRENCY: 'EUR' }), { db, logStream });
  await app.ready();
  alice = createLoggedInUser(app, 'alice@example.test');
  bob = createLoggedInUser(app, 'bob@example.test');
  aliceAccount = addAccount(alice.id);
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await app.close();
  if (db.open) db.close();
});

describe('spending service (Story-001)', () => {
  it('T-006 totalMinor equals the sum of the category rows, rows keep their descending order, amounts are integers (AC-1)', () => {
    const rows = [
      { categoryId: 2, name: 'Rent', amountMinor: 90000 },
      { categoryId: 1, name: 'Food', amountMinor: 12345 },
      { categoryId: 3, name: 'Fun', amountMinor: 5 },
    ];
    const summary = summarize('2026-03', 'USD', rows);
    expect(summary.totalMinor).toBe(102350);
    expect(Number.isInteger(summary.totalMinor)).toBe(true);
    expect(summary.categories.map((c) => c.name)).toEqual(['Rent', 'Food', 'Fun']);
    expect(summary.categories.every((c) => Number.isInteger(c.amountMinor))).toBe(true);
    expect(summarize('2026-03', 'USD', [])).toEqual({ month: '2026-03', currency: 'USD', totalMinor: 0, categories: [] });
  });
});

describe('GET /api/dashboard/spending (Story-001)', () => {
  it('T-007 seeded expenses return month, currency, totalMinor and categories sorted descending that sum to the total (AC-1)', async () => {
    const food = addCategory(alice.id, 'Food');
    const rent = addCategory(alice.id, 'Rent');
    const fun = addCategory(alice.id, 'Fun');
    addTx(alice.id, aliceAccount, food, '2026-03-02', 1250);
    addTx(alice.id, aliceAccount, food, '2026-03-20', 750);
    addTx(alice.id, aliceAccount, rent, '2026-03-01', 90000);
    addTx(alice.id, aliceAccount, fun, '2026-03-31', 300);
    const res = await get(alice, '?month=2026-03');
    expect(res.statusCode).toBe(200);
    const body = res.json() as Spending;
    expect(body.month).toBe('2026-03');
    expect(body.currency).toBe('EUR');
    expect(body.categories).toEqual([
      { categoryId: rent, name: 'Rent', amountMinor: 90000 },
      { categoryId: food, name: 'Food', amountMinor: 2000 },
      { categoryId: fun, name: 'Fun', amountMinor: 300 },
    ]);
    expect(body.totalMinor).toBe(92300);
    expect(body.categories.reduce((s, c) => s + c.amountMinor, 0)).toBe(body.totalMinor);
  });

  it('T-008 income categories and other months, including the 02-28 and 04-01 boundaries, are not counted (AC-2)', async () => {
    const food = addCategory(alice.id, 'Food');
    const salary = addCategory(alice.id, 'Salary', 'income');
    addTx(alice.id, aliceAccount, food, '2026-02-28', 111);
    addTx(alice.id, aliceAccount, food, '2026-03-01', 1000);
    addTx(alice.id, aliceAccount, food, '2026-03-31', 2000);
    addTx(alice.id, aliceAccount, food, '2026-04-01', 444);
    addTx(alice.id, aliceAccount, salary, '2026-03-15', 500000);
    const body = (await get(alice, '?month=2026-03')).json() as Spending;
    expect(body.totalMinor).toBe(3000);
    expect(body.categories.map((c) => c.name)).toEqual(['Food']);
  });

  it('T-009 a month without expenses is 200 with totalMinor 0 and no categories (AC-3)', async () => {
    const food = addCategory(alice.id, 'Food');
    addTx(alice.id, aliceAccount, food, '2026-02-10', 500);
    const res = await get(alice, '?month=2026-03');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ month: '2026-03', currency: 'EUR', totalMinor: 0, categories: [] });
  });

  it('T-010 user B sees totalMinor 0 and none of A\'s category names (AC-4, QG-ISOLATION)', async () => {
    const secret = addCategory(alice.id, 'AliceOnlyCategory');
    addTx(alice.id, aliceAccount, secret, '2026-03-10', 98765);
    const bobRes = await get(bob, '?month=2026-03');
    expect(bobRes.statusCode).toBe(200);
    expect(bobRes.json()).toMatchObject({ totalMinor: 0, categories: [] });
    expect(bobRes.body).not.toContain('AliceOnlyCategory');
    expect(bobRes.body).not.toContain('98765');
    expect((await get(alice, '?month=2026-03')).body).toContain('AliceOnlyCategory');
  });

  it('T-010 a category id owned by another user never joins another user\'s transactions (AC-4)', async () => {
    // A transaction whose category row belongs to a different user must not be counted for either owner.
    const bobCategory = addCategory(bob.id, 'BobCategory');
    db.pragma('foreign_keys = OFF');
    addTx(alice.id, aliceAccount, bobCategory, '2026-03-10', 4242);
    db.pragma('foreign_keys = ON');
    expect(((await get(alice, '?month=2026-03')).json() as Spending).totalMinor).toBe(0);
    expect(((await get(bob, '?month=2026-03')).json() as Spending).totalMinor).toBe(0);
  });

  it('T-011 no cookie is 401; a bad month and an unknown field are 400 problem+json with the field (AC-5)', async () => {
    const anon = await get(undefined, '?month=2026-03');
    expect(anon.statusCode).toBe(401);
    expect(anon.headers['content-type']).toContain('application/problem+json');

    for (const query of ['?month=bad', '?month=2026-13', '', '?month=2026-03&extra=1']) {
      const res = await get(alice, query);
      expect(res.statusCode, query).toBe(400);
      expect(res.headers['content-type'], query).toContain('application/problem+json');
      const problem = res.json() as { status: number; errors?: Array<{ field: string }> };
      expect(problem.status).toBe(400);
      expect(problem.errors?.length ?? 0, query).toBeGreaterThan(0);
    }
    const bad = (await get(alice, '?month=bad')).json() as { errors: Array<{ field: string }> };
    expect(bad.errors.map((e) => e.field)).toContain('month');
  });

  it('T-012 10,000 seeded rows are answered by one call within a generous bound and the plan uses the (user_id, occurred_on) index', async () => {
    const categories = ['A', 'B', 'C', 'D', 'E'].map((n) => addCategory(alice.id, `Cat${n}`));
    const insert = db.prepare(
      'INSERT INTO transactions (user_id, account_id, category_id, occurred_on, amount_minor, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    );
    db.transaction(() => {
      for (let i = 0; i < 10000; i += 1) {
        const month = String((i % 12) + 1).padStart(2, '0');
        const day = String((i % 28) + 1).padStart(2, '0');
        insert.run(alice.id, aliceAccount, categories[i % 5], `2026-${month}-${day}`, 100 + (i % 50), 'seed', 'x', 'x');
      }
    })();
    const started = performance.now();
    const res = await get(alice, '?month=2026-03');
    const elapsed = performance.now() - started;
    expect(res.statusCode).toBe(200);
    expect((res.json() as Spending).totalMinor).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(1000);

    const plan = db
      .prepare(
        `EXPLAIN QUERY PLAN SELECT c.id, SUM(t.amount_minor) FROM transactions t JOIN categories c ON c.id = t.category_id
         WHERE t.user_id = ? AND c.user_id = ? AND c.kind = 'expense' AND t.occurred_on >= ? AND t.occurred_on < ? GROUP BY c.id`,
      )
      .all(alice.id, alice.id, '2026-03-01', '2026-04-01') as Array<{ detail: string }>;
    const details = plan.map((p) => p.detail).join('\n');
    expect(details).toMatch(/SEARCH t USING (COVERING )?INDEX (idx_transactions_dashboard|transactions_user_occurred_on)/);
  });

  it('T-013 a spending request logs neither amounts nor category names (AC-1, GR-008)', async () => {
    const secret = addCategory(alice.id, 'ZyxSecretCategory');
    addTx(alice.id, aliceAccount, secret, '2026-03-10', 7654321);
    const res = await get(alice, '?month=2026-03');
    expect(res.statusCode).toBe(200);
    expect(logLines).toContain('dashboard.spending');
    expect(logLines).not.toContain('ZyxSecretCategory');
    expect(logLines).not.toContain('7654321');
    expect(logLines).not.toMatch(/amount/i);
  });
});
