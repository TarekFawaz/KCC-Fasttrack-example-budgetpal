import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';
import { loadConfig } from '../../kernel/config.js';
import { runMigrations } from '../../kernel/db/migrate.js';
import { createLoggedInUser, type LoggedInUser } from '../../../test/helpers/auth.js';

const migrationsDir = fileURLToPath(new URL('../../../migrations', import.meta.url));
const config = loadConfig({ LOG_LEVEL: 'silent' });

let db: Database.Database;
let app: FastifyInstance;
let alice: LoggedInUser;
let bob: LoggedInUser;

type AccountBody = { id: number; name: string; type: string; openingBalanceMinor: number };

const valid = (name: string, extra: object = {}) => ({ name, type: 'checking', openingBalanceMinor: 1000, ...extra });
const call = (method: 'GET' | 'PUT' | 'DELETE' | 'POST', url: string, user?: LoggedInUser, payload?: unknown) =>
  app.inject({
    method,
    url,
    ...(payload === undefined ? {} : { payload: payload as object }),
    ...(user ? { headers: user.headers } : {}),
  });
const create = async (user: LoggedInUser, name: string, extra: object = {}): Promise<AccountBody> =>
  (await call('POST', '/api/accounts', user, valid(name, extra))).json() as AccountBody;
const rowOf = (id: number) =>
  db.prepare('SELECT name, type, opening_balance_minor AS balance FROM accounts WHERE id = ?').get(id) as
    | { name: string; type: string; balance: number }
    | undefined;
const accountCount = (): number => (db.prepare('SELECT COUNT(*) AS n FROM accounts').get() as { n: number }).n;

beforeEach(async () => {
  db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  runMigrations(db, migrationsDir);
  // Test-only referencing table (never a migration): SPEC-005's transactions.account_id will RESTRICT too.
  db.exec(
    'CREATE TABLE t_ref (id INTEGER PRIMARY KEY, account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT)',
  );
  app = await buildApp(config, { db });
  await app.ready();
  alice = createLoggedInUser(app);
  bob = createLoggedInUser(app);
});
afterEach(async () => {
  await app.close();
  if (db.open) db.close();
});

describe('GET /api/accounts/:id (Story-002)', () => {
  it('T-012 returns 200 for an own account, 400 for a malformed id and 404 for an unknown id (AC-1)', async () => {
    const account = await create(alice, 'Savings', { type: 'savings' });
    const ok = await call('GET', `/api/accounts/${account.id}`, alice);
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({ id: account.id, name: 'Savings', type: 'savings', openingBalanceMinor: 1000 });

    for (const bad of ['abc', '0', '-3', '1.5']) {
      const res = await call('GET', `/api/accounts/${bad}`, alice);
      expect(res.statusCode, bad).toBe(400);
      expect(res.headers['content-type']).toContain('application/problem+json');
    }
    const missing = await call('GET', '/api/accounts/9999', alice);
    expect(missing.statusCode).toBe(404);
    expect(missing.headers['content-type']).toContain('application/problem+json');
  });
});

describe('PUT /api/accounts/:id (Story-002)', () => {
  it('T-013 returns 200 with the new values (AC-2)', async () => {
    const account = await create(alice, 'Savings');
    const res = await call('PUT', `/api/accounts/${account.id}`, alice, {
      name: '  Rainy day ',
      type: 'savings',
      openingBalanceMinor: -50,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id: account.id, name: 'Rainy day', type: 'savings', openingBalanceMinor: -50 });
    expect(rowOf(account.id)).toEqual({ name: 'Rainy day', type: 'savings', balance: -50 });
    // Saving an account under its own name (any case) is not a clash.
    expect((await call('PUT', `/api/accounts/${account.id}`, alice, valid('RAINY DAY'))).statusCode).toBe(200);
  });

  it('T-013 returns 409 problem+json for a name another own account has, and the row is unchanged (AC-2)', async () => {
    const first = await create(alice, 'Savings');
    const second = await create(alice, 'Cash', { type: 'cash' });
    const res = await call('PUT', `/api/accounts/${second.id}`, alice, valid(' savings '));
    expect(res.statusCode).toBe(409);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.json()).toMatchObject({ status: 409, errors: [{ field: 'name' }] });
    expect(rowOf(second.id)).toEqual({ name: 'Cash', type: 'cash', balance: 1000 });
    expect(rowOf(first.id)?.name).toBe('Savings');
    // Another user may hold the same name.
    const other = await create(bob, 'Cash');
    expect((await call('PUT', `/api/accounts/${other.id}`, bob, valid('Savings'))).statusCode).toBe(200);
  });

  it.each([
    ['empty name', valid('  '), 'name'],
    ['unknown type', valid('A', { type: 'crypto' }), 'type'],
    ['fractional balance', valid('A', { openingBalanceMinor: 12.5 }), 'openingBalanceMinor'],
    ['extra field', valid('A', { color: 'red' }), '(body)'],
  ])('T-013 returns 400 for %s and leaves the row unchanged (AC-2)', async (_label, payload, field) => {
    const account = await create(alice, 'Savings');
    const res = await call('PUT', `/api/accounts/${account.id}`, alice, payload);
    expect(res.statusCode).toBe(400);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect((res.json() as { errors: Array<{ field: string }> }).errors.some((e) => e.field === field)).toBe(true);
    expect(rowOf(account.id)).toEqual({ name: 'Savings', type: 'checking', balance: 1000 });
  });

  it('T-013 returns 400 for a malformed id and 404 for an unknown one (AC-2)', async () => {
    expect((await call('PUT', '/api/accounts/abc', alice, valid('A'))).statusCode).toBe(400);
    expect((await call('PUT', '/api/accounts/9999', alice, valid('A'))).statusCode).toBe(404);
  });
});

