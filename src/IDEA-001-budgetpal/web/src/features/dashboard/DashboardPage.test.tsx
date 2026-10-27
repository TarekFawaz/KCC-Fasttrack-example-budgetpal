import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import axe from 'axe-core';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Shell } from '../../kernel/Shell';
import { features } from '../../kernel/registry';
import type { Spending } from './api';
import { DashboardPage } from './DashboardPage';
import feature from './feature';
import { currentMonth } from './format';

const routerFuture = { v7_startTransition: true, v7_relativeSplatPath: true } as const;

const spending = (month: string, over: Partial<Spending> = {}): Spending => ({
  month,
  currency: 'USD',
  totalMinor: 15000,
  categories: [
    { categoryId: 1, name: 'Groceries', amountMinor: 10000 },
    { categoryId: 2, name: 'Transport', amountMinor: 5000 },
  ],
  ...over,
});

const empty = (month: string): Spending => spending(month, { totalMinor: 0, categories: [] });

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

type Responder = (month: string, call: number) => Response | Promise<Response>;

/** Stubs fetch for the spending route and records every url. */
function mockApi(responder: Responder) {
  const urls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string) => {
      const url = new URL(input, 'http://x');
      // The trend section (Story-004, T-030..T-035 in TrendChart.test.tsx) is mounted below; keep it out of these counts.
      if (url.pathname === '/api/dashboard/trend') return json(200, { currency: 'USD', points: [] });
      urls.push(input);
      if (url.pathname !== '/api/dashboard/spending') throw new Error(`unexpected request ${input}`);
      return responder(url.searchParams.get('month') ?? '', urls.length);
    }),
  );
  return urls;
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/']} future={routerFuture}>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const serious = async (container: HTMLElement) => {
  // jsdom has no layout engine, so colour contrast is checked visually by the verifier.
  const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
  return results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id);
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('dashboard feature registration', () => {
  it('T-022 feature.ts exports the Dashboard entry for / and the registry lists it', () => {
    expect(feature).toMatchObject({ id: 'dashboard', path: '/', label: 'Dashboard' });
    expect(typeof feature.order).toBe('number');
    expect(feature.component).toBe(DashboardPage);
    expect(features.find((entry) => entry.id === 'dashboard')).toBe(feature);
  });

  it('T-022 the shell shows a "Dashboard" nav entry that opens / with the current month selected', async () => {
    const urls = mockApi((month) => json(200, spending(month)));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/']} future={routerFuture}>
          <Shell features={features} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const link = within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', { name: 'Dashboard' });
    expect(link).toHaveAttribute('href', '/');
    fireEvent.click(link);
    const picker = (await screen.findByLabelText('Month')) as HTMLInputElement;
    expect(picker.value).toBe(currentMonth());
    await waitFor(() => expect(urls).toContain(`/api/dashboard/spending?month=${currentMonth()}`));
  });

  it('T-022 the month picker starts on the current month', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 6, 15, 12));
    const urls = mockApi((month) => json(200, spending(month)));
    renderPage();
    expect((screen.getByLabelText('Month') as HTMLInputElement).value).toBe('2026-07');
    await waitFor(() => expect(urls).toEqual(['/api/dashboard/spending?month=2026-07']));
  });
});

