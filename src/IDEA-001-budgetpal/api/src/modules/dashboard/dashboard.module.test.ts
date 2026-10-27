import { fileURLToPath } from 'node:url';
import type Database from 'better-sqlite3';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';
import { loadConfig } from '../../kernel/config.js';
import { openDb } from '../../kernel/db/index.js';
import { runMigrations } from '../../kernel/db/migrate.js';

const migrationsDir = fileURLToPath(new URL('../../../migrations', import.meta.url));

let db: Database.Database;
let app: FastifyInstance;

beforeEach(async () => {
  db = openDb(':memory:');
  runMigrations(db, migrationsDir);
  app = await buildApp(loadConfig({}), { db });
  await app.ready();
});
afterEach(async () => {
  await app.close();
  if (db.open) db.close();
});

describe('dashboard module scaffold (Enabler-001)', () => {
  it('T-001 both dashboard routes are routed by the module loader: 401, not 404 (AC-1)', async () => {
    for (const url of ['/api/dashboard/spending?month=2026-03', '/api/dashboard/trend']) {
      const res = await app.inject({ method: 'GET', url });
      expect(res.statusCode, url).toBe(401);
    }
  });

  it('T-002 migration 0080 creates idx_transactions_dashboard on (user_id, occurred_on) and re-running changes nothing (AC-2)', () => {
    const indexes = () =>
      db.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'index' AND name = 'idx_transactions_dashboard'").all() as Array<{
        name: string;
        sql: string;
      }>;
    expect(indexes()).toHaveLength(1);
    const cols = (db.prepare("PRAGMA index_info('idx_transactions_dashboard')").all() as Array<{ name: string }>).map((c) => c.name);
    expect(cols).toEqual(['user_id', 'occurred_on']);
    const before = db.prepare('SELECT COUNT(*) AS n FROM sqlite_master').get();
    runMigrations(db, migrationsDir);
    expect(db.prepare('SELECT COUNT(*) AS n FROM sqlite_master').get()).toEqual(before);
    expect(indexes()).toHaveLength(1);
  });

  it('T-005 the OpenAPI document lists both dashboard paths with query and response schemas (AC-4)', async () => {
    const res = await app.inject({ method: 'GET', url: '/docs/json' });
    expect(res.statusCode).toBe(200);
    const doc = res.json() as { paths: Record<string, { get?: { parameters?: Array<{ name: string }>; responses: Record<string, unknown> } }> };
    const spending = doc.paths['/api/dashboard/spending']?.get;
    const trend = doc.paths['/api/dashboard/trend']?.get;
    expect(spending?.parameters?.map((p) => p.name)).toContain('month');
    expect(trend?.parameters?.map((p) => p.name)).toEqual(expect.arrayContaining(['months', 'end']));
    expect(spending?.responses).toHaveProperty('200');
    expect(trend?.responses).toHaveProperty('200');
  });
});
