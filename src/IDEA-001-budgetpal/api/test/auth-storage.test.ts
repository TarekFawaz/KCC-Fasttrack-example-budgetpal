import { createHash } from 'node:crypto';
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/kernel/config.js';
import { openDb } from '../src/kernel/db/index.js';
import { runMigrations } from '../src/kernel/db/migrate.js';
import { checkPasswordPolicy, hashPassword, verifyPassword } from '../src/modules/auth/password.js';
import { findUserByEmail, insertUser } from '../src/modules/auth/auth.repository.js';
import {
  SESSION_COOKIE,
  createSessionStore,
  serializeClearedSessionCookie,
  serializeSessionCookie,
  sessionCookieOptions,
} from '../src/modules/auth/sessions.js';

const migrationsDir = fileURLToPath(new URL('../migrations', import.meta.url));

let dir: string;
let db: Database.Database;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'budgetpal-auth-'));
  db = openDb(join(dir, 'test.db'));
});
afterEach(() => {
  if (db.open) db.close();
  rmSync(dir, { recursive: true, force: true });
});

const tableNames = (): string[] =>
  (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as { name: string }[]).map(
    (row) => row.name,
  );

describe('migration 0010-auth.sql', () => {
  it('T-005 creates users and sessions via the runner, and a second run is a no-op', () => {
    const first = runMigrations(db, migrationsDir);
    expect(first).toContain('0010-auth.sql');
    expect(tableNames()).toEqual(expect.arrayContaining(['users', 'sessions']));
    const second = runMigrations(db, migrationsDir);
    expect(second).toEqual([]);

    const userColumns = (db.pragma('table_info(users)') as { name: string }[]).map((c) => c.name);
    expect(userColumns).toEqual(['id', 'email', 'password_hash', 'created_at']);
    const sessionColumns = (db.pragma('table_info(sessions)') as { name: string; pk: number }[]).map((c) => c.name);
    expect(sessionColumns).toEqual(['id_hash', 'user_id', 'created_at', 'last_seen_at', 'expires_at']);
  });

  it('T-005 keeps the email unique case-insensitively', () => {
    runMigrations(db, migrationsDir);
    expect(insertUser(db, { email: 'Ann@Example.com', passwordHash: 'h', now: 1 })).toMatchObject({ email: 'Ann@Example.com' });
    expect(insertUser(db, { email: 'ann@example.COM', passwordHash: 'h', now: 2 })).toBeNull();
    expect(findUserByEmail(db, 'ANN@EXAMPLE.COM')?.email).toBe('Ann@Example.com');
    expect((db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n).toBe(1);
  });

  it('T-005 deletes the sessions of a deleted user (foreign key cascade)', () => {
    runMigrations(db, migrationsDir);
    const user = insertUser(db, { email: 'a@b.co', passwordHash: 'h', now: 1 });
    const store = createSessionStore(db, loadConfig({}));
    store.create(user!.id);
    store.create(user!.id);
    expect((db.prepare('SELECT COUNT(*) AS n FROM sessions').get() as { n: number }).n).toBe(2);
    db.prepare('DELETE FROM users WHERE id = ?').run(user!.id);
    expect((db.prepare('SELECT COUNT(*) AS n FROM sessions').get() as { n: number }).n).toBe(0);
  });

  it('T-005 stays in the reserved range, forward-only, and uses no float columns', () => {
    const own = readdirSync(migrationsDir).filter((name) => /^001\d-/.test(name));
    expect(own).toEqual(['0010-auth.sql']);
    const sql = readFileSync(join(migrationsDir, '0010-auth.sql'), 'utf8');
    expect(sql).not.toMatch(/\b(REAL|FLOAT|DOUBLE|DECIMAL|NUMERIC)\b/i);
  });

  it('T-005 applies on top of an existing database with the earlier migrations', () => {
    const copy = join(dir, 'migrations');
    cpSync(migrationsDir, copy, { recursive: true });
    expect(runMigrations(db, copy)).toEqual(['0001-init.sql', '0010-auth.sql']);
  });
});

describe('password hashing', () => {
  it('T-006 produces an Argon2id hash with m=19456 t=2 p=1 that verifies only the same password', async () => {
    const hash = await hashPassword('correct pony battery 42');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(hash).toContain('m=19456,t=2,p=1');
    expect(await verifyPassword(hash, 'correct pony battery 42')).toBe(true);
    expect(await verifyPassword(hash, 'correct pony battery 43')).toBe(false);
  });

  it('T-006 gives a different hash for the same password (random salt) and false for a malformed hash', async () => {
    const [a, b] = await Promise.all([hashPassword('same password twice!'), hashPassword('same password twice!')]);
    expect(a).not.toBe(b);
    expect(await verifyPassword('not-a-hash', 'whatever whatever 1')).toBe(false);
  });
});

describe('password policy', () => {
  it('T-007 rejects 14 and 129 characters', () => {
    expect(checkPasswordPolicy('a'.repeat(13) + 'b')).toMatchObject({ ok: false, reason: 'too-short' });
    expect(checkPasswordPolicy('xy'.repeat(7))).toMatchObject({ ok: false, reason: 'too-short' });
    expect(checkPasswordPolicy('qZ7'.repeat(43))).toMatchObject({ ok: false, reason: 'too-long' }); // 129
    expect(checkPasswordPolicy('qZ7'.repeat(43).slice(0, 128))).toEqual({ ok: true });
  });

  it('T-007 rejects a listed password in any case, and accepts a 15-character phrase with spaces and no symbols', () => {
    expect(checkPasswordPolicy('correcthorsebatterystaple')).toMatchObject({ ok: false, reason: 'common' });
    expect(checkPasswordPolicy('CorrectHorseBatteryStaple')).toMatchObject({ ok: false, reason: 'common' });
    expect(checkPasswordPolicy('blue tea cup now')).toEqual({ ok: true }); // 16, spaces, no symbols
    expect(checkPasswordPolicy('abc def ghi jkl ')).toEqual({ ok: true }); // exactly 16
    expect(checkPasswordPolicy('one two three 15')).toEqual({ ok: true });
    expect(checkPasswordPolicy('a b c d e f g h')).toEqual({ ok: true }); // exactly 15
  });

  it('T-007 counts characters, not bytes', () => {
    expect(checkPasswordPolicy('é'.repeat(15))).toEqual({ ok: true });
    expect(checkPasswordPolicy('😀'.repeat(14))).toMatchObject({ ok: false, reason: 'too-short' });
  });
});

describe('session store', () => {
  const config = loadConfig({});

  function newUser(): number {
    runMigrations(db, migrationsDir);
    return insertUser(db, { email: `u${Math.round(performance.now() * 1000)}@example.com`, passwordHash: 'h', now: 1 })!.id;
  }

  it('T-008 issues a 256-bit cookie value, stores only its SHA-256, and looks the user up by it', () => {
    const userId = newUser();
    const store = createSessionStore(db, config);
    const { cookieValue } = store.create(userId);

    const bytes = Buffer.from(cookieValue, 'base64url');
    expect(bytes.length).toBe(32);
    expect(bytes.toString('base64url')).toBe(cookieValue);

    const rows = db.prepare('SELECT * FROM sessions').all() as { id_hash: string; user_id: number }[];
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id_hash).toBe(createHash('sha256').update(bytes).digest('hex'));
    expect(rows[0]!.id_hash).not.toBe(cookieValue);
    expect(JSON.stringify(rows)).not.toContain(cookieValue);

    expect(store.find(cookieValue)).toMatchObject({ id: userId });
    expect(store.create(userId).cookieValue).not.toBe(cookieValue);
  });

  it('T-008 treats unknown, malformed and empty cookie values as no session', () => {
    newUser();
    const store = createSessionStore(db, config);
    expect(store.find(undefined)).toBeUndefined();
    expect(store.find('')).toBeUndefined();
    expect(store.find('short')).toBeUndefined();
    expect(store.find('A'.repeat(43))).toBeUndefined();
    expect(store.find("x'; DROP TABLE sessions;--")).toBeUndefined();
    expect(store.delete('not-a-session')).toBe(false);
  });

  it('T-008 delete removes the session', () => {
    const userId = newUser();
    const store = createSessionStore(db, config);
    const { cookieValue } = store.create(userId);
    expect(store.delete(cookieValue)).toBe(true);
    expect(store.find(cookieValue)).toBeUndefined();
    expect(store.delete(cookieValue)).toBe(false);
  });

  it('T-009 expires after the idle timeout and after the absolute timeout, and removes the row', () => {
    const userId = newUser();
    let now = 1_000_000;
    const store = createSessionStore(db, config, () => now);
    const hours = (n: number) => n * 3_600_000;

    const idle = store.create(userId).cookieValue;
    now += hours(24) - 1;
    expect(store.find(idle)).toBeDefined();
    now += hours(23); // 23 h since the refresh
    expect(store.find(idle)).toBeDefined();
    now += hours(24) + 1; // past idle
    expect(store.find(idle)).toBeUndefined();
    expect((db.prepare('SELECT COUNT(*) AS n FROM sessions').get() as { n: number }).n).toBe(0);

    const absolute = store.create(userId).cookieValue;
    const start = now;
    for (let step = 1; step < 60; step++) {
      now = start + step * hours(12); // used twice a day, so the idle limit never trips
      expect(store.find(absolute), `step ${step}`).toBeDefined();
    }
    now = start + 30 * hours(24);
    expect(store.find(absolute)).toBeUndefined();
    expect((db.prepare('SELECT COUNT(*) AS n FROM sessions').get() as { n: number }).n).toBe(0);
  });

  it('T-009 refreshes last_seen_at on a valid lookup', () => {
    const userId = newUser();
    let now = 5_000;
    const store = createSessionStore(db, config, () => now);
    const { cookieValue } = store.create(userId);
    now = 9_000;
    store.find(cookieValue);
    const row = db.prepare('SELECT created_at, last_seen_at FROM sessions').get() as { created_at: number; last_seen_at: number };
    expect(row).toEqual({ created_at: 5_000, last_seen_at: 9_000 });
  });

  it('T-009 takes both limits from SESSION_IDLE_HOURS and SESSION_ABSOLUTE_DAYS', () => {
    const userId = newUser();
    const short = loadConfig({ SESSION_IDLE_HOURS: '1', SESSION_ABSOLUTE_DAYS: '2' });
    expect(short.sessionIdleHours).toBe(1);
    expect(short.sessionAbsoluteDays).toBe(2);
    let now = 0;
    const store = createSessionStore(db, short, () => now);
    expect(store.timeouts).toEqual({ idleMs: 3_600_000, absoluteMs: 172_800_000 });

    const idle = store.create(userId).cookieValue;
    now = 3_600_000;
    expect(store.find(idle)).toBeUndefined(); // 1 h idle

    now = 10;
    const kept = store.create(userId).cookieValue;
    for (let step = 1; step <= 57; step++) {
      now = 10 + step * 3_000_000; // every 50 minutes, so the idle limit never trips
      expect(store.find(kept), `step ${step}`).toBeDefined();
    }
    now = 10 + 172_800_000;
    expect(store.find(kept)).toBeUndefined(); // 2 d absolute

    // Shortening the env value applies to a session issued under the longer one.
    now = 0;
    const longStore = createSessionStore(db, loadConfig({ SESSION_IDLE_HOURS: '100', SESSION_ABSOLUTE_DAYS: '30' }), () => now);
    const old = longStore.create(userId).cookieValue;
    now = 172_800_000 - 1;
    expect(longStore.find(old)).toBeDefined();
    now = 172_800_000 + 1000;
    const shortAbsolute = loadConfig({ SESSION_IDLE_HOURS: '100', SESSION_ABSOLUTE_DAYS: '2' });
    expect(createSessionStore(db, shortAbsolute, () => now).find(old)).toBeUndefined();
  });

  it.each([
    ['SESSION_IDLE_HOURS', '0'],
    ['SESSION_IDLE_HOURS', 'soon'],
    ['SESSION_ABSOLUTE_DAYS', '-1'],
    ['SESSION_ABSOLUTE_DAYS', '1.5'],
  ])('T-009 rejects invalid %s=%s and names the variable only', (name, value) => {
    expect(() => loadConfig({ [name]: value })).toThrow(name);
  });
});

