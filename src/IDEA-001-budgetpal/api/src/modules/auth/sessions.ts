import { createHash, randomBytes } from 'node:crypto';
import type Database from 'better-sqlite3';
import type { Config } from '../../kernel/config.js';
import {
  deleteSessionByHash,
  findSessionWithUser,
  insertSession,
  touchSession,
} from './auth.repository.js';

/** Cookie that carries the session id (D-07). */
export const SESSION_COOKIE = 'bp_session';

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const SESSION_ID_BYTES = 32;

export interface SessionUser {
  id: number;
  email: string;
}

export interface SessionTimeouts {
  idleMs: number;
  absoluteMs: number;
}

export type SessionConfig = Pick<Config, 'sessionIdleHours' | 'sessionAbsoluteDays' | 'cookieSecure'>;

export interface CreatedSession {
  /** The cookie value (256 random bits, base64url). Shown to the client once; only its hash is stored. */
  cookieValue: string;
  expiresAt: number;
}

export interface SessionStore {
  create(userId: number): CreatedSession;
  /** The session's user, or `undefined` when absent or expired (an expired row is removed). Refreshes `last_seen_at`. */
  find(cookieValue: string | undefined): SessionUser | undefined;
  /** Returns true when a session was removed. */
  delete(cookieValue: string | undefined): boolean;
  readonly timeouts: SessionTimeouts;
}

export function timeoutsFromConfig(config: Pick<Config, 'sessionIdleHours' | 'sessionAbsoluteDays'>): SessionTimeouts {
  return { idleMs: config.sessionIdleHours * HOUR_MS, absoluteMs: config.sessionAbsoluteDays * DAY_MS };
}

/** SHA-256 (hex) of the decoded 256-bit session id; this is the only form that is stored. */
function hashOf(cookieValue: string): string | undefined {
  const bytes = Buffer.from(cookieValue, 'base64url');
  // Reject anything that is not the canonical encoding of exactly 32 bytes.
  if (bytes.length !== SESSION_ID_BYTES || bytes.toString('base64url') !== cookieValue) return undefined;
  return createHash('sha256').update(bytes).digest('hex');
}

export function createSessionStore(
  db: Database.Database,
  config: Pick<Config, 'sessionIdleHours' | 'sessionAbsoluteDays'>,
  now: () => number = Date.now,
): SessionStore {
  const timeouts = timeoutsFromConfig(config);

  return {
    timeouts,

    create(userId) {
      const cookieValue = randomBytes(SESSION_ID_BYTES).toString('base64url');
      const idHash = hashOf(cookieValue);
      if (!idHash) throw new Error('session id encoding failed');
      const createdAt = now();
      const expiresAt = createdAt + timeouts.absoluteMs;
      insertSession(db, {
        id_hash: idHash,
        user_id: userId,
        created_at: createdAt,
        last_seen_at: createdAt,
        expires_at: expiresAt,
      });
      return { cookieValue, expiresAt };
    },

    find(cookieValue) {
      if (!cookieValue) return undefined;
      const idHash = hashOf(cookieValue);
      if (!idHash) return undefined;
      const row = findSessionWithUser(db, idHash);
      if (!row) return undefined;

      const at = now();
      const idleExpired = at - row.last_seen_at >= timeouts.idleMs;
      // Both the stored deadline and the current env limit apply, so shortening the env value takes effect.
      const absoluteExpired = at >= row.expires_at || at - row.created_at >= timeouts.absoluteMs;
      if (idleExpired || absoluteExpired) {
        deleteSessionByHash(db, idHash);
        return undefined;
      }
      touchSession(db, idHash, at);
      return { id: row.user_id, email: row.email };
    },

    delete(cookieValue) {
      if (!cookieValue) return false;
      const idHash = hashOf(cookieValue);
      return idHash ? deleteSessionByHash(db, idHash) : false;
    },
  };
}

export interface SessionCookieOptions {
  httpOnly: true;
  sameSite: 'lax';
  path: '/';
  secure: boolean;
  /** Seconds. */
  maxAge: number;
}

/** AC-6: HttpOnly, SameSite=Lax, Path=/, and Secure only when `COOKIE_SECURE` is true. */
export function sessionCookieOptions(
  config: Pick<Config, 'cookieSecure' | 'sessionAbsoluteDays'>,
): SessionCookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: config.cookieSecure,
    maxAge: Math.floor((config.sessionAbsoluteDays * DAY_MS) / 1000),
  };
}

function serialize(name: string, value: string, options: SessionCookieOptions, expires?: Date): string {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Max-Age=${options.maxAge}`, `Path=${options.path}`];
  if (expires) parts.push(`Expires=${expires.toUTCString()}`);
  parts.push('HttpOnly', 'SameSite=Lax');
  if (options.secure) parts.push('Secure');
  return parts.join('; ');
}

/** `Set-Cookie` header value that starts the session. */
export function serializeSessionCookie(cookieValue: string, config: SessionConfig): string {
  return serialize(SESSION_COOKIE, cookieValue, sessionCookieOptions(config));
}

/** `Set-Cookie` header value that clears the cookie (empty value, expired). */
export function serializeClearedSessionCookie(config: SessionConfig): string {
  return serialize(SESSION_COOKIE, '', { ...sessionCookieOptions(config), maxAge: 0 }, new Date(0));
}
