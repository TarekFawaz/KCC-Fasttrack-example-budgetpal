import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Writable } from 'node:stream';
import Database from 'better-sqlite3';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';
import { loadConfig } from '../../kernel/config.js';
import { runMigrations } from '../../kernel/db/migrate.js';
import { createLoggedInUser } from '../../../test/helpers/auth.js';
import { createAuthModule } from './index.js';
import { LOGIN_FAILED_MESSAGE } from './login.js';
import { SESSION_COOKIE } from './sessions.js';

const migrationsDir = fileURLToPath(new URL('../../../migrations', import.meta.url));
const PASSWORD = 'a long enough pass phrase';
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
let app: FastifyInstance;
let clock: number;

async function build(env: Record<string, string> = {}): Promise<FastifyInstance> {
  const config = loadConfig({ LOG_LEVEL: 'info', ...env });
  app = await buildApp(config, { db, modulesDir: emptyModules, logStream: log });
  await app.register(createAuthModule({ config, now: () => clock }));
  await app.ready();
  return app;
}

const post = (url: string, payload?: unknown, headers: Record<string, string> = {}) =>
  app.inject({ method: 'POST', url, headers, ...(payload === undefined ? {} : { payload: payload as object }) });
const me = (headers: Record<string, string> = {}) => app.inject({ method: 'GET', url: '/api/auth/me', headers });
const sessionCount = (): number => (db.prepare('SELECT COUNT(*) AS n FROM sessions').get() as { n: number }).n;

/** Registers a user through the real endpoint, then drops the sign-up session so login starts clean. */
async function registerUser(email: string, password = PASSWORD): Promise<void> {
  const res = await post('/api/auth/signup', { email, password });
  expect(res.statusCode).toBe(201);
  db.prepare('DELETE FROM sessions').run();
}

function cookieValueOf(setCookie: unknown): string {
  return String(setCookie).split(';')[0]!.split('=')[1]!;
}

beforeEach(() => {
  clock = Date.UTC(2026, 0, 1);
  db = new Database(':memory:');
  runMigrations(db, migrationsDir);
  emptyModules = mkdtempSync(join(tmpdir(), 'budgetpal-nomodules-'));
  log = new Capture();
});
afterEach(async () => {
  await app?.close();
  if (db.open) db.close();
  rmSync(emptyModules, { recursive: true, force: true });
});

describe('POST /api/auth/login (Story-002 AC-1)', () => {
  it('T-023 answers 200 {id,email}, sets a new HttpOnly SameSite=Lax Path=/ cookie without Secure and stores a session', async () => {
    await build();
    await registerUser('ann@example.test');
    const res = await post('/api/auth/login', { email: 'ann@example.test', password: PASSWORD });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { id: number; email: string };
    expect(Object.keys(body).sort()).toEqual(['email', 'id']);
    expect(body.email).toBe('ann@example.test');

    const attributes = String(res.headers['set-cookie']).split(';').map((part) => part.trim());
    expect(attributes[0]).toMatch(new RegExp(`^${SESSION_COOKIE}=[A-Za-z0-9_-]{43}$`));
    expect(attributes).toContain('HttpOnly');
    expect(attributes).toContain('SameSite=Lax');
    expect(attributes).toContain('Path=/');
    expect(attributes).not.toContain('Secure');
    expect(sessionCount()).toBe(1);
  });

  it('T-023 matches the email without regard to letter case and gives each login its own session', async () => {
    await build();
    await registerUser('Ann@Example.test');
    const first = await post('/api/auth/login', { email: 'ann@example.TEST', password: PASSWORD });
    const second = await post('/api/auth/login', { email: 'ann@example.test', password: PASSWORD });
    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(cookieValueOf(first.headers['set-cookie'])).not.toBe(cookieValueOf(second.headers['set-cookie']));
    expect(sessionCount()).toBe(2);
  });

  it('T-023 marks the cookie Secure when COOKIE_SECURE is true', async () => {
    await build({ COOKIE_SECURE: 'true' });
    await registerUser('ann@example.test');
    const res = await post('/api/auth/login', { email: 'ann@example.test', password: PASSWORD });
    expect(res.statusCode).toBe(200);
    expect(String(res.headers['set-cookie']).split(';').map((part) => part.trim())).toContain('Secure');
  });

  it('T-023 answers 400 problem+json for a malformed body and starts no session', async () => {
    await build();
    for (const payload of [{ email: 'ann@example.test' }, { email: '', password: PASSWORD }, { email: 'a@b.co', password: PASSWORD, extra: 1 }]) {
      const res = await post('/api/auth/login', payload);
      expect(res.statusCode, JSON.stringify(payload)).toBe(400);
      expect(res.headers['content-type']).toContain('application/problem+json');
    }
    expect(sessionCount()).toBe(0);
  });
});