describe('session cookie', () => {
  const secureOff = loadConfig({});
  const secureOn = loadConfig({ COOKIE_SECURE: 'true' });

  it('T-010 sets HttpOnly, SameSite=Lax and Path=/, and no Secure by default', () => {
    const header = serializeSessionCookie('abc', secureOff);
    expect(header.startsWith(`${SESSION_COOKIE}=abc;`)).toBe(true);
    expect(header).toMatch(/;\s*HttpOnly(;|$)/);
    expect(header).toContain('SameSite=Lax');
    expect(header).toContain('Path=/');
    expect(header).not.toMatch(/Secure/i);
    expect(header).toContain(`Max-Age=${30 * 86_400}`);
    expect(sessionCookieOptions(secureOff)).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/', secure: false });
  });

  it('T-010 adds Secure only when COOKIE_SECURE is true', () => {
    expect(serializeSessionCookie('abc', secureOn)).toMatch(/;\s*Secure(;|$)/);
    expect(sessionCookieOptions(secureOn).secure).toBe(true);
  });

  it('T-010 clears the cookie with an empty value, Max-Age=0 and the same attributes', () => {
    const header = serializeClearedSessionCookie(secureOn);
    expect(header.startsWith(`${SESSION_COOKIE}=;`)).toBe(true);
    expect(header).toContain('Max-Age=0');
    expect(header).toContain('Expires=Thu, 01 Jan 1970 00:00:00 GMT');
    expect(header).toContain('HttpOnly');
    expect(header).toContain('SameSite=Lax');
    expect(header).toContain('Path=/');
    expect(header).toContain('Secure');
  });
});
