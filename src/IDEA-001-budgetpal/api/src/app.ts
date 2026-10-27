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

type SchemaTransform = typeof jsonSchemaTransform;

/** A response declared per media type: `{ description?, content: { '<media type>': { schema: <zod> } } }`. */
interface ContentResponse {
  description?: string;
  content: Record<string, { schema: unknown }>;
}

function isContentResponse(value: unknown): value is ContentResponse {
  if (typeof value !== 'object' || value === null || 'safeParse' in value) return false;
  const { content } = value as { content?: unknown };
  return typeof content === 'object' && content !== null;
}

function zodToJsonSchema(schema: unknown): unknown {
  // The provider's own converter, reached through its public transform; the URL is a neutral one
  // so the provider's skip list never applies.
  const converted = jsonSchemaTransform({ schema: { response: { 200: schema } }, url: '/' });
  return (converted.schema.response as Record<string, unknown>)['200'];
}

/**
 * `jsonSchemaTransform` accepts only bare zod schemas as responses, which documents every response
 * under `application/json`. This wrapper also accepts the fastify-native per-media-type form
 * (`503: { description, content: { 'application/problem+json': { schema: <zod> } } }`), so an error
 * response is documented under the media type it really returns. Bare zod responses are unchanged.
 */
const jsonSchemaTransformWithContent: SchemaTransform = (input) => {
  const response = input.schema?.response as Record<string, unknown> | undefined;
  const contentStatuses = Object.keys(response ?? {}).filter((status) => isContentResponse(response?.[status]));
  if (!response || contentStatuses.length === 0) return jsonSchemaTransform(input);

  const bare = Object.fromEntries(Object.entries(response).filter(([status]) => !contentStatuses.includes(status)));
  const base = jsonSchemaTransform({ ...input, schema: { ...input.schema, response: bare } });
  if (base.schema.hide) return base;

  const responses: Record<string, unknown> = { ...(base.schema.response as Record<string, unknown> | undefined) };
  for (const status of contentStatuses) {
    const { description, content } = response[status] as ContentResponse;
    responses[status] = {
      ...(description === undefined ? {} : { description }),
      content: Object.fromEntries(
        Object.entries(content).map(([mediaType, entry]) => [mediaType, { schema: zodToJsonSchema(entry.schema) }]),
      ),
    };
  }
  return { schema: { ...base.schema, response: responses }, url: base.url };
};

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
    transform: jsonSchemaTransformWithContent,
  });
  await app.register(swaggerUi, { routePrefix: '/docs', staticCSP: true });

  await registerModules(app, options.modulesDir ?? fileURLToPath(new URL('./modules', import.meta.url)));

  return app;
}
