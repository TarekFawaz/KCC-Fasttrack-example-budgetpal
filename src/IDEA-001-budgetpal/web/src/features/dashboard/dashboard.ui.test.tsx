import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import axe from 'axe-core';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setMatchMedia } from '../../test/setup';
import type { Spending, Trend } from './api';
import { DashboardPage } from './DashboardPage';
import { formatMoney } from './format';

const routerFuture = { v7_startTransition: true, v7_relativeSplatPath: true } as const;
const here = dirname(fileURLToPath(import.meta.url));

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

const trend = (count: number, currency = 'USD'): Trend => ({
  currency,
  points: Array.from({ length: count }, (_, i) => ({ month: `2026-${String((i % 12) + 1).padStart(2, '0')}`, totalMinor: 1000 * (i + 1) })),
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function mockApi(onSpending: () => Response, onTrend: (months: number) => Response = (m) => json(200, trend(m))) {
  const trendUrls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string) => {
      const url = new URL(input, 'http://x');
      if (url.pathname === '/api/dashboard/spending') return onSpending();
      if (url.pathname === '/api/dashboard/trend') {
        trendUrls.push(input);
        return onTrend(Number(url.searchParams.get('months')));
      }
      throw new Error(`unexpected request ${input}`);
    }),
  );
  return trendUrls;
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

const seriousViolations = async (container: HTMLElement) => {
  // jsdom applies no CSS, so contrast is proven by the token-pair test (theme.test.ts), not by axe.
  const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
  return results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id);
};

/** Production source files of a feature folder (tests excluded). */
function sources(folder: string): string[] {
  return readdirSync(join(here, '..', folder), { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(ts|tsx|css)$/.test(entry.name) && !/\.test\./.test(entry.name))
    .map((entry) => join(here, '..', folder, entry.name));
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.classList.remove('dark');
});

describe('SPEC-010 Story-001 dashboard restyle', () => {
  it('SPEC-010 T-014 Tabs change the range, the charts sit in Cards, chart colours are tokens and the table alternative stays', async () => {
    const urls = mockApi(() => json(200, spending('2026-03')));
    const { container } = renderPage();
    await screen.findByText('Groceries');

    const list = screen.getByRole('tablist', { name: 'Period' });
    const tabs = within(list).getAllByRole('tab');
    expect(tabs).toHaveLength(3);
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    fireEvent.mouseDown(tabs[2] as HTMLElement, { button: 0 });
    await waitFor(() => expect(urls.some((url) => url.includes('months=12'))).toBe(true));

    // Both sections are Cards (the kit Card class), each holding its chart.
    const card = (element: HTMLElement) => element.closest('.bg-card');
    expect(card(screen.getByTestId('spending-chart'))).not.toBeNull();
    const trendChart = await screen.findByTestId('trend-chart');
    expect(card(trendChart)).not.toBeNull();

    // Slices and bars take their colour from the chart tokens (Tailwind maps fill-chart-N to the CSS variable).
    const slices = Array.from(container.querySelectorAll('.recharts-pie-sector path'));
    expect(slices.length).toBeGreaterThan(0);
    for (const slice of slices) expect(slice.getAttribute('class')).toMatch(/\bfill-chart-[1-5]\b/);
    for (const bar of Array.from(trendChart.querySelectorAll('.recharts-bar-rectangle path'))) {
      expect(bar.getAttribute('class')).toMatch(/\bfill-chart-1\b/);
    }
    const tailwind = readFileSync(resolve(here, '..', '..', '..', 'tailwind.config.ts'), 'utf8');
    for (let n = 1; n <= 5; n += 1) expect(tailwind).toContain(`'${n}': 'hsl(var(--chart-${n}))'`);

    // The data tables stay as the text alternative of both charts.
    expect(screen.getAllByRole('table')).toHaveLength(2);
    expect(screen.getByTestId('spending-chart')).toHaveAttribute('aria-hidden', 'true');
    expect(trendChart).toHaveAttribute('aria-hidden', 'true');
  });

  it('SPEC-010 T-015 spending, trend, empty and error states and Intl currency behave as before', async () => {
    mockApi(
      () => json(200, spending('2026-03', { currency: 'EUR' })),
      (months) => json(200, trend(months, 'EUR')),
    );
    const first = renderPage();
    const table = await screen.findByRole('table', { name: /Spending by category/ });
    expect(within(table).getAllByText(formatMoney(10000, 'EUR')).length).toBeGreaterThan(0);
    expect(first.container.querySelector('.recharts-pie')).not.toBeNull();
    first.unmount();

    mockApi(() => json(200, spending('2026-03', { totalMinor: 0, categories: [] })));
    const empty = renderPage();
    expect(await screen.findByText(/No expenses in this month/)).toBeInTheDocument();
    empty.unmount();

    mockApi(() => json(500, { title: 'Error', status: 500, detail: 'boom' }));
    renderPage();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Could not load your spending. boom');
    expect(within(alert).getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it.each([
    ['light', false],
    ['dark', true],
  ])('SPEC-010 T-018 axe finds no serious or critical violation on the dashboard (%s)', async (_name, dark) => {
    setMatchMedia({ dark });
    document.documentElement.classList.toggle('dark', dark);
    mockApi(() => json(200, spending('2026-03')));
    const { container } = renderPage();
    await screen.findByText('Groceries');
    await screen.findByTestId('trend-chart');
    expect(await seriousViolations(container)).toEqual([]);
  });

  it('SPEC-010 T-019 controls are reachable and carry the focus ring class; no fixed width over 360 px', async () => {
    mockApi(() => json(200, spending('2026-03')));
    renderPage();
    await screen.findByText('Groceries');
    const controls = [screen.getByLabelText('Month'), ...screen.getAllByRole('tab')];
    for (const control of controls) {
      control.focus();
      expect(control).toHaveFocus();
      expect(control.className).toMatch(/focus-visible:ring-/);
    }
    // No `w-96` style number classes or pixel widths beyond 360 px (max-w is a cap, not a fixed width).
    for (const file of sources('dashboard')) {
      const text = readFileSync(file, 'utf8');
      for (const match of text.matchAll(/(?:^|[\s"'`:])(?:min-)?w-(?:\[(\d+(?:\.\d+)?)(px|rem)\]|(\d+(?:\.\d+)?))(?=[\s"'`\\]|$)/gm)) {
        const px = match[1] ? Number(match[1]) * (match[2] === 'rem' ? 16 : 1) : Number(match[3]) * 4;
        expect(px, `${file}: ${match[0].trim()}`).toBeLessThanOrEqual(360);
      }
    }
  });

  it('SPEC-010 T-020 the CSS module is gone, nothing imports one and no hard-coded colour remains', () => {
    expect(existsSync(join(here, 'dashboard.module.css'))).toBe(false);
    for (const file of sources('dashboard')) {
      const text = readFileSync(file, 'utf8');
      expect(file.endsWith('.css'), file).toBe(false);
      expect(text, file).not.toMatch(/\.module\.css/);
      expect(text, file).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(text, file).not.toMatch(/\b(?:rgb|rgba|hsl|hsla)\(/);
      expect(text, file).not.toMatch(/\b(?:bg|text|border|fill|stroke)-(?:red|green|blue|yellow|orange|amber|gray|slate|zinc|neutral|stone|emerald|teal|cyan|sky|indigo|violet|purple|pink|rose|white|black)(?:-\d+)?\b/);
      expect(text, file).not.toMatch(/style=\{\{/);
    }
  });
});