describe('failed login (Story-002 AC-2)', () => {
  it('T-024 gives a wrong password and an unknown email the same 401 message and no cookie', async () => {
    await build();
    await registerUser('ann@example.test');
    const wrongPassword = await post('/api/auth/login', { email: 'ann@example.test', password: 'not the right pass phrase' });
    const unknownEmail = await post('/api/auth/login', { email: 'nobody@example.test', password: PASSWORD });

    for (const res of [wrongPassword, unknownEmail]) {
      expect(res.statusCode).toBe(401);
      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(res.headers['set-cookie']).toBeUndefined();
    }
    const [a, b] = [wrongPassword.json() as Record<string, unknown>, unknownEmail.json() as Record<string, unknown>];
    expect(a.detail).toBe(LOGIN_FAILED_MESSAGE);
    expect(b.detail).toBe(LOGIN_FAILED_MESSAGE);
    expect(wrongPassword.body).toBe(unknownEmail.body);
    expect(sessionCount()).toBe(0);
  });
});

describe('logout (Story-002 AC-3)', () => {
  it('T-025 deletes the session row, clears the cookie and makes the old cookie a 401 on me', async () => {
    await build();
    await registerUser('ann@example.test');
    const login = await post('/api/auth/login', { email: 'ann@example.test', password: PASSWORD });
    const cookie = `${SESSION_COOKIE}=${cookieValueOf(login.headers['set-cookie'])}`;
    expect((await me({ cookie })).statusCode).toBe(200);
    expect(sessionCount()).toBe(1);

    const out = await post('/api/auth/logout', undefined, { cookie });
    expect(out.statusCode).toBe(204);
    expect(sessionCount()).toBe(0);
    const cleared = String(out.headers['set-cookie']);
    expect(cleared).toContain(`${SESSION_COOKIE}=;`);
    expect(cleared).toContain('Max-Age=0');
    expect(cleared).toContain('HttpOnly');
    expect(cleared).toContain('Path=/');

    const after = await me({ cookie });
    expect(after.statusCode).toBe(401);
    expect(after.headers['content-type']).toContain('application/problem+json');
  });

  it('T-025 logout without a session is 401 and sets no cookie', async () => {
    await build();
    const res = await post('/api/auth/logout');
    expect(res.statusCode).toBe(401);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('T-025 logout ends only the calling session', async () => {
    await build();
    const first = createLoggedInUser(app, 'ann@example.test');
    const second = createLoggedInUser(app, 'bob@example.test');
    expect((await post('/api/auth/logout', undefined, first.headers)).statusCode).toBe(204);
    expect((await me(first.headers)).statusCode).toBe(401);
    expect((await me(second.headers)).statusCode).toBe(200);
  });
});

describe('me (Story-002 AC-4)', () => {
  it('T-026 returns only the session user to each of two users, and 401 without a cookie', async () => {
    await build();
    const ann = createLoggedInUser(app, 'ann@example.test');
    const bob = createLoggedInUser(app, 'bob@example.test');

    const annRes = await me(ann.headers);
    const bobRes = await me(bob.headers);
    expect(annRes.json()).toEqual({ id: ann.id, email: 'ann@example.test' });
    expect(bobRes.json()).toEqual({ id: bob.id, email: 'bob@example.test' });
    expect(annRes.body).not.toContain('bob@example.test');
    expect(bobRes.body).not.toContain('ann@example.test');

    const anonymous = await me();
    expect(anonymous.statusCode).toBe(401);
    expect(anonymous.headers['content-type']).toContain('application/problem+json');
    expect((await me({ cookie: `${SESSION_COOKIE}=garbage` })).statusCode).toBe(401);
  });
});

describe('session timeouts (Story-002 AC-5)', () => {
  it('T-027 answers 401 on me past the idle timeout and past the absolute timeout', async () => {
    await build();
    const idle = createLoggedInUser(app, 'idle@example.test');
    clock += 24 * HOUR + 1;
    expect((await me(idle.headers)).statusCode).toBe(401);

    // Active use keeps a session alive past the idle limit, but never past the absolute one.
    const busy = createLoggedInUser(app, 'busy@example.test');
    for (let day = 1; day <= 29; day += 1) {
      clock += DAY - HOUR;
      expect((await me(busy.headers)).statusCode, `day ${day}`).toBe(200);
    }
    clock += 2 * DAY;
    expect((await me(busy.headers)).statusCode).toBe(401);
    expect(sessionCount()).toBe(0);
  });

  it('T-027 honours SESSION_IDLE_HOURS from the environment', async () => {
    await build({ SESSION_IDLE_HOURS: '1' });
    const user = createLoggedInUser(app, 'ann@example.test');
    clock += HOUR - 1;
    expect((await me(user.headers)).statusCode).toBe(200);
    clock += HOUR;
    expect((await me(user.headers)).statusCode).toBe(401);
  });
});

describe('logs (Story-002 AC-6)', () => {
  it('T-028 login and logout lines hold the event type and request id but no password, cookie or hash', async () => {
    await build();
    await registerUser('ann@example.test');
    const failed = await post('/api/auth/login', { email: 'ann@example.test', password: 'not the right pass phrase' });
    const login = await post('/api/auth/login', { email: 'ann@example.test', password: PASSWORD });
    const value = cookieValueOf(login.headers['set-cookie']);
    await post('/api/auth/logout', undefined, { cookie: `${SESSION_COOKIE}=${value}` });
    const hash = (db.prepare('SELECT password_hash FROM users').get() as { password_hash: string }).password_hash;

    for (const secret of [PASSWORD, 'not the right pass phrase', value, hash, '$argon2']) {
      expect(log.text, secret).not.toContain(secret);
    }
    for (const res of [failed, login]) {
      expect(res.body).not.toContain(PASSWORD);
      expect(res.body).not.toContain(hash);
    }

    const lines = log.text
      .split('\n')
      .filter((line) => line.trim() !== '')
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    const events = lines.filter((line) => typeof line.event === 'string');
    expect(events.map((line) => line.event)).toEqual(
      expect.arrayContaining(['auth.login.failed', 'auth.login', 'auth.logout']),
    );
    for (const line of events) expect(line.reqId ?? line.req_id ?? line.requestId ?? line.req).toBeDefined();
  });
});

describe('OpenAPI (Story-002 AC-1)', () => {
  it('T-029 lists login, logout and me with their status codes', async () => {
    await build();
    const spec = (await app.inject('/docs/json')).json() as {
      paths: Record<string, Record<string, { responses: Record<string, { content?: Record<string, unknown> }> }>>;
    };
    const codes = (path: string, verb: string): string[] =>
      Object.keys(spec.paths[path]?.[verb]?.responses ?? {}).sort();
    expect(codes('/api/auth/login', 'post')).toEqual(['200', '400', '401']);
    expect(codes('/api/auth/logout', 'post')).toEqual(['204', '401']);
    expect(codes('/api/auth/me', 'get')).toEqual(['200', '401']);
    expect(Object.keys(spec.paths['/api/auth/login']?.post?.responses['401']?.content ?? {})).toEqual([
      'application/problem+json',
    ]);
  });
});
