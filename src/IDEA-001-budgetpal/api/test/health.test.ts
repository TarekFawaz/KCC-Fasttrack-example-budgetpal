import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/kernel/config.js';
import { runMigrations } from '../src/kernel/db/migrate.js';

const migrationsDir = fileURLToPath(new URL('../migrations', import.meta.url));
const openapiFile = fileURLToPath(new URL('../openapi.json', import.meta.url));
const config = loadConfig({ LOG_LEVEL: 'silent' });

let db: Database.Database;
let app: FastifyInstance;

beforeEach(async () => {
  db = new Database(':memory:');
  runMigrations(db, migrationsDir);
  app = await buildApp(config, { db });
  await app.ready();
});
afterEach(async () => {
  await app.close();
  if (db.open) db.close();
});

describe('GET /health', () => {
  it('T-025 returns 200 {status:ok, db:ok} and is documented in OpenAPI', async () => {
    const res = await app.inject('/health');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok', db: 'ok' });
    const spec = (await app.inject('/docs/json')).json() as { paths: Record<string, unknown> };
    expect(spec.paths).toHaveProperty('/health');
  });

  it('T-026 returns 503 problem+json without driver message or stack when the db is closed', async () => {
    db.close();
    const res = await app.inject('/health');
    expect(res.statusCode).toBe(503);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.json()).toMatchObject({ status: 503, title: 'Service Unavailable' });
    expect(res.body).not.toMatch(/not open|SQLITE|better-sqlite3|\bat .*\(/i);
    expect(res.body).not.toContain('stack');
  });

  it('T-026 also hides the driver message when the table is missing', async () => {
    db.exec('DROP TABLE app_meta');
    const res = await app.inject('/health');
    expect(res.statusCode).toBe(503);
    expect(res.body).not.toMatch(/no such table|app_meta/i);
  });
});

describe('OpenAPI contract', () => {
  it('T-030 served /docs/json equals the checked-in api/openapi.json and every route is implemented', async () => {
    const served = (await app.inject('/docs/json')).json() as { paths: Record<string, Record<string, unknown>> };
    if (process.env.UPDATE_OPENAPI === '1') {
      writeFileSync(openapiFile, `${JSON.stringify(served, null, 2)}\n`);
    }
    const checkedIn = JSON.parse(readFileSync(openapiFile, 'utf8')) as typeof served;
    expect(served).toEqual(checkedIn);

    for (const [path, operations] of Object.entries(checkedIn.paths)) {
      for (const method of Object.keys(operations)) {
        const res = await app.inject({ method: method.toUpperCase() as 'GET', url: path });
        expect(res.statusCode, `${method} ${path}`).not.toBe(404);
      }
    }
  });
});
