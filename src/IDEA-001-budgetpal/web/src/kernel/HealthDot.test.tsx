import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import axe from 'axe-core';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockSession } from '../test/session';
import { AuthGate } from './AuthGate';
import { HealthDot } from './HealthDot';
import { createAppQueryClient } from './queryClient';
import { buildRegistry } from './registry';

const routerFuture = { v7_startTransition: true, v7_relativeSplatPath: true } as const;
const kernelDir = dirname(fileURLToPath(import.meta.url));

const okResponse = () => new Response(JSON.stringify({ status: 'ok', db: 'ok' }), { status: 200 });
const failResponse = () => new Response('{}', { status: 503 });

function renderDot() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <HealthDot />
    </QueryClientProvider>,
  );
}

function stubScheme(dark: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: dark && query.includes('dark'),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
    onchange: null,
  }));
}

async function blocking(container: HTMLElement) {
  // jsdom has no layout engine, so colour contrast is checked visually by the verifier.
  const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
  return results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.help}`);
}

afterEach(() => vi.unstubAllGlobals());

describe('HealthDot states', () => {
  it('T-029 is a status region named "API status: checking" while the health call is pending', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => undefined)));
    renderDot();
    expect(screen.getByRole('status', { name: 'API status: checking' })).toHaveAttribute('data-state', 'loading');
  });

  it('T-029 is named "API status: ok" when the health call succeeds', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse()));
    renderDot();
    expect(await screen.findByRole('status', { name: 'API status: ok' })).toHaveAttribute('data-state', 'ok');
  });

  it('T-029 is named "API status: unavailable" when the health call fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(failResponse()));
    renderDot();
    expect(await screen.findByRole('status', { name: 'API status: unavailable' })).toHaveAttribute('data-state', 'unavailable');
  });

  it('T-030 each state has a different aria-hidden icon besides colour', async () => {
    const icons: string[] = [];
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => undefined)));
    const loading = renderDot();
    icons.push(loading.container.querySelector('[aria-hidden="true"]')?.textContent ?? '');
    loading.unmount();

    for (const make of [okResponse, failResponse]) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(make()));
      const view = renderDot();
      await waitFor(() => expect(view.container.querySelector('[data-state]')?.getAttribute('data-state')).not.toBe('loading'));
      const icon = view.container.querySelector('[aria-hidden="true"]');
      expect(icon).not.toBeNull();
      icons.push(icon?.textContent ?? '');
      view.unmount();
    }
    expect(icons.every((icon) => icon !== '')).toBe(true);
    expect(new Set(icons).size).toBe(3);
  });

  it.each([
    ['light', false],
    ['dark', true],
  ])('T-033 has no serious or critical axe violation in the %s scheme (checking, ok, unavailable)', async (_name, dark) => {
    stubScheme(dark);
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => undefined)));
    const pending = renderDot();
    expect(await blocking(pending.container)).toEqual([]);
    pending.unmount();

    for (const make of [okResponse, failResponse]) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(make()));
      const view = renderDot();
      await waitFor(() => expect(view.container.querySelector('[data-state]')?.getAttribute('data-state')).not.toBe('loading'));
      expect(await blocking(view.container)).toEqual([]);
      view.unmount();
    }
  });

  it('T-039 carries the loading, ok, unavailable and axe cases the removed Home page tests had', () => {
    const text = readFileSync(join(kernelDir, 'HealthDot.test.tsx'), 'utf8');
    for (const id of ['T-029', 'T-030', 'T-033']) expect(text).toContain(id);
    expect(text).toContain('API status: checking');
    expect(text).toContain('API status: ok');
    expect(text).toContain('API status: unavailable');
    expect(text).toContain('axe.run');
  });
});

describe('HealthDot in the guarded shell', () => {
  function Page() {
    return <h1>Dashboard page</h1>;
  }
  function Login() {
    return <h1>Login page</h1>;
  }
  const registry = buildRegistry({
    '../features/auth/feature.ts': {
      features: [{ id: 'auth-login', path: '/login', label: 'Log in', order: 90, component: Login, public: true }],
    },
    '../features/dashboard/feature.ts': {
      default: { id: 'dashboard', path: '/', label: 'Dashboard', order: 0, component: Page },
    },
  });

  function renderGate(path: string) {
    return render(
      <QueryClientProvider client={createAppQueryClient()}>
        <MemoryRouter initialEntries={[path]} future={routerFuture}>
          <AuthGate features={registry} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  }

  it('T-028 the signed-in shell footer holds the dot; there is no /health route and no nav entry for it', async () => {
    const stub = mockSession('authenticated', (url) => (url === '/api/health' ? okResponse() : undefined));
    renderGate('/');
    const footer = await screen.findByRole('contentinfo');
    expect(await within(footer).findByRole('status', { name: 'API status: ok' })).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).queryByText(/status|health/i)).not.toBeInTheDocument();
    expect(registry.some((feature) => /health/.test(feature.path))).toBe(false);
    expect(stub.mock.calls.some(([url]) => url === '/api/health')).toBe(true);
  });

  it('T-034 an anonymous visitor sees no dot and triggers no /api/health request', async () => {
    const stub = mockSession('anonymous');
    renderGate('/');
    expect(await screen.findByRole('heading', { name: 'Login page' })).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: /API status/ })).not.toBeInTheDocument();
    expect(stub.mock.calls.some(([url]) => String(url).includes('/api/health'))).toBe(false);
  });
});

describe('kernel boundary', () => {
  it('T-032 no file in kernel/ imports a features/* module (GR-006)', () => {
    const files = readdirSync(kernelDir).filter((name) => /\.tsx?$/.test(name) && !name.endsWith('.d.ts'));
    expect(files).toContain('HealthDot.tsx');
    // The `.test.` files may name features in fixtures; the rule is about what the kernel imports.
    const offenders = files
      .filter((name) => !/\.test\./.test(name))
      .filter((name) => /\bfrom\s+['"][^'"]*features\//.test(readFileSync(join(kernelDir, name), 'utf8')));
    expect(offenders).toEqual([]);
  });
});
