import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type Database from 'better-sqlite3';
import { sendProblem } from '../../kernel/errors.js';
import { buildProblem } from '../../kernel/problem.js';
import { insertUser } from './auth.repository.js';
import { hashPassword } from './password.js';
import { SignUpBody, UserResponse, problemContent } from './schemas.js';
import { serializeSessionCookie, type SessionConfig, type SessionStore } from './sessions.js';

export type SignUpResult =
  | { kind: 'created'; user: UserResponse; sessionCookie: string }
  | { kind: 'conflict' };

/**
 * Creates the user with an Argon2id hash and starts a session. The email is unique without regard to
 * letter case (the column is NOCASE), so a duplicate is reported, not written.
 */
export async function signUp(
  db: Database.Database,
  sessions: SessionStore,
  input: SignUpBody,
  now: () => number = Date.now,
): Promise<SignUpResult> {
  const passwordHash = await hashPassword(input.password);
  const user = insertUser(db, { email: input.email, passwordHash, now: now() });
  if (!user) return { kind: 'conflict' };
  const { cookieValue } = sessions.create(user.id);
  return { kind: 'created', user: { id: user.id, email: user.email }, sessionCookie: cookieValue };
}

export interface SignUpDeps {
  sessions: SessionStore;
  config: SessionConfig;
  now?: () => number;
}

/** `POST /api/auth/signup` (public). */
export function registerSignUp(app: FastifyInstance, deps: SignUpDeps): void {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/api/auth/signup',
    {
      schema: {
        summary: 'Create an account and log in',
        tags: ['auth'],
        body: SignUpBody,
        response: {
          201: UserResponse,
          400: problemContent('The email or password is invalid'),
          409: problemContent('The email is already registered'),
        },
      },
    },
    async (request, reply) => {
      const result = await signUp(app.db, deps.sessions, request.body, deps.now);
      if (result.kind === 'conflict') {
        request.log.info({ event: 'auth.signup.conflict' }, 'sign-up refused');
        return sendProblem(
          reply,
          buildProblem(409, 'An account with this email already exists.', { instance: '/api/auth/signup' }),
        );
      }
      request.log.info({ event: 'auth.signup' }, 'user signed up');
      reply.header('set-cookie', serializeSessionCookie(result.sessionCookie, deps.config));
      return reply.status(201).send(result.user);
    },
  );
}
