import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openDb } from '../src/kernel/db/index.js';
import { runMigrations } from '../src/kernel/db/migrate.js';
import { registerShutdown, start, type Running } from '../src/server.js';

const apiRoot = fileURLToPath(new URL('..', import.meta.url));
const serverTs = join(apiRoot, 'src', 'server.ts');
const migrations = join(apiRoot, 'migrations');

let tmp: string;
let running: Running | undefined;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'bp-srv-'));
});
afterEach(async () => {
  if (running) {
    await running.app.close();
    if (running.db.open) running.db.close();
    running = undefined;
  }
  rmSync(tmp, { recursive: true, force: true });
});

const freePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address() as { port: number };
      probe.close(() => resolve(port));
    });
  });

const spawnServer = (env: Record<string, string>) =>
  spawn(process.execPath, ['--import', 'tsx', serverTs], {
    cwd: apiRoot,
    env: { ...process.env, LOG_LEVEL: 'info', ...env },
  });

/** A database whose recorded checksum no longer matches 0001-init.sql, so migrating it fails. */
function tamperedDb(path: string): void {
  const seed = openDb(path);
  runMigrations(seed, migrations);
  seed.prepare("UPDATE _migrations SET sha256 = 'tampered'").run();
  seed.close();
}

describe('start', () => {
  it('T-020 migrates, then listens on PORT', async () => {
    const port = await freePort();
    running = await start({ PORT: String(port), DATABASE_PATH: join(tmp, 'd', 's.db') });
    const table = running.db.prepare("SELECT name FROM sqlite_master WHERE name = 'app_meta'").get();
    expect(table).toBeTruthy();
    expect((await fetch(`http://127.0.0.1:${port}/docs/json`)).status).toBe(200);
  });

  it('T-020 a failed migration rejects before listening', async () => {
    const port = await freePort();
    const dbPath = join(tmp, 'tamper.db');
    tamperedDb(dbPath);
    await expect(start({ PORT: String(port), DATABASE_PATH: dbPath })).rejects.toThrow(/0001-init\.sql/);
    await expect(fetch(`http://127.0.0.1:${port}/`)).rejects.toThrow();
  });
});

describe('process', () => {
  it('T-021 a failing migration exits non-zero and never listens', async () => {
    const port = await freePort();
    const dbPath = join(tmp, 'bad.db');
    tamperedDb(dbPath);

    const child = spawnServer({ PORT: String(port), DATABASE_PATH: dbPath });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    const code = await new Promise<number | null>((resolve) => child.on('close', resolve));
    expect(code).not.toBe(0);
    expect(err).toContain('0001-init.sql');
    expect(out).not.toContain('listening');
  });

  it.skipIf(process.platform === 'win32')('T-023 SIGTERM exits 0', async () => {
    const port = await freePort();
    const child = spawnServer({ PORT: String(port), DATABASE_PATH: join(tmp, 'sig.db') });
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('server did not start')), 20_000);
      child.stdout.on('data', (d) => {
        if (String(d).includes('listening')) {
          clearTimeout(timer);
          resolve();
        }
      });
    });
    const closed = new Promise<number | null>((resolve) => child.on('close', resolve));
    child.kill('SIGTERM');
    expect(await closed).toBe(0);
  });
});

describe('registerShutdown', () => {
  it('T-022 SIGTERM and SIGINT stop the server, close the db and exit 0', async () => {
    for (const signal of ['SIGTERM', 'SIGINT'] as const) {
      const port = await freePort();
      const run = await start({ PORT: String(port), DATABASE_PATH: join(tmp, `${signal}.db`) });
      const exit = vi.fn();
      const handle = registerShutdown(run.app, run.db, exit);
      process.emit(signal);
      await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0));
      expect(run.db.open).toBe(false);
      await expect(fetch(`http://127.0.0.1:${port}/`)).rejects.toThrow();
      handle.dispose();
    }
  });

  it('T-022 exits 1 when closing fails and ignores a second signal', async () => {
    const db = new Database(':memory:');
    const app = { log: { info: vi.fn(), error: vi.fn() }, close: vi.fn().mockRejectedValue(new Error('boom')) };
    const exit = vi.fn();
    const handle = registerShutdown(app as never, db, exit);
    await handle.shutdown('SIGTERM');
    await handle.shutdown('SIGINT');
    expect(exit).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(1);
    handle.dispose();
    db.close();
  });
});
