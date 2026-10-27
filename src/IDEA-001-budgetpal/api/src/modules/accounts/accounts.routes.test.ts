import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';
import { loadConfig } from '../../kernel/config.js';
import { runMigrations } from '../../kernel/db/migrate.js';
import { createLoggedInUser, type LoggedInUser } from '../../../test/helpers/auth.js';
import { createAccount } from './accounts.service.js';

const migrationsDir = fileURLToPath(new URL('../../../migrations', import.meta.url));
const config = loadConfig({ LOG_LEVEL: 'silent' });

let db: Database.Database;
let app: FastifyInstance;
let alice: LoggedInUser;
let bob: LoggedInUser;

const accountCount = (): number => (db.prepare('SELECT COUNT(*) AS n FROM accounts').get() as { n: number }).n;
const post = (user: LoggedInUser | undefined, payload: unknown) =>
  app.inject({ method: 'POST', url: '/api/accounts', payload: payload as object, ...(user ? { headers: user.headers } : {}) });
const list = (user?: LoggedInUser) =>
  app.inject({ method: 'GET', url: '/api/accounts', ...(user ? { headers: user.headers } : {}) });
const valid = (name: string, extra: object = {}) => ({ name, type: 'checking', openingBalanceMinor: 1000, ...extra });

beforeEach(async () => {
  db = new Database(':memory:');
  runMigrations(db, migrationsDir);
  // The real module folder: accounts must be found and registered by the loader (T-010).
  app = await buildApp(config, { db });
  await app.ready();
  alice = createLoggedInUser(app);
  bob = createLoggedInUser(app);
});
afterEach(async () => {
  await app.close();
  if (db.open) db.close();
});

describe('POST/GET /api/accounts (Story-001)', () => {
  it('T-006 POST valid returns 201 and GET lists it ordered by name (AC-1)', async () => {
    const created = await post(alice, valid('savings', { type: 'savings', openingBalanceMinor: -250 }));
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ name: 'savings', type: 'savings', openingBalanceMinor: -250 });
    await post(alice, { name: 'Cash', type: 'cash' });
    await post(alice, valid('brokerage', { type: 'other' }));

    const res = await list(alice);
    expect(res.statusCode).toBe(200);
    const accounts = res.json() as Array<{ name: string; openingBalanceMinor: number }>;
    expect(accounts.map((a) => a.name)).toEqual(['brokerage', 'Cash', 'savings']);
    expect(accounts.find((a) => a.name === 'Cash')?.openingBalanceMinor).toBe(0);
  });

  it('T-007 POST the same name in another case returns 409 problem+json and adds no row (AC-2)', async () => {
    expect((await post(alice, valid('Savings'))).statusCode).toBe(201);
    const res = await post(alice, valid('  sAVINGS '));
    expect(res.statusCode).toBe(409);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.json()).toMatchObject({ status: 409, errors: [{ field: 'name' }] });
    expect(accountCount()).toBe(1);
    // Another user may use the same name.
    expect((await post(bob, valid('Savings'))).statusCode).toBe(201);
  });

  it.each([
    ['empty name', valid('   '), 'name'],
    ['over-long name', valid('x'.repeat(61)), 'name'],
    ['unknown type', valid('A', { type: 'crypto' }), 'type'],
    ['fractional balance 12.5', valid('A', { openingBalanceMinor: 12.5 }), 'openingBalanceMinor'],
    ['out-of-range balance', valid('A', { openingBalanceMinor: 1_000_000_000_001 }), 'openingBalanceMinor'],
    ['extra field', valid('A', { color: 'red' }), '(body)'],
  ])('T-008 POST %s returns 400 with field errors and writes nothing (AC-3)', async (_label, payload, field) => {
    const res = await post(alice, payload);
    expect(res.statusCode).toBe(400);
    expect(res.headers['content-type']).toContain('application/problem+json');
    const body = res.json() as { errors: Array<{ field: string; message: string }> };
    expect(body.errors.some((e) => e.field === field)).toBe(true);
    expect(accountCount()).toBe(0);
  });

  it('T-009 returns 401 without a session and never lists another user\'s accounts (AC-4)', async () => {
    expect((await post(undefined, valid('A'))).statusCode).toBe(401);
    expect((await list()).statusCode).toBe(401);
    // The guard runs before validation: an invalid body without a session is still 401.
    const res = await post(undefined, { nonsense: true });
    expect(res.statusCode).toBe(401);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(accountCount()).toBe(0);

    await post(alice, valid('Alice only'));
    expect((await list(bob)).json()).toEqual([]);
    expect((await list(alice)).json()).toHaveLength(1);
  });

  it('T-010 the router is auto-registered and both routes are in /docs/json (AC-5)', async () => {
    const spec = (await app.inject('/docs/json')).json() as {
      paths: Record<string, Record<string, { requestBody?: unknown; responses: Record<string, unknown> }>>;
    };
    const path = spec.paths['/api/accounts'];
    expect(path).toBeDefined();
    const postOp = path?.post;
    const getOp = path?.get;
    expect(postOp?.requestBody).toBeDefined();
    expect(Object.keys(postOp?.responses ?? {})).toEqual(expect.arrayContaining(['201', '400', '401', '409']));
    expect(Object.keys(getOp?.responses ?? {})).toEqual(expect.arrayContaining(['200', '401']));
    expect(JSON.stringify(postOp?.responses['201'])).toContain('openingBalanceMinor');
    expect(JSON.stringify(getOp?.responses['200'])).toContain('"type":"array"');
    expect(JSON.stringify(postOp?.responses['409'])).toContain('application/problem+json');
  });

  it('health still answers 200 with the accounts router registered (QG-PROD-1)', async () => {
    expect((await app.inject('/health')).statusCode).toBe(200);
  });
});

describe('accounts service (Story-001)', () => {
  it('T-011 maps DuplicateName to a 409 problem and passes other errors through (AC-2)', () => {
    const input = { name: 'Savings', type: 'savings' as const, openingBalanceMinor: 0 };
    expect(createAccount(db, alice.id, input, '/api/accounts').ok).toBe(true);
    const again = createAccount(db, alice.id, { ...input, name: ' savings' }, '/api/accounts');
    expect(again.ok).toBe(false);
    if (again.ok) return;
    expect(again.problem).toMatchObject({ status: 409, instance: '/api/accounts', errors: [{ field: 'name' }] });

    db.exec('DROP TABLE accounts');
    expect(() => createAccount(db, alice.id, input, '/api/accounts')).toThrow();
  });
});
