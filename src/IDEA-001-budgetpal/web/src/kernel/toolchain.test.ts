// @vitest-environment node
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import config from '../../vite.config';
import * as registry from '@/kernel/registry';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p: string) => readFileSync(resolve(webRoot, p), 'utf8');
const pkg = JSON.parse(read('package.json')) as { dependencies: Record<string, string> };
const lock = readFileSync(resolve(webRoot, '..', 'pnpm-lock.yaml'), 'utf8');

const required = [
  'tailwindcss', 'postcss', 'autoprefixer', 'tailwindcss-animate', 'class-variance-authority',
  'clsx', 'tailwind-merge', 'lucide-react', '@radix-ui/react-slot', '@radix-ui/react-dialog',
  '@radix-ui/react-alert-dialog', '@radix-ui/react-label', '@radix-ui/react-select',
  '@radix-ui/react-dropdown-menu', '@radix-ui/react-tooltip', '@radix-ui/react-progress',
  '@radix-ui/react-tabs', '@radix-ui/react-separator',
];

describe('SPEC-010 Enabler-001 toolchain', () => {
  it('SPEC-010 T-001 package.json lists every D-25 package and the lockfile has an entry', () => {
    for (const name of required) {
      expect(pkg.dependencies[name], name).toMatch(/^\^\d/);
      expect(lock, name).toContain(name);
    }
    expect(pkg.dependencies.tailwindcss).toMatch(/^\^3\.4/);
  });

  it('SPEC-010 T-002 a module imported through @/kernel/registry resolves and runs', () => {
    expect(Object.keys(registry).length).toBeGreaterThan(0);
  });

  it('SPEC-010 T-003 tsconfig paths and the Vite alias map @ to src, with no Tailwind Vite plugin', () => {
    expect(read('tsconfig.json')).toMatch(/"@\/\*":\s*\["\.\/src\/\*"\]/);
    const alias = (config.resolve?.alias as Record<string, string>)['@'] ?? '';
    expect(resolve(alias)).toBe(resolve(webRoot, 'src'));
    expect(read('vite.config.ts')).not.toContain('@tailwindcss/vite');
    expect(pkg.dependencies['@tailwindcss/vite']).toBeUndefined();
  });

  it('SPEC-010 T-005 Dockerfile COPYs the config files before the build and keeps stage names and tags', () => {
    const d = read('Dockerfile');
    const copy = d.indexOf('COPY web/components.json web/tailwind.config.ts web/postcss.config.js');
    expect(copy).toBeGreaterThan(-1);
    expect(copy).toBeLessThan(d.indexOf('RUN pnpm --filter @budgetpal/web build'));
    expect(d).toContain('FROM node:22-bookworm-slim AS build');
    expect(d).toContain('FROM nginxinc/nginx-unprivileged:1.27.5-alpine AS runtime');
  });
});
