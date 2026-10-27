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
import { currentMonth, fillWindow, monthWindow, trendForUser } from './trend.service.js';

const migrationsDir = fileURLToPath(new URL('../../../migrations', import.meta.url));
const PATH = '/api/dashboard/trend';

interface Trend {
  currency: string;
  points: Array<{ month: string; totalMinor: number }>;
}

let db: Database.Database;
let app: FastifyInstance;
let alice: LoggedInUser;
let bob: LoggedInUser;
let aliceAccount: number;
let aliceFood: number;
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
const get = (user: LoggedInUser | undefined, query = '') =>
  app.inject({ method: 'GET', url: `${PATH}${query}`, ...(user ? { headers: user.headers } : {}) });

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
  aliceFood = addCategory(alice.id, 'Food');
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await app.close();
  if (db.open) db.close();
});

describe('trend service (Story-002)', () => {
  it('T-014 months=6,end=2026-03 yields 2025-10..2026-03 oldest first across a year boundary (AC-1)', () => {
    expect(monthWindow(6, '2026-03')).toEqual(['2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03']);
    expect(monthWindow(1, '2026-01')).toEqual(['2026-01']);
    expect(monthWindow(24, '2026-03')).toHaveLength(24);
    expect(monthWindow(24, '2026-03')[0]).toBe('2024-04');
  });

  it('T-015 gap months are zero-filled with totalMinor 0 (AC-2)', () => {
    const window = monthWindow(4, '2026-03');
    expect(fillWindow(window, [{ month: '2026-01', totalMinor: 500 }, { month: '2026-03', totalMinor: 700 }])).toEqual([
      { month: '2025-12', totalMinor: 0 },
      { month: '2026-01', totalMinor: 500 },
      { month: '2026-02', totalMinor: 0 },
      { month: '2026-03', totalMinor: 700 },
    ]);
  });

  it('T-016 no months or end gives 6 points ending in the current month (fake clock) (AC-3)', () => {
    const now = new Date('2026-08-15T12:00:00Z');
    expect(currentMonth(now)).toBe('2026-08');
    const trend = trendForUser(db, alice.id, 'EUR', { now });
    expect(trend.points.map((p) => p.month)).toEqual(['2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08']);
    expect(trend.points.every((p) => p.totalMinor === 0)).toBe(true);
    expect(currentMonth(new Date('2026-01-01T00:00:00Z'))).toBe('2026-01');
  });
});

