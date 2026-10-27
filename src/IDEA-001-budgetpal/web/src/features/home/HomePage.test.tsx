import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import axe from 'axe-core';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Shell } from '../../kernel/Shell';
import { features } from '../../kernel/registry';
import { HomePage } from './HomePage';

function renderHome() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <HomePage />
    </QueryClientProvider>,
  );
}

const okResponse = () => new Response(JSON.stringify({ status: 'ok', db: 'ok' }), { status: 200 });
const failResponse = () => new Response('{}', { status: 503 });

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

afterEach(() => vi.unstubAllGlobals());

describe('HomePage', () => {
  it('T-027 shows Checking... while loading, inside a status region', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => undefined)));
    renderHome();
    expect(screen.getByRole('status')).toHaveTextContent('Checking...');
  });

  it('T-027 shows "API: ok" with a check icon in the status region on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse()));
    renderHome();
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('API: ok'));
    expect(screen.getByRole('status')).toHaveTextContent('✓');
  });

  it('T-027 shows "API: unavailable" with a warning icon in the status region on failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(failResponse()));
    renderHome();
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('API: unavailable'));
    expect(screen.getByRole('status')).toHaveTextContent('⚠');
  });

  it.each([
    ['light', false],
    ['dark', true],
  ])('T-028 has no serious or critical axe violation in the %s scheme (ok and failed)', async (_name, dark) => {
    stubScheme(dark);
    for (const make of [okResponse, failResponse]) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(make()));
      const { container, unmount } = renderHome();
      await waitFor(() => expect(screen.getByRole('status')).not.toHaveTextContent('Checking...'));
      // jsdom has no layout engine, so colour contrast is checked visually by the verifier.
      const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
      const blocking = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      expect(blocking.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
      unmount();
    }
  });
});

describe('home feature registration', () => {
  it('T-029 the real registry lists Home at / with order 0 and renders in the shell nav', () => {
    const home = features.find((feature) => feature.id === 'home');
    expect(home).toMatchObject({ path: '/', label: 'Home', order: 0 });
    expect(features[0]?.id).toBe('home');

    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => undefined)));
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Shell features={features} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
  });

  it('T-029 no shared file imports the home feature', () => {
    const webSrc = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
    const shared: string[] = [join(webSrc, 'main.tsx')];
    for (const entry of readdirSync(join(webSrc, 'kernel'))) {
      if (/\.tsx?$/.test(entry) && !/\.test\./.test(entry)) shared.push(join(webSrc, 'kernel', entry));
    }
    const offenders = shared.filter((file) => /features\/home|HomePage|useHealth/.test(readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
