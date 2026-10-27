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

const addAccount = (userId: number, name = `acct-${userId}`): number =>
  Number(
    db
      .prepare(
        'INSERT INTO accounts (user_id, name, type, opening_balance_minor, created_at, updated_at) VALUES (?, ?, ?, 0, 1, 1)',
      )
      .run(userId, name, 'checking').lastInsertRowid,
  );
const addCategory = (userId: number, name = `cat-${userId}`): number =>
  Number(
    db
      .prepare('INSERT INTO categories (user_id, name, kind, created_at) VALUES (?, ?, ?, ?)')
      .run(userId, name, 'expense', '2026-01-01T00:00:00.000Z').lastInsertRowid,
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

interface StoredTransaction {
  id: number;
  accountId: number;
  categoryId: number;
  occurredOn: string;
  amountMinor: number;
  description: string;
  createdAt: string;
  updatedAt: string;
}

const patch = (user: LoggedInUser | undefined, id: number | string, payload: unknown) =>
  app.inject({
    method: 'PATCH',
    url: `${PATH}/${id}`,
    payload: payload as object,
    ...(user ? { headers: user.headers } : {}),
  });
const del = (user: LoggedInUser | undefined, id: number | string) =>
  app.inject({ method: 'DELETE', url: `${PATH}/${id}`, ...(user ? { headers: user.headers } : {}) });
const stored = (id: number): StoredTransaction | undefined =>
  db
    .prepare(
      `SELECT id, account_id AS accountId, category_id AS categoryId, occurred_on AS occurredOn,
              amount_minor AS amountMinor, description, created_at AS createdAt, updated_at AS updatedAt
         FROM transactions WHERE id = ?`,
    )
    .get(id) as StoredTransaction | undefined;
/** Creates a row through the API, then back-dates `updated_at` so a later change is visibly later. */
const seed = async (user: LoggedInUser, payload: unknown): Promise<StoredTransaction> => {
  const res = await post(user, payload);
  const { id } = res.json() as { id: number };
  db.prepare('UPDATE transactions SET updated_at = ? WHERE id = ?').run('2020-01-01T00:00:00.000Z', id);
  return stored(id) as StoredTransaction;
};

describe('PATCH and DELETE /api/transactions/:id (Story-002)', () => {
  it('T-013 PATCH changed fields returns 200 with the updated row and a later updated_at (AC-1)', async () => {
    const row = await seed(alice, valid());
    const otherCategory = addCategory(alice.id, 'cat-other');
    const res = await patch(alice, row.id, { amountMinor: 2000, description: 'Tea', categoryId: otherCategory });
    expect(res.statusCode).toBe(200);
    const body = res.json() as StoredTransaction;
    expect(body).toMatchObject({
      id: row.id,
      accountId: aliceAccount,
      categoryId: otherCategory,
      occurredOn: '2026-03-15',
      amountMinor: 2000,
      description: 'Tea',
    });
    expect(body.updatedAt > row.updatedAt).toBe(true);
    expect(body.createdAt).toBe(row.createdAt);
    expect(stored(row.id)).toEqual(body);
  });

  it('T-014 DELETE returns 204 and the row is gone (AC-2)', async () => {
    const row = await seed(alice, valid());
    const res = await del(alice, row.id);
    expect(res.statusCode).toBe(204);
    expect(res.body).toBe('');
    expect(stored(row.id)).toBeUndefined();
    expect(rowCount()).toBe(0);
  });

  it('T-015 another user\'s or an unknown id is a 404 for PATCH and DELETE and the row is unchanged (AC-3)', async () => {
    const row = await seed(alice, valid());
    for (const res of [
      await patch(bob, row.id, { description: 'hijack' }),
      await del(bob, row.id),
      await patch(alice, 99_999, { description: 'nothing' }),
      await del(alice, 99_999),
    ]) {
      expect(res.statusCode).toBe(404);
      expect(res.headers['content-type']).toContain('application/problem+json');
    }
    expect(stored(row.id)).toEqual(row);
    expect(rowCount()).toBe(1);
  });

  it.each([
    ['another user\'s account', () => ({ accountId: bobAccount }), 'accountId'],
    ['an unknown account', () => ({ accountId: 99_999 }), 'accountId'],
    ['another user\'s category', () => ({ categoryId: bobCategory }), 'categoryId'],
    ['an unknown category', () => ({ categoryId: 99_999 }), 'categoryId'],
  ])('T-016 a patch with %s returns 400 naming the field and the row is unchanged (AC-4)', async (_label, payload, field) => {
    const row = await seed(alice, valid());
    const res = await patch(alice, row.id, { description: 'changed too', ...payload() });
    expect(res.statusCode).toBe(400);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect((res.json() as Problem).errors?.some((error) => error.field === field)).toBe(true);
    expect(stored(row.id)).toEqual(row);
  });

  it.each([
    ['an empty patch', {}, '(body)'],
    ['an invalid amount', { amountMinor: 0 }, 'amountMinor'],
    ['a fractional amount', { amountMinor: 1.5 }, 'amountMinor'],
    ['a calendar-impossible date', { occurredOn: '2026-02-30' }, 'occurredOn'],
    ['a 201-character description', { description: 'x'.repeat(201) }, 'description'],
    ['an unknown field', { userId: bobCategory }, '(body)'],
  ])('T-017 %s returns 400 with field errors and the row is unchanged (AC-5)', async (_label, payload, field) => {
    const row = await seed(alice, valid());
    const res = await patch(alice, row.id, payload);
    expect(res.statusCode).toBe(400);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect((res.json() as Problem).errors?.some((error) => error.field === field)).toBe(true);
    expect(stored(row.id)).toEqual(row);
  });

  it('T-017 a malformed id is a 400 for PATCH and DELETE (AC-5)', async () => {
    expect((await patch(alice, 'abc', { description: 'x' })).statusCode).toBe(400);
    expect((await del(alice, 'abc')).statusCode).toBe(400);
  });

  it('T-018 PATCH and DELETE without a session return 401 and change nothing (AC-6)', async () => {
    const row = await seed(alice, valid());
    const patched = await patch(undefined, row.id, { description: 'anon' });
    const deleted = await del(undefined, row.id);
    expect(patched.statusCode).toBe(401);
    expect(deleted.statusCode).toBe(401);
    expect(patched.headers['content-type']).toContain('application/problem+json');
    // The guard runs before validation: even an invalid body is a 401.
    expect((await patch(undefined, row.id, {})).statusCode).toBe(401);
    expect(stored(row.id)).toEqual(row);
  });

  it('T-019 PATCH and DELETE log neither the description nor the amount (AC-1)', async () => {
    const row = await seed(alice, valid());
    logLines = '';
    const patched = await patch(alice, row.id, { amountMinor: 765_432, description: 'Secret-Patched-Note' });
    expect(patched.statusCode).toBe(200);
    const deleted = await del(alice, row.id);
    expect(deleted.statusCode).toBe(204);
    expect(logLines.length).toBeGreaterThan(0);
    expect(logLines).not.toContain('Secret-Patched-Note');
    expect(logLines).not.toContain('Coffee beans');
    expect(logLines).not.toContain('765432');
    expect(logLines).not.toContain('1250');
  });
});

interface Page {
  items: StoredTransaction[];
  total: number;
  limit: number;
  offset: number;
}

const list = (user: LoggedInUser | undefined, query = '') =>
  app.inject({ method: 'GET', url: `${PATH}${query}`, ...(user ? { headers: user.headers } : {}) });
const insertRow = (userId: number, accountId: number, categoryId: number, occurredOn: string, amount = 100): number =>
  Number(
    db
      .prepare(
        `INSERT INTO transactions (user_id, account_id, category_id, occurred_on, amount_minor, description, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'row', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
      )
      .run(userId, accountId, categoryId, occurredOn, amount).lastInsertRowid,
  );

describe('GET /api/transactions (Story-003)', () => {
  it('T-020 returns {items,total,limit,offset} ordered by date then id descending, default limit 50, paged by offset (AC-1)', async () => {
    const a = insertRow(alice.id, aliceAccount, aliceCategory, '2026-03-10');
    const b = insertRow(alice.id, aliceAccount, aliceCategory, '2026-03-20');
    const c = insertRow(alice.id, aliceAccount, aliceCategory, '2026-03-10');
    const res = await list(alice);
    expect(res.statusCode).toBe(200);
    const body = res.json() as Page;
    expect(body.items.map((item) => item.id)).toEqual([b, c, a]);
    expect(body).toMatchObject({ total: 3, limit: 50, offset: 0 });
    for (let i = 0; i < 60; i += 1) insertRow(alice.id, aliceAccount, aliceCategory, '2026-01-01');
    const first = (await list(alice)).json() as Page;
    expect(first.items).toHaveLength(50);
    expect(first.total).toBe(63);
    const second = (await list(alice, '?limit=50&offset=50')).json() as Page;
    expect(second.items).toHaveLength(13);
    expect(second).toMatchObject({ limit: 50, offset: 50, total: 63 });
    const ids = new Set([...first.items, ...second.items].map((item) => item.id));
    expect(ids.size).toBe(63);
  });

  it('T-021 month, accountId and categoryId filter alone and combined; total counts the filtered set (AC-2)', async () => {
    const otherAccount = addAccount(alice.id, 'acct-other');
    const otherCategory = addCategory(alice.id, 'cat-other');
    insertRow(alice.id, aliceAccount, aliceCategory, '2026-03-01');
    insertRow(alice.id, aliceAccount, aliceCategory, '2026-03-31');
    insertRow(alice.id, aliceAccount, otherCategory, '2026-03-15');
    insertRow(alice.id, otherAccount, aliceCategory, '2026-03-16');
    insertRow(alice.id, aliceAccount, aliceCategory, '2026-04-01');
    insertRow(alice.id, aliceAccount, aliceCategory, '2026-02-28');
    const totalOf = async (query: string): Promise<number> => ((await list(alice, query)).json() as Page).total;
    expect(await totalOf('?month=2026-03')).toBe(4);
    expect(await totalOf(`?accountId=${otherAccount}`)).toBe(1);
    expect(await totalOf(`?categoryId=${otherCategory}`)).toBe(1);
    expect(await totalOf(`?month=2026-03&accountId=${aliceAccount}&categoryId=${aliceCategory}`)).toBe(2);
    const paged = (await list(alice, '?month=2026-03&limit=1')).json() as Page;
    expect(paged.items).toHaveLength(1);
    expect(paged.total).toBe(4);
  });

  it.each([
    ['limit 201', '?limit=201'],
    ['limit 0', '?limit=0'],
    ['a negative offset', '?offset=-1'],
    ['month 2026-13', '?month=2026-13'],
    ['a malformed month', '?month=March'],
    ['an unknown query key', '?bogus=1'],
  ])('T-022 %s returns 400 problem+json with field errors (AC-3)', async (_label, query) => {
    const res = await list(alice, query);
    expect(res.statusCode).toBe(400);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(((res.json() as Problem).errors ?? []).length).toBeGreaterThan(0);
  });

  it('T-008 listing without a session returns 401 problem+json (guard applies to GET too)', async () => {
    const res = await list(undefined);
    expect(res.statusCode).toBe(401);
    expect(res.headers['content-type']).toContain('application/problem+json');
  });

  it("T-023 user A never sees user B's rows, also when filtering by B's account id (AC-4)", async () => {
    insertRow(alice.id, aliceAccount, aliceCategory, '2026-03-01');
    const bobRow = insertRow(bob.id, bobAccount, bobCategory, '2026-03-02');
    const plain = (await list(alice)).json() as Page;
    expect(plain.items.map((item) => item.id)).not.toContain(bobRow);
    expect(plain.total).toBe(1);
    for (const query of [`?accountId=${bobAccount}`, `?categoryId=${bobCategory}`, `?accountId=${bobAccount}&month=2026-03`]) {
      const body = (await list(alice, query)).json() as Page;
      expect(body).toMatchObject({ items: [], total: 0 });
    }
  });

  it('T-024 a month list over 10,000 rows has p95 under 200 ms (AC-5)', async () => {
    const insert = db.prepare(
      `INSERT INTO transactions (user_id, account_id, category_id, occurred_on, amount_minor, description, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'row', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
    );
    db.transaction(() => {
      for (let i = 0; i < 10_000; i += 1) {
        const month = String((i % 12) + 1).padStart(2, '0');
        const day = String((i % 28) + 1).padStart(2, '0');
        insert.run(alice.id, aliceAccount, aliceCategory, `2026-${month}-${day}`, 100 + i);
      }
    })();
    await list(alice, '?month=2026-03'); // warm-up
    const samples: number[] = [];
    for (let i = 0; i < 40; i += 1) {
      const start = performance.now();
      const res = await list(alice, '?month=2026-03');
      samples.push(performance.now() - start);
      expect(res.statusCode).toBe(200);
    }
    samples.sort((x, y) => x - y);
    const p95 = samples[Math.ceil(samples.length * 0.95) - 1] as number;
    expect(p95).toBeLessThan(200);
  });

  it('T-025 the month list is served by the (user_id, occurred_on) index (AC-5)', () => {
    const plan = db
      .prepare(
        `EXPLAIN QUERY PLAN SELECT id FROM transactions
          WHERE user_id = ? AND occurred_on >= ? AND occurred_on < ?
          ORDER BY occurred_on DESC, id DESC LIMIT 50 OFFSET 0`,
      )
      .all(alice.id, '2026-03-01', '2026-03-32') as Array<{ detail: string }>;
    const detail = plan.map((row) => row.detail).join(' | ');
    expect(detail).toMatch(/USING (COVERING )?INDEX \w+/);
    expect(detail).toContain('user_id=?');
    expect(detail).toContain('occurred_on>?');
  });

  it('T-026 no match returns items [] and total 0 (AC-6)', async () => {
    const res = await list(alice, '?month=2030-01');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ items: [], total: 0, limit: 50, offset: 0 });
  });

  it('T-027 /docs/json documents POST, GET list, PATCH and DELETE with matching status codes; sampled responses fit (AC-1)', async () => {
    const doc = (await app.inject({ method: 'GET', url: '/docs/json' })).json() as {
      paths: Record<string, Record<string, { responses: Record<string, unknown> }>>;
    };
    const codes = (path: string, verb: string): string[] => Object.keys(doc.paths[path]?.[verb]?.responses ?? {});
    expect(codes(PATH, 'get')).toEqual(expect.arrayContaining(['200', '400', '401']));
    expect(codes(PATH, 'post')).toEqual(expect.arrayContaining(['201', '400', '401']));
    expect(codes(`${PATH}/{id}`, 'patch')).toEqual(expect.arrayContaining(['200', '400', '401', '404']));
    expect(codes(`${PATH}/{id}`, 'delete')).toEqual(expect.arrayContaining(['204', '400', '401', '404']));
    insertRow(alice.id, aliceAccount, aliceCategory, '2026-03-01');
    const page = (await list(alice)).json() as Page;
    expect(Object.keys(page).sort()).toEqual(['items', 'limit', 'offset', 'total']);
    expect(Object.keys(page.items[0] as object).sort()).toEqual([
      'accountId',
      'amountMinor',
      'categoryId',
      'createdAt',
      'description',
      'id',
      'occurredOn',
      'updatedAt',
    ]);
  });
});
