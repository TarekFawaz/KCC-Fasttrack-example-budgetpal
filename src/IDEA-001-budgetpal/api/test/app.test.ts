import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Writable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/kernel/config.js';

class Capture extends Writable {
  chunks: string[] = [];
  _write(chunk: Buffer, _enc: BufferEncoding, done: () => void): void {
    this.chunks.push(chunk.toString('utf8'));
    done();
  }
  get text(): string {
    return this.chunks.join('');
  }
  get lines(): Array<Record<string, unknown>> {
    return this.text
      .split('\n')
      .filter((line) => line.trim() !== '')
      .map((line) => JSON.parse(line) as Record<string, unknown>);
  }
}

let workDir: string;
let modulesDir: string;
let log: Capture;
let app: FastifyInstance;

const config = loadConfig({ LOG_LEVEL: 'info' });

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), 'budgetpal-app-'));
  modulesDir = join(workDir, 'modules');
  mkdirSync(modulesDir);
  log = new Capture();
});

afterEach(async () => {
  await app?.close();
  rmSync(workDir, { recursive: true, force: true });
});

async function build(): Promise<FastifyInstance> {
  app = await buildApp(config, { modulesDir, logStream: log });
  return app;
}

function addModule(name: string, source: string, file = 'index.mjs'): void {
  mkdirSync(join(modulesDir, name));
  writeFileSync(join(modulesDir, name, file), source);
}

describe('request logging (Enabler-002 AC-2)', () => {
  it('T-007 writes single-line JSON with a request id and no cookie, authorization or body', async () => {
    const instance = await build();
    instance.withTypeProvider<ZodTypeProvider>().post(
      '/echo',
      { schema: { body: z.object({ note: z.string() }), response: { 200: z.object({ ok: z.boolean() }) } } },
      async () => ({ ok: true }),
    );
    await instance.ready();

    const response = await instance.inject({
      method: 'POST',
      url: '/echo?token=query-secret',
      headers: { cookie: 'sid=cookie-secret-value', authorization: 'Bearer auth-secret-value' },
      payload: { note: 'body-secret-value' },
    });
    expect(response.statusCode).toBe(200);

    const text = log.text;
    expect(text.trim().length).toBeGreaterThan(0);
    for (const line of text.trim().split('\n')) {
      expect(() => JSON.parse(line)).not.toThrow();
    }
    expect(log.lines.some((entry) => typeof entry.reqId === 'string' && entry.reqId.length > 0)).toBe(true);
    for (const secret of ['cookie-secret-value', 'auth-secret-value', 'body-secret-value', 'query-secret']) {
      expect(text).not.toContain(secret);
    }
  });
});

describe('module auto-registration (Enabler-002 AC-3)', () => {
  it('T-008 registers a module folder without editing app.ts and skips one without an index', async () => {
    addModule('ping', "export default async function (app) { app.get('/ping', async () => ({ pong: true })); }\n");
    mkdirSync(join(modulesDir, 'empty'));
    writeFileSync(join(modulesDir, 'empty', 'notes.txt'), 'no index here');

    const instance = await build();
    const response = await instance.inject({ method: 'GET', url: '/ping' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ pong: true });

    const warning = log.lines.find((entry) => entry.level === 40 && entry.module === 'empty');
    expect(warning).toBeDefined();
    expect(String(warning?.msg)).toContain('skipped');
  });

  it('T-008 starts when the modules folder does not exist yet', async () => {
    rmSync(modulesDir, { recursive: true });
    const instance = await build();
    expect((await instance.inject({ method: 'GET', url: '/docs/json' })).statusCode).toBe(200);
  });

  it('T-008 skips a module whose index has no default plugin export', async () => {
    addModule('broken', 'export const notAPlugin = 1;\n');
    await build();
    expect(log.lines.some((entry) => entry.level === 40 && entry.module === 'broken')).toBe(true);
  });
});

describe('error bodies (Enabler-002 AC-4)', () => {
  beforeEach(() => {
    addModule(
      'boom',
      [
        "import { z } from 'zod';",
        'export default async function (app) {',
        "  app.get('/boom', async () => { throw new Error('secret internal detail'); });",
        "  app.get('/teapot', async () => { const e = new Error('short and stout'); e.statusCode = 418; throw e; });",
        "  app.post('/items', { schema: { body: z.object({ name: z.string().min(1), qty: z.number().int() }) } }, async () => ({ ok: true }));",
        '}',
        '',
      ].join('\n'),
    );
  });

  it('T-009 answers an unknown route with 404 problem+json', async () => {
    const instance = await build();
    const response = await instance.inject({ method: 'GET', url: '/nope?x=1' });
    expect(response.statusCode).toBe(404);
    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(response.json()).toMatchObject({ status: 404, title: 'Not Found', instance: '/nope' });
  });

  it('T-009 answers an invalid body with 400 problem+json and field errors', async () => {
    const instance = await build();
    const response = await instance.inject({ method: 'POST', url: '/items', payload: { name: '', qty: 1.5 } });
    expect(response.statusCode).toBe(400);
    expect(response.headers['content-type']).toContain('application/problem+json');
    const body = response.json() as { status: number; errors: Array<{ field: string; message: string }> };
    expect(body.status).toBe(400);
    expect(body.errors.map((entry) => entry.field).sort()).toEqual(['name', 'qty']);
    expect(body.errors.every((entry) => entry.message.length > 0)).toBe(true);
  });

  it('T-009 answers a thrown error with a generic 500 problem+json and no stack', async () => {
    const instance = await build();
    const response = await instance.inject({ method: 'GET', url: '/boom' });
    expect(response.statusCode).toBe(500);
    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(response.body).not.toContain('secret internal detail');
    expect(response.body).not.toMatch(/\bat .*\(.*:\d+:\d+\)/);
    expect(response.json()).toMatchObject({ status: 500, detail: 'An unexpected error occurred.' });
    expect(response.json()).not.toHaveProperty('stack');
    // The cause is logged for operators instead.
    expect(log.text).toContain('secret internal detail');
  });

  it('T-009 passes a deliberate 4xx through as problem+json', async () => {
    const instance = await build();
    const response = await instance.inject({ method: 'GET', url: '/teapot' });
    expect(response.statusCode).toBe(418);
    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(response.json()).toMatchObject({ status: 418, detail: 'short and stout' });
  });
});

