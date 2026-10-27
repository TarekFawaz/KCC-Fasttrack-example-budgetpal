// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import config from '../../vite.config';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const viteBin = resolve(webRoot, 'node_modules', 'vite', 'bin', 'vite.js');

describe('vite build and dev proxy (Enabler-003 AC-4)', () => {
  it('T-016 vite build exits 0 and emits dist/index.html with a script bundle', () => {
    const outDir = mkdtempSync(join(tmpdir(), 'budgetpal-web-'));
    try {
      const run = spawnSync(process.execPath, [viteBin, 'build', '--outDir', outDir, '--emptyOutDir'], {
        cwd: webRoot,
        encoding: 'utf8',
      });
      expect(run.status, `${run.stdout}\n${run.stderr}`).toBe(0);
      const indexFile = join(outDir, 'index.html');
      expect(existsSync(indexFile)).toBe(true);
      expect(readFileSync(indexFile, 'utf8')).toMatch(/<script[^>]+src="\/assets\/[^"]+\.js"/);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  it('T-016 the dev server proxies /api to the api and strips the prefix for health and budgets only', () => {
    const proxy = config.server?.proxy?.['/api'];
    expect(proxy).toBeDefined();
    const options = proxy as { target: string; rewrite: (path: string) => string };
    expect(options.target).toBe('http://127.0.0.1:3000');
    expect(options.rewrite('/api/health')).toBe('/health');
    expect(options.rewrite('/api/budgets/2026-10/3?x=1')).toBe('/budgets/2026-10/3?x=1');
    expect(options.rewrite('/api/budgets?month=2026-10')).toBe('/budgets?month=2026-10');
    expect(options.rewrite('/api/transactions?x=1')).toBe('/api/transactions?x=1');
    expect(options.rewrite('/api/auth/login')).toBe('/api/auth/login');
  });
});
