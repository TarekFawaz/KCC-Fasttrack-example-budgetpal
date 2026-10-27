import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import { sendProblem } from '../../kernel/errors.js';
import { buildProblem } from '../../kernel/problem.js';
import { requireUser, sessionCookieOf } from '../../kernel/require-user.js';
import { findUserByEmail } from './auth.repository.js';
import { hashPassword, verifyPassword } from './password.js';
import { LoginBody, UserResponse, problemContent } from './schemas.js';
import {
  serializeClearedSessionCookie,
  serializeSessionCookie,
  type SessionConfig,
  type SessionStore,
} from './sessions.js';

/** One message for every failed login, so the response never says which half was wrong (AC-2). */
export const LOGIN_FAILED_MESSAGE = 'Email or password is incorrect.';

export type LoginResult =
  | { kind: 'ok'; user: UserResponse; sessionCookie: string }
  | { kind: 'invalid' };

let decoyHash: Promise<string> | undefined;

/** A real Argon2id hash of a throwaway secret, so an unknown email costs the same time as a wrong password. */
function decoy(): Promise<string> {
  decoyHash ??= hashPassword(randomBytes(24).toString('base64url'));
  return decoyHash;
}

/** Checks the credentials and, when they match, starts a new session. */
export async function logIn(
  db: Database.Database,
  sessions: SessionStore,
  input: LoginBody,
): Promise<LoginResult> {
  const user = findUserByEmail(db, input.email);
  const matches = await verifyPassword(user ? user.password_hash : await decoy(), input.password);
  if (!user || !matches) return { kind: 'invalid' };
  const { cookieValue } = sessions.create(user.id);
  return { kind: 'ok', user: { id: user.id, email: user.email }, sessionCookie: cookieValue };
}

export interface LoginDeps {
  sessions: SessionStore;
  config: SessionConfig;
}

const NoContent = z.null().describe('The session is ended and the cookie cleared.');

/** `POST /api/auth/login` (public), `POST /api/auth/logout` and `GET /api/auth/me` (both behind `requireUser`). */
export function registerLogin(app: FastifyInstance, deps: LoginDeps): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.post(
    '/api/auth/login',
    {
      schema: {
        summary: 'Log in with email and password',
        tags: ['auth'],
        body: LoginBody,
        response: {
          200: UserResponse,
          400: problemContent('The request body is invalid'),
          401: problemContent('The email or password is incorrect'),
        },
      },
    },
    async (request, reply) => {
      const result = await logIn(app.db, deps.sessions, request.body);
      if (result.kind === 'invalid') {
        request.log.info({ event: 'auth.login.failed' }, 'login refused');
        return sendProblem(reply, buildProblem(401, LOGIN_FAILED_MESSAGE, { instance: '/api/auth/login' }));
      }
      request.log.info({ event: 'auth.login' }, 'user logged in');
      reply.header('set-cookie', serializeSessionCookie(result.sessionCookie, deps.config));
      return reply.status(200).send(result.user);
    },
  );

  typed.post(
    '/api/auth/logout',
    {
      preHandler: requireUser,
      schema: {
        summary: 'End the current session',
        tags: ['auth'],
        response: {
          204: NoContent,
          401: problemContent('There is no valid session'),
        },
      },
    },
    async (request, reply) => {
      deps.sessions.delete(sessionCookieOf(request));
      request.log.info({ event: 'auth.logout' }, 'user logged out');
      reply.header('set-cookie', serializeClearedSessionCookie(deps.config));
      return reply.status(204).send(null);
    },
  );

  typed.get(
    '/api/auth/me',
    {
      preHandler: requireUser,
      schema: {
        summary: 'The user of the current session',
        tags: ['auth'],
        response: {
          200: UserResponse,
          401: problemContent('There is no valid session'),
        },
      },
    },
    async (request, reply) => {
      // `requireUser` sets request.user from the session; the email comes from the same session lookup.
      const user = deps.sessions.find(sessionCookieOf(request));
      if (!user) {
        return sendProblem(reply, buildProblem(401, 'Authentication is required.', { instance: '/api/auth/me' }));
      }
      return reply.status(200).send({ id: user.id, email: user.email });
    },
  );
}
