import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseEnvTemplate, readRoot, root } from './helpers.js';

const semver = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/;

describe('Enabler-001 workspace scaffold', () => {
  it('T-001 root package.json has SemVer version, engines and workspace lists api and web', () => {
    const pkg = JSON.parse(readRoot('package.json'));
    expect(pkg.version).toMatch(semver);
    expect(pkg.engines.node).toBe('>=22 <25');
    expect(pkg.engines.pnpm).toBe('>=9');
    expect(Object.keys(pkg.scripts)).toEqual(expect.arrayContaining(['build', 'test', 'lint']));
    const ws = readRoot('pnpm-workspace.yaml');
    expect(ws).toMatch(/^\s*-\s*api\s*$/m);
    expect(ws).toMatch(/^\s*-\s*web\s*$/m);
  });

  it('T-002 lockfile exists and pnpm install --frozen-lockfile exits 0', () => {
    expect(existsSync(resolve(root, 'pnpm-lock.yaml'))).toBe(true);
    const r = spawnSync('pnpm install --frozen-lockfile', {
      cwd: root,
      shell: true,
      encoding: 'utf8',
    });
    expect(r.status, r.stdout + r.stderr).toBe(0);
  });

  it('T-003 .env.example holds exactly the six names with empty values', () => {
    const env = parseEnvTemplate(readRoot('.env.example'));
    expect([...env.keys()].sort()).toEqual(
      ['COOKIE_SECURE', 'CURRENCY', 'DATABASE_PATH', 'LOG_LEVEL', 'PORT', 'SESSION_SECRET'],
    );
    for (const [name, value] of env) expect(value, name).toBe('');
  });

  it('T-004 git ignores .env, node_modules, dist and *.db paths but not .env.example', () => {
    const ignored = (p: string) =>
      spawnSync('git', ['check-ignore', '-q', '--no-index', p], { cwd: root }).status === 0;
    for (const p of ['.env', 'node_modules/x', 'dist/x', 'data/x.db', 'api/dist/x', 'web/node_modules/x']) {
      expect(ignored(p), p).toBe(true);
    }
    expect(ignored('.env.example')).toBe(false);
  });
});
