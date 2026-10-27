import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Writable } from 'node:stream';
import Database from 'better-sqlite3';
import fastifyCookie from '@fastify/cookie';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../app.js';
import { loadConfig } from './config.js';
import { runMigrations } from './db/migrate.js';
import { registerSessionStore, requireUser } from './require-user.js';
import { SESSION_COOKIE, createSessionStore } from '../modules/auth/sessions.js';
import { createLoggedInUser } from '../../test/helpers/auth.js';

const migrationsDir = fileURLToPath(new URL('../../migrations', import.meta.url));
const config = loadConfig({ LOG_LEVEL: 'info' });
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

class Capture extends Writable {
  chunks: string[] = [];
  _write(chunk: Buffer, _enc: BufferEncoding, done: () => void): void {
    this.chunks.push(chunk.toString('utf8'));
    done();
  }
  get text(): string {
    return this.chunks.join('');
  }
}

let db: Database.Database;
let emptyModules: string;
let log: Capture;
let clock: number;
let app: FastifyInstance;
let handler: ReturnType<typeof vi.fn>;

/** App with no modules, a controllable clock and one guarded echo route. */
async function build(
  order: 'cookie-first' | 'route-first' | 'none' = 'none',
  registerStore = true,
): Promise<FastifyInstance> {
  app = await buildApp(config, { db, modulesDir: emptyModules, logStream: log });
  if (registerStore) registerSessionStore(db, createSessionStore(db, config, () => clock));
  if (order === 'cookie-first') await app.register(fastifyCookie);
  app.get('/guarded', { preHandler: requireUser }, async (request) => {
    handler();
    return { id: request.user?.id ?? null };
  });
  if (order === 'route-first') await app.register(fastifyCookie);
  await app.ready();
  return app;
}

beforeEach(() => {
  db = new Database(':memory:');
  runMigrations(db, migrationsDir);
  emptyModules = mkdtempSync(join(tmpdir(), 'budgetpal-nomodules-'));
  log = new Capture();
  clock = 1_800_000_000_000;
  handler = vi.fn();
});
afterEach(async () => {
  await app?.close();
  if (db.open) db.close();
  rmSync(emptyModules, { recursive: true, force: true });
});

describe('requireUser denies by default (Enabler-003 AC-1)', () => {
  it('T-011 answers 401 problem+json and skips the handler without a cookie', async () => {
    await build();
    const res = await app.inject('/guarded');
    expect(res.statusCode).toBe(401);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.json()).toMatchObject({ status: 401, title: 'Unauthorized', instance: '/guarded' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('T-011 answers 401 for an unknown session, a malformed cookie and another cookie name', async () => {
    await build();
    const unknown = randomBytes(32).toString('base64url');
    for (const cookie of [`${SESSION_COOKIE}=${unknown}`, `${SESSION_COOKIE}=not-a-session`, `other=${unknown}`, '%%%']) {
      const res = await app.inject({ url: '/guarded', headers: { cookie } });
      expect(res.statusCode, cookie).toBe(401);
    }
    expect(handler).not.toHaveBeenCalled();
  });

  it('T-011 answers 401 for an expired session (idle, then absolute)', async () => {
    await build();
    const idle = createLoggedInUser(app);
    clock += 24 * HOUR;
    expect((await app.inject({ url: '/guarded', headers: idle.headers })).statusCode).toBe(401);

    const absolute = createLoggedInUser(app);
    const statuses: number[] = [];
    for (let step = 0; step < 40; step += 1) {
      clock += 20 * HOUR; // active at least every 24 h, so only the absolute limit can end it
      statuses.push((await app.inject({ url: '/guarded', headers: absolute.headers })).statusCode);
    }
    expect(statuses[0]).toBe(200);
    expect(statuses.at(-1)).toBe(401);
    expect(statuses.indexOf(401)).toBeGreaterThanOrEqual(35); // 36 x 20 h = 30 days
    expect((db.prepare('SELECT COUNT(*) AS n FROM sessions').get() as { n: number }).n).toBe(0);
  });
});

describe('request.user (Enabler-003 AC-2)', () => {
  it.each(['none', 'cookie-first', 'route-first'] as const)(
    'T-012 sets request.user.id from a valid cookie (cookie plugin order: %s)',
    async (order) => {
      await build(order);
      const user = createLoggedInUser(app);
      const res = await app.inject({ url: '/guarded', headers: user.headers });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ id: user.id });
      expect(handler).toHaveBeenCalledTimes(1);
    },
  );

  it('T-012 falls back to a store built from the environment when the auth module registered none', async () => {
    await build('none', false);
    const user = createLoggedInUser(app);
    const res = await app.inject({ url: '/guarded', headers: user.headers });
    expect(res.json()).toEqual({ id: user.id });
  });

  it('T-012 finds the session among several cookies', async () => {
    await build();
    const user = createLoggedInUser(app);
    const res = await app.inject({ url: '/guarded', headers: { cookie: `theme=dark; ${user.cookie}; a=b` } });
    expect(res.json()).toEqual({ id: user.id });
  });
});

describe('createLoggedInUser helper (Enabler-003 AC-3)', () => {
  it('T-013 returns two distinct users with their own cookies, each seeing only its own id', async () => {
    await build();
    const first = createLoggedInUser(app);
    const second = createLoggedInUser(app, 'second@example.test');
    expect(second.email).toBe('second@example.test');
    expect(first.id).not.toBe(second.id);
    expect(first.cookie).not.toBe(second.cookie);

    const a = await app.inject({ url: '/guarded', headers: first.headers });
    const b = await app.inject({ url: '/guarded', headers: second.headers });
    expect(a.json()).toEqual({ id: first.id });
    expect(b.json()).toEqual({ id: second.id });
  });

  it('T-013 refuses a duplicate email instead of silently reusing the user', async () => {
    await build();
    createLoggedInUser(app, 'dup@example.test');
    expect(() => createLoggedInUser(app, 'DUP@example.test')).toThrow(/already exists/);
  });
});

describe('401 logging (Enabler-003 AC-4)', () => {
  it('T-014 logs the event type and request id, never the cookie value', async () => {
    await build();
    const user = createLoggedInUser(app);
    clock += 30 * DAY; // expired: the guarded call below is denied while carrying a real cookie value
    const unknown = randomBytes(32).toString('base64url');
    await app.inject({ url: '/guarded', headers: user.headers });
    await app.inject({ url: '/guarded', headers: { cookie: `${SESSION_COOKIE}=${unknown}` } });
    await app.inject('/guarded');

    const lines = log.text
      .split('\n')
      .filter((line) => line.trim() !== '')
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    const denied = lines.filter((line) => line.event === 'auth.denied');
    expect(denied).toHaveLength(3);
    for (const line of denied) expect(typeof line.reqId).toBe('string');

    expect(log.text).not.toContain(user.sessionId);
    expect(log.text).not.toContain(unknown);
    expect(log.text).not.toMatch(new RegExp(`${SESSION_COOKIE}=`));
  });
});
