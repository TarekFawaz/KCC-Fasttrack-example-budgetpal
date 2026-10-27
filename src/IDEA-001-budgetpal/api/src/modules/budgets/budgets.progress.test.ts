import { fileURLToPath } from 'node:url';
import { Writable } from 'node:stream';
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

interface Progress {
  month: string;
  items: Array<{
    categoryId: number;
    categoryName: string;
    budgetMinor: number;
    spentMinor: number;
    percent: number;
    status: string;
  }>;
  unbudgeted: Array<{ categoryId: number; categoryName: string; spentMinor: number }>;
}

let db: Database.Database;
let app: FastifyInstance;
let alice: LoggedInUser;
let bob: LoggedInUser;
let aliceAccount: number;
let bobAccount: number;
let logLines: string[];

const addAccount = (userId: number): number =>
  Number(
    db
      .prepare(
        'INSERT INTO accounts (user_id, name, type, opening_balance_minor, created_at, updated_at) VALUES (?, ?, ?, 0, 1, 1)',
      )
      .run(userId, `acct-${userId}`, 'checking').lastInsertRowid,
  );
const addCategory = (userId: number, name: string, kind: 'expense' | 'income'): number =>
  Number(
    db
      .prepare('INSERT INTO categories (user_id, name, kind, created_at) VALUES (?, ?, ?, ?)')
      .run(userId, name, kind, '2026-01-01T00:00:00.000Z').lastInsertRowid,
  );
const addTx = (userId: number, accountId: number, categoryId: number, occurredOn: string, amountMinor: number): void => {
  db.prepare(
    `INSERT INTO transactions (user_id, account_id, category_id, occurred_on, amount_minor, description, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'test', 1, 1)`,
  ).run(userId, accountId, categoryId, occurredOn, amountMinor);
};
const addBudget = (userId: number, categoryId: number, month: string, amountMinor: number): void => {
  db.prepare(
    'INSERT INTO budgets (user_id, category_id, month, amount_minor, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(userId, categoryId, month, amountMinor, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
};
const get = (user: LoggedInUser | undefined, query: string) =>
  app.inject({ method: 'GET', url: `/budgets${query}`, ...(user ? { headers: user.headers } : {}) });
const rowCount = (): number => (db.prepare('SELECT COUNT(*) AS n FROM budgets').get() as { n: number }).n;

beforeEach(async () => {
  logLines = [];
  const logStream = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      logLines.push(chunk.toString('utf8'));
      callback();
    },
  });
  db = openDb(':memory:');
  runMigrations(db, migrationsDir);
  app = await buildApp(loadConfig({ LOG_LEVEL: 'info' }), { db, logStream });
  await app.ready();
  alice = createLoggedInUser(app, 'alice@example.test');
  bob = createLoggedInUser(app, 'bob@example.test');
  aliceAccount = addAccount(alice.id);
  bobAccount = addAccount(bob.id);
});
afterEach(async () => {
  await app.close();
  if (db.open) db.close();
});

