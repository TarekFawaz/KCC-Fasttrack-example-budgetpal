import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Writable } from 'node:stream';
import Fastify, { type FastifyInstance } from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { jsonSchemaTransform, serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import type Database from 'better-sqlite3';
import type { Config } from './kernel/config.js';
import { buildLoggerOptions } from './kernel/log.js';
import { registerErrorHandlers } from './kernel/errors.js';
import { registerModules } from './kernel/modules.js';

// Lets modules attach OpenAPI metadata with `.openapi(...)` on their zod schemas.
extendZodWithOpenApi(z);

declare module 'fastify' {
  interface FastifyInstance {
    /** SQLite handle; reading it throws when the app was built without a database. */
    db: Database.Database;
  }
}

export interface BuildAppOptions {
  db?: Database.Database;
  /** Folder scanned for `<module>/index`; defaults to `modules` next to this file. */
  modulesDir?: string;
  /** Log destination; defaults to stdout. Tests use it to capture log lines. */
  logStream?: Writable;
}

const CSP = "default-src 'self'; frame-ancestors 'none'";

function readVersion(): string {
  const manifest = JSON.parse(
    readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'),
  ) as { version: string };
  return manifest.version;
}

export async function buildApp(config: Config, options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const logger = {
    ...buildLoggerOptions(config),
    ...(options.logStream ? { stream: options.logStream } : {}),
  };
  const app = Fastify({ logger });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  const { db } = options;
  app.decorate('db', {
    getter(): Database.Database {
      if (!db) throw new Error('database is not configured for this app instance');
      return db;
    },
  });

  registerErrorHandlers(app);

  // GR-005: no CORS plugin; the web reaches the api same-origin through the nginx proxy.
  app.addHook('onSend', async (_request, reply, payload) => {
    reply.header('x-content-type-options', 'nosniff');
    reply.header('referrer-policy', 'no-referrer');
    if (!reply.hasHeader('content-security-policy')) reply.header('content-security-policy', CSP);
    return payload;
  });

  await app.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: { title: 'BudgetPal API', version: readVersion() },
    },
    transform: jsonSchemaTransform,
  });
  await app.register(swaggerUi, { routePrefix: '/docs', staticCSP: true });

  await registerModules(app, options.modulesDir ?? fileURLToPath(new URL('./modules', import.meta.url)));

  return app;
}