describe('GET /api/dashboard/trend (Story-002)', () => {
  it('T-017 seeded expenses over several months give exactly 6 points with correct sums and the currency (AC-1)', async () => {
    addTx(alice.id, aliceAccount, aliceFood, '2025-10-01', 1000);
    addTx(alice.id, aliceAccount, aliceFood, '2025-10-31', 500);
    addTx(alice.id, aliceAccount, aliceFood, '2025-12-15', 2500);
    addTx(alice.id, aliceAccount, aliceFood, '2026-03-31', 4000);
    addTx(alice.id, aliceAccount, aliceFood, '2025-09-30', 9999);
    addTx(alice.id, aliceAccount, aliceFood, '2026-04-01', 8888);
    const res = await get(alice, '?months=6&end=2026-03');
    expect(res.statusCode).toBe(200);
    const body = res.json() as Trend;
    expect(body.currency).toBe('EUR');
    expect(body.points).toEqual([
      { month: '2025-10', totalMinor: 1500 },
      { month: '2025-11', totalMinor: 0 },
      { month: '2025-12', totalMinor: 2500 },
      { month: '2026-01', totalMinor: 0 },
      { month: '2026-02', totalMinor: 0 },
      { month: '2026-03', totalMinor: 4000 },
    ]);
  });

  it('T-017 without months and end the response has 6 points ending in the current month (AC-3)', async () => {
    const body = (await get(alice)).json() as Trend;
    expect(body.points).toHaveLength(6);
    expect(body.points.at(-1)?.month).toBe(currentMonth());
  });

  it('T-018 user B gets all-zero points and A\'s figures never appear (AC-4, QG-ISOLATION)', async () => {
    addTx(alice.id, aliceAccount, aliceFood, '2026-03-10', 98765);
    const bobRes = await get(bob, '?months=6&end=2026-03');
    expect(bobRes.statusCode).toBe(200);
    const body = bobRes.json() as Trend;
    expect(body.points).toHaveLength(6);
    expect(body.points.every((p) => p.totalMinor === 0)).toBe(true);
    expect(bobRes.body).not.toContain('98765');
    expect(((await get(alice, '?months=6&end=2026-03')).json() as Trend).points.at(-1)?.totalMinor).toBe(98765);
  });

  it('T-019 no session is 401; months=25 and end=2026-99 are 400 problem+json; income is excluded (AC-5)', async () => {
    const anon = await get(undefined);
    expect(anon.statusCode).toBe(401);
    expect(anon.headers['content-type']).toContain('application/problem+json');
    for (const query of ['?months=25', '?months=0', '?end=2026-99', '?end=abc', '?months=6&extra=1']) {
      const res = await get(alice, query);
      expect(res.statusCode, query).toBe(400);
      expect(res.headers['content-type'], query).toContain('application/problem+json');
    }
    const salary = addCategory(alice.id, 'Salary', 'income');
    addTx(alice.id, aliceAccount, salary, '2026-03-10', 500000);
    addTx(alice.id, aliceAccount, aliceFood, '2026-03-11', 1200);
    const body = (await get(alice, '?months=3&end=2026-03')).json() as Trend;
    expect(body.points.at(-1)).toEqual({ month: '2026-03', totalMinor: 1200 });
  });

  it('T-020 10,000 seeded rows with months=24 are answered under a generous bound using the index', async () => {
    const insert = db.prepare(
      'INSERT INTO transactions (user_id, account_id, category_id, occurred_on, amount_minor, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    );
    db.transaction(() => {
      for (let i = 0; i < 10000; i += 1) {
        const year = i % 2 === 0 ? 2025 : 2026;
        const month = String((i % 12) + 1).padStart(2, '0');
        const day = String((i % 28) + 1).padStart(2, '0');
        insert.run(alice.id, aliceAccount, aliceFood, `${year}-${month}-${day}`, 100 + (i % 50), 'seed', 'x', 'x');
      }
    })();
    const started = performance.now();
    const res = await get(alice, '?months=24&end=2026-12');
    const elapsed = performance.now() - started;
    expect(res.statusCode).toBe(200);
    const body = res.json() as Trend;
    expect(body.points).toHaveLength(24);
    expect(body.points.reduce((s, p) => s + p.totalMinor, 0)).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(1000);

    const plan = db
      .prepare(
        `EXPLAIN QUERY PLAN SELECT substr(t.occurred_on, 1, 7) AS month, SUM(t.amount_minor) FROM transactions t JOIN categories c ON c.id = t.category_id
         WHERE t.user_id = ? AND c.user_id = ? AND c.kind = 'expense' AND t.occurred_on >= ? AND t.occurred_on < ? GROUP BY month`,
      )
      .all(alice.id, alice.id, '2025-01-01', '2027-01-01') as Array<{ detail: string }>;
    expect(plan.map((p) => p.detail).join('\n')).toMatch(
      /SEARCH t USING (COVERING )?INDEX (idx_transactions_dashboard|transactions_user_occurred_on)/,
    );
  });

  it('T-021 a trend request logs no amounts or category names (AC-1, GR-008)', async () => {
    const secret = addCategory(alice.id, 'ZyxSecretCategory');
    addTx(alice.id, aliceAccount, secret, '2026-03-10', 7654321);
    const res = await get(alice, '?months=3&end=2026-03');
    expect(res.statusCode).toBe(200);
    expect(logLines).toContain('dashboard.trend');
    expect(logLines).not.toContain('7654321');
    expect(logLines).not.toContain('ZyxSecretCategory');
    expect(logLines).not.toMatch(/amount/i);
  });
});