describe('budgets progress', () => {
  it('T-014 returns each budgeted category with id, name, budget, spent, percent and status', async () => {
    const food = addCategory(alice.id, 'Groceries', 'expense');
    const rent = addCategory(alice.id, 'Rent', 'expense');
    addBudget(alice.id, food, MONTH, 40_000);
    addBudget(alice.id, rent, MONTH, 100_000);
    addTx(alice.id, aliceAccount, food, '2026-03-01', 10_000);
    addTx(alice.id, aliceAccount, food, '2026-03-31', 5_050);
    addTx(alice.id, aliceAccount, food, '2026-02-28', 9_999); // other month
    addTx(alice.id, aliceAccount, food, '2026-04-01', 9_999); // other month

    const res = await get(alice, `?month=${MONTH}`);
    expect(res.statusCode).toBe(200);
    const body = res.json() as Progress;
    expect(body.month).toBe(MONTH);
    expect(body.items).toEqual([
      { categoryId: food, categoryName: 'Groceries', budgetMinor: 40_000, spentMinor: 15_050, percent: 37, status: 'ok' },
      { categoryId: rent, categoryName: 'Rent', budgetMinor: 100_000, spentMinor: 0, percent: 0, status: 'ok' },
    ]);
    expect(body.unbudgeted).toEqual([]);
  });

  it('T-015 spending of 79%, 80%, 100% and 101% gives ok, warning, warning and over', async () => {
    const cases: Array<[string, number, string, number]> = [
      ['At79', 7_900, 'ok', 79],
      ['At80', 8_000, 'warning', 80],
      ['At100', 10_000, 'warning', 100],
      ['At101', 10_100, 'over', 101],
    ];
    const ids = new Map<string, number>();
    for (const [name, spent] of cases) {
      const id = addCategory(alice.id, name, 'expense');
      ids.set(name, id);
      addBudget(alice.id, id, MONTH, 10_000);
      addTx(alice.id, aliceAccount, id, '2026-03-15', spent);
    }
    const body = (await get(alice, `?month=${MONTH}`)).json() as Progress;
    for (const [name, spent, status, percent] of cases) {
      const item = body.items.find((i) => i.categoryId === ids.get(name));
      expect(item, name).toMatchObject({ spentMinor: spent, status, percent });
    }
  });

  it('T-015 the status uses integer maths, not the rounded percent (79.99% is ok, 100.01% is over)', async () => {
    const a = addCategory(alice.id, 'Edge A', 'expense');
    const b = addCategory(alice.id, 'Edge B', 'expense');
    addBudget(alice.id, a, MONTH, 100_000);
    addBudget(alice.id, b, MONTH, 100_000);
    addTx(alice.id, aliceAccount, a, '2026-03-02', 79_999); // 79.999% -> percent 79 and ok
    addTx(alice.id, aliceAccount, b, '2026-03-02', 100_001); // 100.001% -> percent 100 but over
    const body = (await get(alice, `?month=${MONTH}`)).json() as Progress;
    expect(body.items.find((i) => i.categoryId === a)).toMatchObject({ percent: 79, status: 'ok' });
    expect(body.items.find((i) => i.categoryId === b)).toMatchObject({ percent: 100, status: 'over' });
  });

  it('T-016 an expense category with spend and no budget is listed as unbudgeted; income never is', async () => {
    const budgeted = addCategory(alice.id, 'Budgeted', 'expense');
    const fun = addCategory(alice.id, 'Fun', 'expense');
    const quiet = addCategory(alice.id, 'Quiet', 'expense');
    const salary = addCategory(alice.id, 'Salary', 'income');
    addBudget(alice.id, budgeted, MONTH, 5_000);
    addTx(alice.id, aliceAccount, budgeted, '2026-03-03', 100);
    addTx(alice.id, aliceAccount, fun, '2026-03-04', 1_200);
    addTx(alice.id, aliceAccount, fun, '2026-03-20', 300);
    addTx(alice.id, aliceAccount, salary, '2026-03-25', 500_000);
    addTx(alice.id, aliceAccount, quiet, '2026-02-10', 800); // spend in another month only

    const body = (await get(alice, `?month=${MONTH}`)).json() as Progress;
    expect(body.unbudgeted).toEqual([{ categoryId: fun, categoryName: 'Fun', spentMinor: 1_500 }]);
    expect(body.items.map((i) => i.categoryId)).toEqual([budgeted]);
  });

  it('T-017 a month without budgets is 200 with empty items', async () => {
    const food = addCategory(alice.id, 'Groceries', 'expense');
    addBudget(alice.id, food, '2026-04', 1_000);
    const res = await get(alice, '?month=2026-05');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ month: '2026-05', items: [], unbudgeted: [] });
  });

  it('T-018 a missing, malformed or unknown query key is 400 problem+json', async () => {
    const queries = ['', '?month=', '?month=2026-13', '?month=2026-3', '?month=March', `?month=${MONTH}&extra=1`, '?extra=1'];
    for (const query of queries) {
      const res = await get(alice, query);
      expect(res.statusCode, query).toBe(400);
      expect(res.headers['content-type'], query).toContain('application/problem+json');
      expect((res.json() as { errors?: unknown[] }).errors?.length, query).toBeGreaterThan(0);
    }
    expect(rowCount()).toBe(0);
  });

  it('T-018 without a session cookie the answer is 401, before validation', async () => {
    const res = await get(undefined, `?month=${MONTH}`);
    expect(res.statusCode).toBe(401);
    expect((await get(undefined, '')).statusCode).toBe(401);
  });

  it('T-019 user B sees none of user A\'s items, unbudgeted categories or amounts', async () => {
    const food = addCategory(alice.id, 'Groceries', 'expense');
    const fun = addCategory(alice.id, 'Fun', 'expense');
    addBudget(alice.id, food, MONTH, 12_345);
    addTx(alice.id, aliceAccount, food, '2026-03-05', 6_789);
    addTx(alice.id, aliceAccount, fun, '2026-03-06', 4_321);

    const bobFood = addCategory(bob.id, 'Rent', 'expense');
    addBudget(bob.id, bobFood, MONTH, 999);
    addTx(bob.id, bobAccount, bobFood, '2026-03-07', 111);
    // B spends against A's category id: A's category must not show up for B or change A's sums.
    addTx(bob.id, bobAccount, food, '2026-03-08', 77);

    const bobBody = (await get(bob, `?month=${MONTH}`)).json() as Progress;
    expect(bobBody.items).toEqual([
      { categoryId: bobFood, categoryName: 'Rent', budgetMinor: 999, spentMinor: 111, percent: 11, status: 'ok' },
    ]);
    expect(bobBody.unbudgeted).toEqual([]);
    const text = JSON.stringify(bobBody);
    for (const secret of ['Groceries', 'Fun', '12345', '6789', '4321']) expect(text).not.toContain(secret);

    const aliceBody = (await get(alice, `?month=${MONTH}`)).json() as Progress;
    expect(aliceBody.items[0]).toMatchObject({ categoryId: food, spentMinor: 6_789 });
    expect(aliceBody.unbudgeted).toEqual([{ categoryId: fun, categoryName: 'Fun', spentMinor: 4_321 }]);
  });

  it('T-020 /docs/json lists GET /budgets with query and response schemas', async () => {
    const res = await app.inject({ method: 'GET', url: '/docs/json' });
    const doc = res.json() as { paths: Record<string, Record<string, Record<string, unknown>>> };
    const entry = doc.paths['/budgets'];
    expect(Object.keys(entry ?? {})).toEqual(['get']);
    const op = entry?.get as { parameters: Array<{ name: string; in: string; required?: boolean }>; responses: Record<string, unknown> };
    expect(op.parameters).toEqual([expect.objectContaining({ name: 'month', in: 'query', required: true })]);
    expect(Object.keys(op.responses).sort()).toEqual(['200', '400', '401']);
    expect(JSON.stringify(op.responses['200'])).toContain('unbudgeted');
  });

  it('T-021 log output across PUT, GET and DELETE holds no amount values', async () => {
    const food = addCategory(alice.id, 'Groceries', 'expense');
    addTx(alice.id, aliceAccount, food, '2026-03-05', 424_243);
    const path = `/budgets/${MONTH}/${food}`;
    const put = await app.inject({ method: 'PUT', url: path, headers: alice.headers, payload: { amountMinor: 987_654 } });
    expect(put.statusCode).toBe(201);
    expect((await get(alice, `?month=${MONTH}`)).statusCode).toBe(200);
    expect((await app.inject({ method: 'DELETE', url: path, headers: alice.headers })).statusCode).toBe(204);

    const logged = logLines.join('');
    expect(logged).toContain('budget.set');
    expect(logged).toContain('budget.progress');
    expect(logged).toContain('budget.removed');
    for (const amount of ['987654', '424243', '987_654']) expect(logged).not.toContain(amount);
    expect(logged).not.toContain('amountMinor');
    expect(logged).not.toContain('spentMinor');
  });

  it('GET /budgets changes no state (GR-005)', async () => {
    const food = addCategory(alice.id, 'Groceries', 'expense');
    addBudget(alice.id, food, MONTH, 100);
    const before = db.prepare('SELECT * FROM budgets ORDER BY id').all();
    await get(alice, `?month=${MONTH}`);
    await get(alice, '?month=2026-04');
    expect(db.prepare('SELECT * FROM budgets ORDER BY id').all()).toEqual(before);
  });
});
