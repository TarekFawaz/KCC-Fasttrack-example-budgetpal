import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readRoot, root } from './helpers.js';
import { probeLiveStack } from './live-stack.js';

/**
 * Enabler-005: Dockerfiles, nginx, compose, README.
 * T-032, T-033, T-036, T-037 read the files; T-031, T-034, T-035 need a running Docker daemon whose build
 * container can reach the npm registry, and are skipped (deferred, not passed) when it cannot.
 */

const compose = readRoot('docker-compose.yml');
const apiDockerfile = readRoot('api/Dockerfile');
const webDockerfile = readRoot('web/Dockerfile');
const nginx = readRoot('web/nginx.conf');
const readme = readRoot('README.md');
/** The architect's static rules, two levels above the workspace (src/IDEA-001-budgetpal -> repo root). */
const staticRulesFile = resolve(root, '..', '..', 'architecture', 'static-rules.tsv');

/** Daemon up AND a build container can reach the npm registry; otherwise the live stack is deferred. */
const liveStack = probeLiveStack(webDockerfile);
const dockerCli = liveStack.cli;
if (liveStack.skipReason !== null && liveStack.cli) {
  console.warn(`[live-stack] T-031, T-034, T-035 deferred (not a pass): ${liveStack.skipReason}`);
}

/** Top-level service block text, up to the next service or top-level key. */
function serviceBlock(name: string): string {
  const match = compose.match(new RegExp(`^  ${name}:\\n((?:(?:    .*|)\\n)+)`, 'm'));
  if (!match) throw new Error(`service ${name} not found`);
  return match[1];
}

/** Dockerfile stages as {from, body}. */
function stages(dockerfile: string): { from: string; body: string }[] {
  return dockerfile
    .split(/^(?=FROM\s)/m)
    .filter((part) => part.startsWith('FROM '))
    .map((part) => ({ from: part.split('\n')[0], body: part }));
}

const stripComments = (text: string): string =>
  text
    .split('\n')
    .filter((line) => !line.trim().startsWith('#'))
    .join('\n');