describe('response headers (Enabler-002 AC-5)', () => {
  it('T-010 sets nosniff, referrer policy and a self-only CSP and no CORS header', async () => {
    addModule('ping', "export default async function (app) { app.get('/ping', async () => ({ pong: true })); }\n");
    const instance = await build();
    for (const url of ['/ping', '/missing']) {
      const response = await instance.inject({ method: 'GET', url, headers: { origin: 'https://evil.example' } });
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['referrer-policy']).toBe('no-referrer');
      expect(String(response.headers['content-security-policy'])).toContain("default-src 'self'");
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    }
  });
});

describe('OpenAPI (Enabler-002 AC-6)', () => {
  it('T-011 serves an OpenAPI 3.1 document built from route zod schemas, and Swagger UI', async () => {
    addModule(
      'items',
      [
        "import { z } from 'zod';",
        'export default async function (app) {',
        "  app.get('/items', { schema: { response: { 200: z.object({ count: z.number().int() }) } } }, async () => ({ count: 0 }));",
        '}',
        '',
      ].join('\n'),
    );
    const instance = await build();

    const json = await instance.inject({ method: 'GET', url: '/docs/json' });
    expect(json.statusCode).toBe(200);
    const document = json.json() as { openapi: string; paths: Record<string, unknown> };
    expect(document.openapi).toMatch(/^3\.1/);
    expect(document.paths).toHaveProperty('/items');

    const ui = await instance.inject({ method: 'GET', url: '/docs/' });
    expect(ui.statusCode).toBe(200);
    expect(ui.headers['content-type']).toContain('text/html');
    expect(ui.body.toLowerCase()).toContain('swagger');
  });

  it('T-011 documents a response declared with a media type next to plain zod responses', async () => {
    addModule(
      'mixed',
      [
        "import { z } from 'zod';",
        'export default async function (app) {',
        "  app.get('/mixed', { schema: { response: {",
        '    200: z.object({ count: z.number().int() }),',
        "    409: { description: 'Conflict', content: { 'application/problem+json': { schema: z.object({ title: z.string(), status: z.number() }) } } },",
        "  } } }, async () => ({ count: 0 }));",
        "  app.get('/only-content', { schema: { response: {",
        "    503: { content: { 'application/problem+json': { schema: z.object({ title: z.string() }) } } },",
        "  } } }, async () => ({}));",
        "  app.get('/hidden', { schema: { hide: true, response: {",
        "    503: { content: { 'application/problem+json': { schema: z.object({ title: z.string() }) } } },",
        "  } } }, async () => ({}));",
        '}',
        '',
      ].join('\n'),
    );
    const instance = await build();
    const document = (await instance.inject({ method: 'GET', url: '/docs/json' })).json() as {
      paths: Record<
        string,
        {
          get: {
            responses: Record<
              string,
              { description: string; content: Record<string, { schema: { type: string; properties: object; required: string[] } }> }
            >;
          };
        }
      >;
    };

    const mixed = document.paths['/mixed']?.get.responses ?? {};
    expect(Object.keys(mixed['200']?.content ?? {})).toEqual(['application/json']);
    expect(mixed['409']?.description).toBe('Conflict');
    expect(Object.keys(mixed['409']?.content ?? {})).toEqual(['application/problem+json']);
    const conflict = mixed['409']?.content['application/problem+json']?.schema;
    expect(conflict?.type).toBe('object');
    expect(Object.keys(conflict?.properties ?? {})).toEqual(['title', 'status']);
    expect(conflict?.required).toEqual(['title', 'status']);

    const onlyContent = document.paths['/only-content']?.get.responses ?? {};
    expect(Object.keys(onlyContent)).toEqual(['503']);
    expect(onlyContent['503']?.description).toBe('Default Response');
    expect(Object.keys(onlyContent['503']?.content ?? {})).toEqual(['application/problem+json']);

    expect(document.paths).not.toHaveProperty('/hidden');
  });
});

describe('database decoration', () => {
  it('T-008 reading app.db without a database throws a clear error', async () => {
    const instance = await build();
    expect(() => instance.db).toThrow(/database is not configured/);
  });
});
