import type { FastifyPluginAsync } from 'fastify';
import { loadConfig, type Config } from '../../kernel/config.js';
import { registerProblemHandler } from '../../kernel/problem.js';
import { registerSessionStore } from '../../kernel/require-user.js';
import { createSessionStore } from './sessions.js';
import { registerSignUp } from './signup.js';

export interface AuthModuleOptions {
  /** Defaults to the environment; tests pass their own. */
  config?: Config;
  /** Clock for sessions (milliseconds); defaults to `Date.now`. */
  now?: () => number;
}

/** Auth module factory; the default export below is what the module loader registers. */
export function createAuthModule(options: AuthModuleOptions = {}): FastifyPluginAsync {
  return async (app) => {
    const config = options.config ?? loadConfig();
    const sessions = createSessionStore(app.db, config, options.now);
    // The shared guard (`requireUser`) reads the same store, so timeouts and clock match everywhere.
    registerSessionStore(app.db, sessions);
    registerProblemHandler(app);

    registerSignUp(app, { sessions, config, now: options.now });
  };
}

export default createAuthModule();