describe('Enabler-005 compose file', () => {
  it('T-032 loopback ports, healthchecks, ${VAR:-default} env without secrets, named volume', () => {
    const code = stripComments(compose);
    const portLines = code.split('\n').filter((line) => /^\s*-\s*["']?\d/.test(line));
    expect(portLines.map((l) => l.trim())).toEqual(['- "127.0.0.1:3000:3000"', '- "127.0.0.1:8080:8080"']);
    for (const name of ['api', 'web']) expect(serviceBlock(name), name).toMatch(/^ {4}healthcheck:/m);
    expect(serviceBlock('web')).toMatch(/condition:\s*service_healthy/);
    expect(code).toMatch(/LOG_LEVEL:\s*\$\{LOG_LEVEL:-info\}/);
    expect(code).toMatch(/CURRENCY:\s*\$\{CURRENCY:-USD\}/);
    expect(code).toMatch(/COOKIE_SECURE:\s*\$\{COOKIE_SECURE:-false\}/);
    // SESSION_SECRET is passed through with an empty default: no secret value is in the file.
    expect(code).toMatch(/SESSION_SECRET:\s*\$\{SESSION_SECRET:-\}/);
    expect(code).not.toMatch(/SESSION_SECRET:\s*["']?[A-Za-z0-9]{8,}/);
    expect(code).toMatch(/budgetpal-data:\/data/);
    expect(code).toMatch(/^volumes:\n {2}budgetpal-data:/m);
    expect(code).toMatch(/DATABASE_PATH:\s*\/data\/budgetpal\.db/);
  });

  it('T-037 api and web publish both ports on 127.0.0.1 only', () => {
    for (const [name, port] of [['api', '3000'], ['web', '8080']] as const) {
      const block = stripComments(serviceBlock(name));
      const mappings = block.match(/^\s*-\s*["']?[\d.]+:\d+(:\d+)?["']?\s*$/gm) ?? [];
      expect(mappings.length, name).toBe(1);
      expect(mappings[0], name).toContain(`"127.0.0.1:${port}:${port}"`);
    }
    expect(stripComments(compose)).not.toMatch(/0\.0\.0\.0/);
  });

  it.skipIf(!dockerCli)('T-032 docker compose config accepts the file and resolves loopback ports', () => {
    const r = spawnSync('docker', ['compose', 'config', '--format', 'json'], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, LOG_LEVEL: '', CURRENCY: '', COOKIE_SECURE: '', SESSION_SECRET: '' },
    });
    expect(r.status, r.stderr).toBe(0);
    const config = JSON.parse(r.stdout) as {
      services: Record<string, { ports: { host_ip: string; published: string }[]; healthcheck: unknown }>;
      volumes: Record<string, unknown>;
    };
    for (const name of ['api', 'web']) {
      expect(config.services[name].healthcheck, name).toBeTruthy();
      expect(config.services[name].ports.map((p) => p.host_ip), name).toEqual(['127.0.0.1']);
    }
    expect(Object.keys(config.volumes)).toEqual(['budgetpal-data']);
  });
});

describe('Enabler-005 Dockerfiles', () => {
  it('T-033 pinned tags, multi-stage, toolchain in build stages only, non-root last stage', () => {
    for (const [name, dockerfile] of [['api', apiDockerfile], ['web', webDockerfile]] as const) {
      const parts = stages(stripComments(dockerfile));
      expect(parts.length, name).toBeGreaterThanOrEqual(2);
      for (const { from } of parts) {
        if (/^FROM\s+(toolchain|build|prod-deps)\b/.test(from)) continue; // an earlier stage
        expect(from, name).toMatch(/^FROM\s+\S+:[\w.-]+(\s+AS\s+\w[\w-]*)?\s*$/);
        expect(from, name).not.toMatch(/:latest\b/);
      }
      const last = parts[parts.length - 1];
      expect(last.body, name).toMatch(/^USER\s+(?!root\b|0\b)\S+/m);
      expect(last.body, `${name} runtime has no toolchain`).not.toMatch(/apt-get|build-essential|python3|\bg\+\+|pnpm (install|add)/);
    }
    const apiParts = stages(stripComments(apiDockerfile));
    expect(apiParts[0].from).toMatch(/^FROM node:22-bookworm-slim\b/);
    expect(apiParts[apiParts.length - 1].from).toMatch(/^FROM node:22-bookworm-slim\b/);
    expect(apiParts[0].body).toMatch(/apt-get install[\s\S]*g\+\+/); // toolchain lives in the build side
    const webParts = stages(stripComments(webDockerfile));
    expect(webParts[0].from).toMatch(/^FROM node:22-bookworm-slim\b/);
    expect(webParts[webParts.length - 1].from).toMatch(/^FROM nginxinc\/nginx-unprivileged:\d+\.\d+\.\d+-alpine\b/);
    expect(apiDockerfile).toMatch(/^HEALTHCHECK/m);
  });

  // GR-017 / SR-018 as the quality gate enforces it: the rule is read from the architecture file and applied
  // line by line (comments included) to every Dockerfile. Every FROM must name an external image with a tag.
  it.skipIf(!existsSync(staticRulesFile))('GR-017 no Dockerfile line hits static rule SR-018', () => {
    const row = readFileSync(staticRulesFile, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.split('\t'))
      .find((cols) => cols[0] === 'SR-018');
    expect(row, 'SR-018 is declared in architecture/static-rules.tsv').toBeDefined();
    const [, files, forbidden] = row as string[];
    const pattern = new RegExp(forbidden);
    for (const rel of ['api/Dockerfile', 'web/Dockerfile']) {
      expect(new RegExp(files).test(rel), `${rel} is in the scope of SR-018`).toBe(true);
      const hits = readRoot(rel)
        .split('\n')
        .map((line, index) => ({ line: index + 1, text: line }))
        .filter(({ text }) => pattern.test(text))
        .map(({ line, text }) => `${rel}:${line} ${text.trim()}`);
      expect(hits, `SR-018 hits in ${rel}`).toEqual([]);
    }
  });
});

describe('Enabler-005 nginx.conf', () => {
  it('serves the SPA with fallback, proxies /api/ with the prefix stripped and sets headers once', () => {
    expect(nginx).toMatch(/proxy_pass\s+http:\/\/api:3000\/;/);
    expect(nginx).toMatch(/try_files\s+\$uri\s+\$uri\/\s+\/index\.html;/);
    expect(nginx).toMatch(/add_header X-Content-Type-Options "nosniff" always;/);
    expect(nginx).toMatch(/add_header Referrer-Policy "no-referrer" always;/);
    expect(nginx).toMatch(/add_header Content-Security-Policy "default-src 'self'[^"]*" always;/);
    expect(nginx).not.toMatch(/Access-Control-Allow-Origin/i);
  });
});

describe('Enabler-005 README', () => {
  it('T-036 covers prerequisites, env copy, run, env table, backup and restore, redeploy', () => {
    for (const heading of [
      /^## Prerequisites$/m,
      /^## Run$/m,
      /^## Environment variables$/m,
      /^## Backup and restore/m,
      /^## Redeploy$/m,
    ]) {
      expect(readme).toMatch(heading);
    }
    expect(readme).toContain('cp .env.example .env');
    expect(readme).toContain('docker compose up --build');
    for (const name of ['PORT', 'DATABASE_PATH', 'SESSION_SECRET', 'CURRENCY', 'LOG_LEVEL', 'COOKIE_SECURE']) {
      expect(readme, name).toMatch(new RegExp(`\\|\\s*\`${name}\``));
    }
    expect(readme).toMatch(/budgetpal-data/);
    expect(readme).toMatch(/restore/i);
  });
});

/** Runs a docker compose command in the workspace root. */
function dc(args: string[], timeout = 600_000): ReturnType<typeof spawnSync> {
  return spawnSync('docker', ['compose', ...args], { cwd: root, encoding: 'utf8', timeout });
}

async function waitHealthy(timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const r = dc(['ps', '--format', 'json'], 30_000);
    const rows = String(r.stdout).trim().split('\n').filter(Boolean).map((l) => JSON.parse(l) as { Health: string });
    if (rows.length === 2 && rows.every((row) => row.Health === 'healthy')) return;
    await new Promise((resolve) => setTimeout(resolve, 3_000));
  }
  throw new Error('services did not become healthy in time');
}

describe.skipIf(liveStack.skipReason !== null)('Enabler-005 live stack (needs a Docker daemon, npm registry access and a free Docker network)', () => {
  it('T-031 compose up: both services healthy; web page and /api/health answer', async () => {
    const up = dc(['up', '--build', '-d']);
    expect(up.status, String(up.stderr)).toBe(0);
    await waitHealthy(180_000);
    const page = await fetch('http://127.0.0.1:8080/');
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('<div id="root">');
    const health = await fetch('http://127.0.0.1:8080/api/health');
    expect(await health.json()).toEqual({ status: 'ok', db: 'ok' });
  }, 600_000);

  it('T-034 nginx proxies /api/health, falls back to index.html and sets security headers', async () => {
    const health = await fetch('http://127.0.0.1:8080/api/health');
    expect(health.status).toBe(200);
    const spa = await fetch('http://127.0.0.1:8080/some/client/route');
    expect(spa.status).toBe(200);
    expect(await spa.text()).toContain('<div id="root">');
    for (const response of [health, spa]) {
      expect(response.headers.get('x-content-type-options')).toBe('nosniff');
      expect(response.headers.get('referrer-policy')).toBe('no-referrer');
      expect(response.headers.get('content-security-policy')).toContain("default-src 'self'");
      expect(response.headers.get('access-control-allow-origin')).toBeNull();
    }
  });

  it('T-035 data and migration records persist across down and up', async () => {
    const script =
      "const D=require('better-sqlite3');const d=new D('/data/budgetpal.db');" +
      "d.prepare('INSERT OR REPLACE INTO app_meta(key,value) VALUES (?,?)').run('t035','kept');d.close()";
    const write = dc(['exec', '-T', 'api', 'node', '-e', script], 60_000);
    expect(write.status, String(write.stderr)).toBe(0);
    expect(dc(['down'], 120_000).status).toBe(0);
    expect(dc(['up', '-d'], 300_000).status).toBe(0);
    await waitHealthy(180_000);
    const read = dc(
      [
        'exec', '-T', 'api', 'node', '-e',
        "const D=require('better-sqlite3');const d=new D('/data/budgetpal.db',{readonly:true});" +
          "console.log(JSON.stringify({v:d.prepare('SELECT value FROM app_meta WHERE key=?').get('t035'),m:d.prepare('SELECT name FROM _migrations').all()}))",
      ],
      60_000,
    );
    expect(read.status, String(read.stderr)).toBe(0);
    const out = JSON.parse(String(read.stdout)) as { v: { value: string }; m: { name: string }[] };
    expect(out.v.value).toBe('kept');
    expect(out.m.map((row) => row.name)).toContain('0001-init.sql');
    dc(['down'], 120_000);
  }, 600_000);
});
