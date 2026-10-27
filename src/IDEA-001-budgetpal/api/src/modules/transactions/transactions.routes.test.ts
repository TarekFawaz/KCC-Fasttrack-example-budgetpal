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
const PATH = '/api/transactions';

interface Problem {
  status: number;
  errors?: Array<{ field: string; message: string }>;
}

let db: Database.Database;
let app: FastifyInstance;
let alice: LoggedInUser;
let bob: LoggedInUser;
let aliceAccount: number;
let aliceCategory: number;
let bobAccount: number;
let bobCategory: number;
let logLines: string;

const addAccount = (userId: number): number =>
  Number(
    db
      .prepare(
        'INSERT INTO accounts (user_id, name, type, opening_balance_minor, created_at, updated_at) VALUES (?, ?, ?, 0, 1, 1)',
      )
      .run(userId, `acct-${userId}`, 'checking').lastInsertRowid,
  );
const addCategory = (userId: number): number =>
  Number(
    db
      .prepare('INSERT INTO categories (user_id, name, kind, created_at) VALUES (?, ?, ?, ?)')
      .run(userId, `cat-${userId}`, 'expense', '2026-01-01T00:00:00.000Z').lastInsertRowid,
  );
const rowCount = (): number => (db.prepare('SELECT COUNT(*) AS n FROM transactions').get() as { n: number }).n;

const valid = (overrides: Record<string, unknown> = {}) => ({
  accountId: aliceAccount,
  categoryId: aliceCategory,
  occurredOn: '2026-03-15',
  amountMinor: 1250,
  description: 'Coffee beans',
  ...overrides,
});
const post = (user: LoggedInUser | undefined, payload: unknown) =>
  app.inject({ method: 'POST', url: PATH, payload: payload as object, ...(user ? { headers: user.headers } : {}) });

beforeEach(async () => {
  db = openDb(':memory:');
  runMigrations(db, migrationsDir);
  logLines = '';
  const logStream = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      logLines += chunk.toString();
      callback();
    },
  });
  // The default modules directory: the transactions module is found by the loader (T-012).
  app = await buildApp(loadConfig({ LOG_LEVEL: 'info' }), { db, logStream });
  await app.ready();
  alice = createLoggedInUser(app, 'alice@example.test');
  bob = createLoggedInUser(app, 'bob@example.test');
  aliceAccount = addAccount(alice.id);
  aliceCategory = addCategory(alice.id);
  bobAccount = addAccount(bob.id);
  bobCategory = addCategory(bob.id);
});
afterEach(async () => {
  await app.close();
  if (db.open) db.close();
});

describe('POST /api/transactions (Story-001)', () => {
  it('T-007 valid body returns 201 with the stored row; it is in the database as integer minor units (AC-1)', async () => {
    const res = await post(alice, valid());
    expect(res.statusCode).toBe(201);
    const body = res.json() as { id: number; amountMinor: number };
    expect(body).toMatchObject({
      accountId: aliceAccount,
      categoryId: aliceCategory,
      occurredOn: '2026-03-15',
      amountMinor: 1250,
      description: 'Coffee beans',
    });
    const row = db
      .prepare('SELECT user_id, amount_minor, typeof(amount_minor) AS t FROM transactions WHERE id = ?')
      .get(body.id) as { user_id: number; amount_minor: number; t: string };
    expect(row).toEqual({ user_id: alice.id, amount_minor: 1250, t: 'integer' });
    expect(rowCount()).toBe(1);
  });

  it('T-008 without a session returns 401 problem+json and writes nothing (AC-2)', async () => {
    const res = await post(undefined, valid());
    expect(res.statusCode).toBe(401);
    expect(res.headers['content-type']).toContain('application/problem+json');
    // Even an invalid body is a 401, never a 400, so the guard runs first.
    expect((await post(undefined, { nope: true })).statusCode).toBe(401);
    expect(rowCount()).toBe(0);
  });

  it.each([
    ['another user\'s account', () => valid({ accountId: bobAccount }), 'accountId'],
    ['an unknown account', () => valid({ accountId: 99_999 }), 'accountId'],
    ['another user\'s category', () => valid({ categoryId: bobCategory }), 'categoryId'],
    ['an unknown category', () => valid({ categoryId: 99_999 }), 'categoryId'],
  ])('T-009 %s returns 400 problem+json naming the field and writes nothing (AC-3)', async (_label, payload, field) => {
    const res = await post(alice, payload());
    expect(res.statusCode).toBe(400);
    expect(res.headers['content-type']).toContain('application/problem+json');
    const body = res.json() as Problem;
    expect(body.status).toBe(400);
    expect(body.errors?.some((error) => error.field === field)).toBe(true);
    expect(rowCount()).toBe(0);
  });

  it.each([
    ['a calendar-impossible date', valid({ occurredOn: '2026-02-30' }), 'occurredOn'],
    ['a malformed date', valid({ occurredOn: '15/03/2026' }), 'occurredOn'],
    ['amount 0', valid({ amountMinor: 0 }), 'amountMinor'],
    ['a negative amount', valid({ amountMinor: -5 }), 'amountMinor'],
    ['a fractional amount', valid({ amountMinor: 1.5 }), 'amountMinor'],
    ['an amount as a string', valid({ amountMinor: '12.50' }), 'amountMinor'],
    ['a 201-character description', valid({ description: 'x'.repeat(201) }), 'description'],
    ['an empty description', valid({ description: '' }), 'description'],
    ['an unknown field', valid({ userId: 1 }), '(body)'],
  ])('T-010 %s returns 400 with field errors and writes nothing (AC-4)', async (_label, payload, field) => {
    const res = await post(alice, payload);
    expect(res.statusCode).toBe(400);
    expect(res.headers['content-type']).toContain('application/problem+json');
    const body = res.json() as Problem;
    expect(body.errors?.some((error) => error.field === field)).toBe(true);
    expect(rowCount()).toBe(0);
  });

  it('T-011 a successful add logs neither the description nor the amount (AC-5)', async () => {
    const res = await post(alice, valid({ amountMinor: 987_654, description: 'Secret-Rent-Payment' }));
    expect(res.statusCode).toBe(201);
    expect(logLines.length).toBeGreaterThan(0);
    expect(logLines).not.toContain('Secret-Rent-Payment');
    expect(logLines).not.toContain('987654');
    expect(logLines).not.toContain('987_654');
  });

  it('T-012 the router is auto-registered and POST /api/transactions is in /docs/json (AC-6)', async () => {
    const res = await app.inject({ method: 'GET', url: '/docs/json' });
    expect(res.statusCode).toBe(200);
    const doc = res.json() as { paths: Record<string, Record<string, { responses: Record<string, unknown> }>> };
    const operation = doc.paths[PATH]?.post;
    expect(operation).toBeDefined();
    expect(Object.keys(operation?.responses ?? {})).toEqual(expect.arrayContaining(['201', '400', '401']));
  });
});
