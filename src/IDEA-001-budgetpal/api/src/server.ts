import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';
import { buildApp } from './app.js';
import { loadConfig, type Config } from './kernel/config.js';
import { openDb } from './kernel/db/index.js';
import { runMigrations } from './kernel/db/migrate.js';

const MIGRATIONS_DIR = fileURLToPath(new URL('../migrations', import.meta.url));

export interface Running {
  app: FastifyInstance;
  db: Database.Database;
  config: Config;
}

export interface StartOptions {
  /** Listen address; defaults to `HOST` or loopback (the container sets `HOST=0.0.0.0`). */
  host?: string;
  migrationsDir?: string;
}

/**
 * Config, database, migrations, app, listen. A migration failure throws before
 * the port is opened, after closing the database handle.
 */
export async function start(
  env: NodeJS.ProcessEnv = process.env,
  options: StartOptions = {},
): Promise<Running> {
  const config = loadConfig(env);
  const db = openDb(config.databasePath);
  try {
    runMigrations(db, options.migrationsDir ?? MIGRATIONS_DIR);
  } catch (error) {
    db.close();
    throw error;
  }
  const app = await buildApp(config, { db });
  await app.listen({ port: config.port, host: options.host ?? env.HOST ?? '127.0.0.1' });
  return { app, db, config };
}

export interface ShutdownHandle {
  shutdown: (signal: string) => Promise<void>;
  /** Removes the signal listeners (tests; the process normally exits instead). */
  dispose: () => void;
}

/** On SIGTERM/SIGINT: stop accepting requests, close the db, exit 0 (1 if closing failed). */
export function registerShutdown(
  app: FastifyInstance,
  db: Database.Database,
  exit: (code: number) => void = (code) => process.exit(code),
): ShutdownHandle {
  let closing = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (closing) return;
    closing = true;
    app.log.info({ signal }, 'shutting down');
    try {
      await app.close();
      db.close();
      exit(0);
    } catch (error) {
      app.log.error({ err: error }, 'shutdown failed');
      exit(1);
    }
  };
  const onTerm = (): void => void shutdown('SIGTERM');
  const onInt = (): void => void shutdown('SIGINT');
  process.on('SIGTERM', onTerm);
  process.on('SIGINT', onInt);
  return {
    shutdown,
    dispose: () => {
      process.off('SIGTERM', onTerm);
      process.off('SIGINT', onInt);
    },
  };
}

async function main(): Promise<void> {
  try {
    const { app, db } = await start();
    registerShutdown(app, db);
  } catch (error) {
    // Config errors name variables only; migration errors name the file. Neither carries secrets.
    process.stderr.write(`startup failed: ${(error as Error).message}\n`);
    process.exit(1);
  }
}

const entry = process.argv[1];
if (entry && realpathSync(entry) === realpathSync(fileURLToPath(import.meta.url))) {
  void main();
}
