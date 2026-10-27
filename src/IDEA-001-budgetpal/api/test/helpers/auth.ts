import type { FastifyInstance } from 'fastify';
import { insertUser } from '../../src/modules/auth/auth.repository.js';
import { SESSION_COOKIE } from '../../src/modules/auth/sessions.js';
import { sessionStoreFor } from '../../src/kernel/require-user.js';

export interface LoggedInUser {
  id: number;
  email: string;
  /** Value of the session cookie. */
  sessionId: string;
  /** `name=value` ready for a `cookie` request header. */
  cookie: string;
  /** `{ cookie }`, for `app.inject({ headers })`. */
  headers: { cookie: string };
}

let counter = 0;

/**
 * Inserts a user and a session straight through the repository and session store (no password
 * hashing, no HTTP). Call it twice for the two users of a cross-user (404) isolation test.
 */
export function createLoggedInUser(app: FastifyInstance, email?: string): LoggedInUser {
  counter += 1;
  const address = email ?? `user${counter}-${Date.now()}@example.test`;
  const user = insertUser(app.db, { email: address, passwordHash: 'not-a-real-hash', now: Date.now() });
  if (!user) throw new Error(`createLoggedInUser: ${address} already exists`);
  const { cookieValue } = sessionStoreFor(app.db).create(user.id);
  const cookie = `${SESSION_COOKIE}=${cookieValue}`;
  return { id: user.id, email: user.email, sessionId: cookieValue, cookie, headers: { cookie } };
}
