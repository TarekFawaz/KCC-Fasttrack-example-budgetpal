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
import { createAuthModule } from './index.js';
import { SignUpBody, UserResponse } from './schemas.js';
import { SESSION_COOKIE, createSessionStore } from './sessions.js';
import { signUp } from './signup.js';

const migrationsDir = fileURLToPath(new URL('../../../migrations', import.meta.url));
const PASSWORD = 'a long enough pass phrase';
const OTHER_PASSWORD = 'another long enough phrase';

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

async function build(env: Record<string, string> = {}): Promise<FastifyInstance> {
  const config = loadConfig({ LOG_LEVEL: 'info', ...env });
  app = await buildApp(config, { db, modulesDir: emptyModules, logStream: log });
  await app.register(createAuthModule({ config }));
  await app.ready();
  return app;
}

const userCount = (): number => (db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n;
const signup = (payload: unknown) => app.inject({ method: 'POST', url: '/api/auth/signup', payload: payload as object });

beforeEach(() => {
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

describe('sign-up service (Story-001 AC-1)', () => {
  it('T-015 stores an $argon2id$ hash and returns {id,email}', async () => {
    const sessions = createSessionStore(db, loadConfig({}));
    const result = await signUp(db, sessions, { email: 'ann@example.test', password: PASSWORD });
    expect(result.kind).toBe('created');
    if (result.kind !== 'created') return;
    expect(result.user).toEqual({ id: expect.any(Number), email: 'ann@example.test' });
    const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(result.user.id) as { password_hash: string };
    expect(row.password_hash.startsWith('$argon2id$')).toBe(true);
    expect(row.password_hash).not.toContain(PASSWORD);
    expect(sessions.find(result.sessionCookie)).toMatchObject({ id: result.user.id });
  });

  it('T-015 reports a case-insensitive duplicate as a conflict without a second row or session', async () => {
    const sessions = createSessionStore(db, loadConfig({}));
    await signUp(db, sessions, { email: 'ann@example.test', password: PASSWORD });
    const again = await signUp(db, sessions, { email: 'ANN@Example.test', password: OTHER_PASSWORD });
    expect(again).toEqual({ kind: 'conflict' });
    expect(userCount()).toBe(1);
    expect((db.prepare('SELECT COUNT(*) AS n FROM sessions').get() as { n: number }).n).toBe(1);
  });
});

describe('POST /api/auth/signup (Story-001 AC-1)', () => {
  it('T-016 answers 201 {id,email}, sets the session cookie and stores an $argon2id$ hash', async () => {
    await build();
    const res = await signup({ email: 'ann@example.test', password: PASSWORD });
    expect(res.statusCode).toBe(201);
    const body = res.json() as { id: number; email: string };
    expect(Object.keys(body).sort()).toEqual(['email', 'id']);
    expect(body.email).toBe('ann@example.test');

    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toMatch(new RegExp(`^${SESSION_COOKIE}=[A-Za-z0-9_-]{43};`));
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).not.toContain('Secure');

    const row = db.prepare('SELECT id, password_hash FROM users').get() as { id: number; password_hash: string };
    expect(row.id).toBe(body.id);
    expect(row.password_hash.startsWith('$argon2id$')).toBe(true);
    expect((db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?').get(body.id) as { n: number }).n).toBe(1);
  });

  it('T-016 marks the cookie Secure when COOKIE_SECURE is true', async () => {
    await build({ COOKIE_SECURE: 'true' });
    const res = await signup({ email: 'ann@example.test', password: PASSWORD });
    expect(String(res.headers['set-cookie'])).toContain('Secure');
  });
});

describe('request validation (Story-001 AC-2)', () => {
  it('T-017 rejects an invalid email, a 14-character and a listed password and an extra field with field names', () => {
    const fieldsOf = (input: unknown): string[] => {
      const result = SignUpBody.safeParse(input);
      return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'));
    };
    expect(SignUpBody.safeParse({ email: 'ann@example.test', password: PASSWORD }).success).toBe(true);
    expect(fieldsOf({ email: 'not-an-email', password: PASSWORD })).toEqual(['email']);
    expect(fieldsOf({ email: 'ann@example.test', password: 'a'.repeat(14) })).toEqual(['password']);
    expect(fieldsOf({ email: 'ann@example.test', password: 'correcthorsebatterystaple' })).toEqual(['password']);
    const extra = SignUpBody.safeParse({ email: 'ann@example.test', password: PASSWORD, admin: true });
    expect(extra.success).toBe(false);
    if (!extra.success) expect(extra.error.issues[0]).toMatchObject({ code: 'unrecognized_keys', keys: ['admin'] });
    expect(fieldsOf({})).toEqual(['email', 'password']);
  });

  it('T-017 shapes the user response from {id,email} only', () => {
    expect(Object.keys(UserResponse.shape).sort()).toEqual(['email', 'id']);
  });

  it('T-018 answers 400 problem+json with errors[] and writes no row', async () => {
    await build();
    const cases: Array<[unknown, string, string?]> = [
      [{ email: 'nope', password: PASSWORD }, 'email'],
      [{ email: 'ann@example.test', password: 'a'.repeat(14) }, 'password'],
      [{ email: 'ann@example.test', password: 'a'.repeat(129) }, 'password'],
      [{ email: 'ann@example.test', password: 'passwordpassword' }, 'password'],
      [{ email: 'ann@example.test', password: PASSWORD, role: 'admin' }, '(body)', 'role'],
      [{ email: 'ann@example.test' }, 'password'],
    ];
    for (const [payload, field, mention] of cases) {
      const res = await signup(payload);
      expect(res.statusCode, JSON.stringify(payload)).toBe(400);
      expect(res.headers['content-type']).toContain('application/problem+json');
      const body = res.json() as { status: number; errors: Array<{ field: string; message: string }> };
      expect(body.status).toBe(400);
      expect(body.errors.map((error) => error.field)).toContain(field);
      expect(body.errors.every((error) => error.message.length > 0)).toBe(true);
      if (mention) expect(body.errors.map((error) => error.message).join()).toContain(mention);
    }
    expect(userCount()).toBe(0);
    expect((db.prepare('SELECT COUNT(*) AS n FROM sessions').get() as { n: number }).n).toBe(0);
  });

  it('T-018 answers 400 for a missing body and for a non-object body', async () => {
    await build();
    expect((await app.inject({ method: 'POST', url: '/api/auth/signup' })).statusCode).toBe(400);
    const notObject = await app.inject({
      method: 'POST',
      url: '/api/auth/signup',
      headers: { 'content-type': 'application/json' },
      payload: '"just a string"',
    });
    expect(notObject.statusCode).toBe(400);
    expect(notObject.headers['content-type']).toContain('application/problem+json');
    expect(userCount()).toBe(0);
  });
});

describe('duplicate email (Story-001 AC-3)', () => {
  it('T-019 answers 409 for the same email in a different case and keeps one row', async () => {
    await build();
    expect((await signup({ email: 'Ann@Example.test', password: PASSWORD })).statusCode).toBe(201);
    const res = await signup({ email: 'ann@EXAMPLE.test', password: OTHER_PASSWORD });
    expect(res.statusCode).toBe(409);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.headers['set-cookie']).toBeUndefined();
    expect(userCount()).toBe(1);
  });
});

describe('secrets stay out of responses and logs (Story-001 AC-4)', () => {
  it('T-020 the response schema has neither a password nor a hash key', () => {
    const parsed = UserResponse.parse({ id: 1, email: 'a@b.co', password: 'x', password_hash: 'y' });
    expect(parsed).toEqual({ id: 1, email: 'a@b.co' });
    expect(Object.keys(UserResponse.shape)).not.toContain('password');
    expect(Object.keys(UserResponse.shape).join()).not.toMatch(/hash/i);
  });

  it('T-021 neither the body nor the log lines of sign-up (201, 400, 409) hold the password or the hash', async () => {
    await build();
    const created = await signup({ email: 'ann@example.test', password: PASSWORD });
    const conflict = await signup({ email: 'ann@example.test', password: OTHER_PASSWORD });
    const invalid = await signup({ email: 'bad', password: 'tooshort' });
    const hash = (db.prepare('SELECT password_hash FROM users').get() as { password_hash: string }).password_hash;

    for (const res of [created, conflict, invalid]) {
      expect(res.body).not.toContain(PASSWORD);
      expect(res.body).not.toContain(OTHER_PASSWORD);
      expect(res.body).not.toContain('tooshort');
      expect(res.body).not.toContain(hash);
      expect(res.body).not.toMatch(/\$argon2/);
    }
    for (const secret of [PASSWORD, OTHER_PASSWORD, 'tooshort', hash, '$argon2', String(created.headers['set-cookie']).split(';')[0]!.split('=')[1]!]) {
      expect(log.text, secret).not.toContain(secret);
    }
    expect(log.text).toContain('auth.signup');
  });
});

describe('OpenAPI (Story-001 AC-5)', () => {
  it('T-022 lists POST /api/auth/signup with 201, 400 and 409 responses', async () => {
    await build();
    const spec = (await app.inject('/docs/json')).json() as {
      paths: Record<string, { post?: { responses: Record<string, { content?: Record<string, unknown> }> } }>;
    };
    const responses = spec.paths['/api/auth/signup']?.post?.responses;
    expect(Object.keys(responses ?? {}).sort()).toEqual(['201', '400', '409']);
    expect(Object.keys(responses?.['400']?.content ?? {})).toEqual(['application/problem+json']);
    expect(Object.keys(responses?.['409']?.content ?? {})).toEqual(['application/problem+json']);
  });

  it('T-022 the module loader registers the auth module (default export) and serves the route', async () => {
    const config = loadConfig({ LOG_LEVEL: 'silent' });
    app = await buildApp(config, { db });
    await app.ready();
    const res = await signup({ email: 'loader@example.test', password: PASSWORD });
    expect(res.statusCode).toBe(201);
    expect(((await app.inject('/docs/json')).json() as { paths: object }).paths).toHaveProperty('/api/auth/signup');
  });
});