describe('DashboardPage', () => {
  it('T-024 shows the pie chart and the table once the data arrives', async () => {
    mockApi((month) => json(200, spending(month)));
    const { container } = renderPage();
    const table = await screen.findByRole('table');
    expect(within(table).getByText('Groceries')).toBeInTheDocument();
    expect(within(table).getByText('Total')).toBeInTheDocument();
    expect(container.querySelector('.recharts-pie')).not.toBeNull();
  });

  it('T-025 changing the month refetches that month and updates chart and table', async () => {
    const urls = mockApi((month) =>
      json(
        200,
        month === '2026-02'
          ? spending(month, { totalMinor: 700, categories: [{ categoryId: 9, name: 'Utilities', amountMinor: 700 }] })
          : spending(month),
      ),
    );
    const { container } = renderPage();
    await screen.findByText('Groceries');
    fireEvent.change(screen.getByLabelText('Month'), { target: { value: '2026-02' } });
    await screen.findByText('Utilities');
    expect(screen.queryByText('Groceries')).toBeNull();
    expect(urls).toContain('/api/dashboard/spending?month=2026-02');
    expect(container.querySelectorAll('.recharts-pie-sector')).toHaveLength(1);
  });

  it('T-025 a cleared month does not call the api', async () => {
    const urls = mockApi((month) => json(200, spending(month)));
    renderPage();
    await screen.findByText('Groceries');
    const before = urls.length;
    fireEvent.change(screen.getByLabelText('Month'), { target: { value: '' } });
    expect(await screen.findByText('Choose a month to see your spending.')).toBeInTheDocument();
    expect(urls).toHaveLength(before);
  });

  it('T-026 an empty month shows the empty state with a link to transactions and no chart', async () => {
    mockApi((month) => json(200, empty(month)));
    const { container } = renderPage();
    expect(await screen.findByText(/No expenses in this month/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /transactions/i })).toHaveAttribute('href', '/transactions');
    expect(container.querySelector('.recharts-wrapper')).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('T-027 shows a loading state while the request is pending', async () => {
    mockApi(() => new Promise<Response>(() => undefined));
    renderPage();
    expect(await screen.findByRole('status')).toHaveTextContent(/Loading spending/);
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('T-027 a failure shows an error message and Retry fetches again', async () => {
    const urls = mockApi((month, call) =>
      call === 1 ? json(500, { title: 'Error', status: 500, detail: 'boom' }) : json(200, spending(month)),
    );
    renderPage();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/Could not load your spending/);
    expect(alert).toHaveTextContent('boom');
    fireEvent.click(within(alert).getByRole('button', { name: 'Retry' }));
    await screen.findByText('Groceries');
    expect(urls).toHaveLength(2);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('T-028 the month picker has an accessible label and axe finds no serious or critical violation', async () => {
    mockApi((month) => json(200, spending(month)));
    const { container } = renderPage();
    expect(screen.getByLabelText('Month').tagName).toBe('INPUT');
    await screen.findByText('Groceries');
    expect(await serious(container)).toEqual([]);
  });

  it('T-028 axe is clean for the empty, loading and error states too', async () => {
    mockApi((month) => json(200, empty(month)));
    const first = renderPage();
    await screen.findByText(/No expenses/);
    expect(await serious(first.container)).toEqual([]);
    first.unmount();

    mockApi(() => new Promise<Response>(() => undefined));
    const second = renderPage();
    await screen.findByRole('status');
    expect(await serious(second.container)).toEqual([]);
    second.unmount();

    mockApi(() => json(500, { title: 'Error', status: 500, detail: 'boom' }));
    const third = renderPage();
    await screen.findByRole('alert');
    expect(await serious(third.container)).toEqual([]);
  });

  it('T-029 every category on the page is a table row with text, not colour alone', async () => {
    mockApi((month) => json(200, spending(month)));
    renderPage();
    const table = await screen.findByRole('table');
    const rows = within(table).getAllByRole('row');
    for (const name of ['Groceries', 'Transport']) {
      const row = rows.find((candidate) => within(candidate).queryByText(name) !== null);
      expect(row, name).toBeDefined();
      expect(row?.textContent).toMatch(/\d+\.\d%/);
    }
  });
});

describe('dashboard is the landing page (SPEC-009 Story-004)', () => {
  it('T-035 feature.ts is path /, order 0, first in the registry, and /dashboard is no route', () => {
    expect(feature).toMatchObject({ path: '/', label: 'Dashboard', order: 0 });
    expect(features[0]).toBe(feature);
    expect(features.some((entry) => entry.path === '/dashboard')).toBe(false);
  });

  it('T-036 the dashboard shows at / with the current month selected', async () => {
    const urls = mockApi((month) => json(200, spending(month)));
    renderPage();
    expect((screen.getByLabelText('Month') as HTMLInputElement).value).toBe(currentMonth());
    await waitFor(() => expect(urls).toContain(`/api/dashboard/spending?month=${currentMonth()}`));
  });

  it('T-037 no Home feature, no "API: ok" text and no home id remain', () => {
    const srcRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
    expect(existsSync(join(srcRoot, 'features', 'home'))).toBe(false);
    expect(features.some((entry) => entry.id === 'home')).toBe(false);
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? walk(join(dir, e.name)) : /\.(ts|tsx)$/.test(e.name) ? [join(dir, e.name)] : [],
      );
    const needle = ['API', ': ok'].join('');
    const hits = walk(srcRoot).filter((f) => !f.endsWith('DashboardPage.test.tsx') && readFileSync(f, 'utf8').includes(needle));
    expect(hits).toEqual([]);
  });

  it('T-040 an unknown /dashboard path shows "Page not found" inside the shell', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={['/dashboard']} future={routerFuture}>
          <Shell features={features} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
  });
});
