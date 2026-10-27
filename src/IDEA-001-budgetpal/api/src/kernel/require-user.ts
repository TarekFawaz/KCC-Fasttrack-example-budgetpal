import Fastify, { type FastifyReply, type FastifyRequest, type preHandlerAsyncHookHandler } from 'fastify';
import type Database from 'better-sqlite3';
import { fastifyCookie } from '@fastify/cookie';
import { loadConfig } from './config.js';
import { buildProblem } from './problem.js';
import { sendProblem } from './errors.js';
import { SESSION_COOKIE, createSessionStore, type SessionStore } from '../modules/auth/sessions.js';

declare module 'fastify' {
  interface FastifyRequest {
    /** Set by `requireUser` when the session cookie is valid; `undefined` on public routes. */
    user?: { id: number };
  }
}

/** Per-database session store, so every module's guard shares the auth module's timeouts and clock. */
const stores = new WeakMap<Database.Database, SessionStore>();

/** The auth module calls this once per app so the guard uses the store (config, clock) it built. */
export function registerSessionStore(db: Database.Database, store: SessionStore): void {
  stores.set(db, store);
}

/** The registered store, or one built from the environment when the auth module has not registered one. */
export function sessionStoreFor(db: Database.Database): SessionStore {
  let store = stores.get(db);
  if (!store) {
    store = createSessionStore(db, loadConfig());
    stores.set(db, store);
  }
  return store;
}

let primed: Promise<void> | undefined;

/**
 * `@fastify/cookie`'s standalone `parse` works only after the package has loaded its parser, which
 * it does when the plugin is first registered on any instance. A throwaway instance does that once per
 * process, so the guard needs no plugin registration on the app and no particular order.
 */
function primeCookieParser(): Promise<void> {
  primed ??= (async () => {
    const probe = Fastify({ logger: false });
    await probe.register(fastifyCookie);
    await probe.ready();
    await probe.close();
  })();
  return primed;
}

/** Reads the session cookie from the raw header; independent of any cookie-plugin registration order. */
export function sessionCookieOf(request: Pick<FastifyRequest, 'headers'>): string | undefined {
  const header = request.headers.cookie;
  if (!header) return undefined;
  return fastifyCookie.parse(header)[SESSION_COOKIE];
}

function deny(request: FastifyRequest, reply: FastifyReply): FastifyReply {
  // Event type only; the request id is already on every line through the request-scoped logger.
  request.log.info({ event: 'auth.denied' }, 'request denied');
  return sendProblem(
    reply,
    buildProblem(401, 'Authentication is required.', { instance: request.url.split('?')[0] ?? request.url }),
  );
}

/** Deny-by-default guard (D-08) over a given store: 401 problem+json unless the session is valid. */
export function createRequireUser(resolveStore: (request: FastifyRequest) => SessionStore): preHandlerAsyncHookHandler {
  return async function requireUserHandler(request, reply) {
    await primeCookieParser();
    const user = resolveStore(request).find(sessionCookieOf(request));
    if (!user) return deny(request, reply);
    request.user = { id: user.id };
    return undefined;
  };
}

/**
 * Guard for every non-public route: `{ preHandler: requireUser }`. Sets `request.user = { id }`.
 * Handlers must scope every query by that id (GR-002).
 */
export const requireUser: preHandlerAsyncHookHandler = createRequireUser((request) =>
  sessionStoreFor(request.server.db),
);