describe('DELETE /api/accounts/:id (Story-002)', () => {
  it('T-014 returns 204 for an unreferenced account and it is gone (AC-3)', async () => {
    const account = await create(alice, 'Savings');
    const res = await call('DELETE', `/api/accounts/${account.id}`, alice);
    expect(res.statusCode).toBe(204);
    expect(res.body).toBe('');
    expect(rowOf(account.id)).toBeUndefined();
    expect((await call('GET', `/api/accounts/${account.id}`, alice)).statusCode).toBe(404);
    expect((await call('GET', '/api/accounts', alice)).json()).toEqual([]);
    expect((await call('DELETE', `/api/accounts/${account.id}`, alice)).statusCode).toBe(404);
  });

  it('T-015 returns 409 problem+json naming the rule when a foreign-key row refers to it, and the account stays (AC-4)', async () => {
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
    const account = await create(alice, 'Savings');
    db.prepare('INSERT INTO t_ref (account_id) VALUES (?)').run(account.id);

    const res = await call('DELETE', `/api/accounts/${account.id}`, alice);
    expect(res.statusCode).toBe(409);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.json()).toMatchObject({ status: 409, detail: expect.stringMatching(/transactions.*cannot be deleted/i) });
    expect(res.body).not.toMatch(/SQLITE|constraint failed|\bat \S+\.ts/i);
    expect(rowOf(account.id)).toBeDefined();

    db.prepare('DELETE FROM t_ref').run();
    expect((await call('DELETE', `/api/accounts/${account.id}`, alice)).statusCode).toBe(204);
  });
});

describe('isolation between users (Story-002, QG-ISOLATION)', () => {
  it('T-016 user B gets 404 on user A\'s get, update and delete, and A\'s row is unchanged (AC-5)', async () => {
    const account = await create(alice, 'Alice savings', { type: 'savings' });
    const url = `/api/accounts/${account.id}`;

    const get = await call('GET', url, bob);
    expect(get.statusCode).toBe(404);
    expect(get.body).not.toContain('Alice savings');
    expect((await call('PUT', url, bob, valid('Hijacked', { openingBalanceMinor: 1 }))).statusCode).toBe(404);
    expect((await call('DELETE', url, bob)).statusCode).toBe(404);

    expect(rowOf(account.id)).toEqual({ name: 'Alice savings', type: 'savings', balance: 1000 });
    expect((await call('GET', '/api/accounts', bob)).json()).toEqual([]);
    expect((await call('GET', url, alice)).statusCode).toBe(200);
    expect(accountCount()).toBe(1);
  });
});

describe('authentication (Story-002)', () => {
  it('T-017 returns 401 problem+json without a session on GET, PUT and DELETE /:id (AC-6)', async () => {
    const account = await create(alice, 'Savings');
    const url = `/api/accounts/${account.id}`;
    for (const res of [
      await call('GET', url),
      await call('PUT', url, undefined, valid('Other')),
      // The guard runs before validation: an invalid body or id without a session is still 401.
      await call('PUT', url, undefined, { nonsense: true }),
      await call('DELETE', url),
      await call('GET', '/api/accounts/abc'),
    ]) {
      expect(res.statusCode).toBe(401);
      expect(res.headers['content-type']).toContain('application/problem+json');
    }
    expect(rowOf(account.id)).toEqual({ name: 'Savings', type: 'checking', balance: 1000 });
  });

  it('T-017 the item routes are in /docs/json with their responses (AC-6)', async () => {
    const spec = (await app.inject('/docs/json')).json() as {
      paths: Record<string, Record<string, { responses: Record<string, unknown> }>>;
    };
    const item = spec.paths['/api/accounts/{id}'];
    expect(item).toBeDefined();
    expect(Object.keys(item?.get?.responses ?? {})).toEqual(expect.arrayContaining(['200', '400', '401', '404']));
    expect(Object.keys(item?.put?.responses ?? {})).toEqual(expect.arrayContaining(['200', '400', '401', '404', '409']));
    expect(Object.keys(item?.delete?.responses ?? {})).toEqual(expect.arrayContaining(['204', '400', '401', '404', '409']));
    expect(JSON.stringify(item?.delete?.responses['409'])).toContain('application/problem+json');
  });
});
