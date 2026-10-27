import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import axe from 'axe-core';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Spending, Trend } from './api';
import { DashboardPage } from './DashboardPage';

const routerFuture = { v7_startTransition: true, v7_relativeSplatPath: true } as const;

const spending = (month: string): Spending => ({
  month,
  currency: 'USD',
  totalMinor: 15000,
  categories: [
    { categoryId: 1, name: 'Groceries', amountMinor: 10000 },
    { categoryId: 2, name: 'Transport', amountMinor: 5000 },
  ],
});

/** `count` consecutive months ending at `end`, oldest first, with the given amounts (cycled). */
function trend(count: number, end: string, amounts: number[] = [1000, 2000, 3000]): Trend {
  const [year, month] = end.split('-').map(Number) as [number, number];
  const points = Array.from({ length: count }, (_, i) => {
    const index = year * 12 + (month - 1) - (count - 1 - i);
    const y = Math.floor(index / 12);
    const m = (index % 12) + 1;
    return { month: `${y}-${String(m).padStart(2, '0')}`, totalMinor: amounts[i % amounts.length] ?? 0 };
  });
  return { currency: 'USD', points };
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

type TrendResponder = (months: number, end: string, call: number) => Response | Promise<Response>;

/** Stubs fetch for both dashboard routes; records the trend urls. */
function mockApi(onTrend: TrendResponder, onSpending: (month: string) => Response = (m) => json(200, spending(m))) {
  const trendUrls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string) => {
      const url = new URL(input, 'http://x');
      if (url.pathname === '/api/dashboard/spending') return onSpending(url.searchParams.get('month') ?? '');
      if (url.pathname === '/api/dashboard/trend') {
        trendUrls.push(input);
        return onTrend(Number(url.searchParams.get('months')), url.searchParams.get('end') ?? '', trendUrls.length);
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

const serious = async (container: HTMLElement) => {
  // jsdom has no layout engine, so colour contrast is checked visually by the verifier.
  const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
  return results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id);
};

const trendSection = () => screen.getByRole('region', { name: 'Spending trend' });

/** Radix Tabs activates a trigger on mouse down. */
const selectRange = (name: string) => fireEvent.mouseDown(screen.getByRole('tab', { name }), { button: 0 });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('TrendChart', () => {
  it('T-030 renders one chart point per month, oldest first, ending at the selected month', async () => {
    mockApi((months, end) => json(200, trend(months, end)));
    renderPage();
    fireEvent.change(screen.getByLabelText('Month'), { target: { value: '2026-03' } });
    await waitFor(() => {
      const rows = within(trendSection()).getAllByRole('row').slice(1);
      expect(rows.map((row) => within(row).getByRole('rowheader').textContent)).toEqual([
        '2025-10',
        '2025-11',
        '2025-12',
        '2026-01',
        '2026-02',
        '2026-03',
      ]);
    });
    const chart = within(trendSection()).getByTestId('trend-chart');
    await waitFor(() => expect(chart.querySelectorAll('.recharts-bar-rectangle').length).toBe(6));
  });

  it('T-031 a table with month and formatted amount sits alongside the chart', async () => {
    mockApi((months, end) => json(200, trend(months, end, [123456])));
    renderPage();
    const table = await within(await screen.findByRole('region', { name: 'Spending trend' })).findByRole('table');
    expect(within(table).getByRole('columnheader', { name: 'Month' })).toBeInTheDocument();
    // Intl output depends on the runtime locale, so match the digits and the currency, not the separators.
    expect(within(table).getAllByText(/1\D?234\D56/).length).toBeGreaterThan(0);
    expect(within(trendSection()).getByTestId('trend-chart')).toBeInTheDocument();
  });

  it('T-032 the range control offers 3, 6 (default) and 12 and a change requests that count', async () => {
    const urls = mockApi((months, end) => json(200, trend(months, end)));
    renderPage();
    const list = await screen.findByRole('tablist', { name: 'Period' });
    const tabs = within(list).getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Last 3 months', 'Last 6 months', 'Last 12 months']);
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    await waitFor(() => expect(urls[0]).toMatch(/months=6/));
    selectRange('Last 12 months');
    await waitFor(() => expect(urls.some((url) => url.includes('months=12'))).toBe(true));
    await waitFor(() => expect(within(trendSection()).getAllByRole('row')).toHaveLength(13));
    expect(within(list).getByRole('tab', { name: 'Last 12 months' })).toHaveAttribute('aria-selected', 'true');
    selectRange('Last 3 months');
    await waitFor(() => expect(within(trendSection()).getAllByRole('row')).toHaveLength(4));
  });

  it('T-033 all-zero points show the trend empty state and no chart', async () => {
    mockApi((months, end) => json(200, trend(months, end, [0])));
    renderPage();
    expect(await screen.findByText('No spending in this period.')).toBeInTheDocument();
    expect(screen.queryByTestId('trend-chart')).toBeNull();
    expect(within(trendSection()).queryByRole('table')).toBeNull();
  });

  it('T-034 trend loading does not blank the category section', async () => {
    mockApi(() => new Promise<Response>(() => undefined));
    renderPage();
    expect(await screen.findByText('Loading trend…')).toBeInTheDocument();
    expect(await screen.findByText('Groceries')).toBeInTheDocument();
  });

  it('T-034 a trend failure shows its own error, Retry refetches, categories stay', async () => {
    const urls = mockApi((months, end, call) =>
      call === 1 ? json(500, { title: 'Error', status: 500, detail: 'boom' }) : json(200, trend(months, end)),
    );
    renderPage();
    const alert = await within(await screen.findByRole('region', { name: 'Spending trend' })).findByRole('alert');
    expect(alert).toHaveTextContent(/Could not load your trend/);
    expect(await screen.findByText('Groceries')).toBeInTheDocument();
    fireEvent.click(within(alert).getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(within(trendSection()).queryByRole('alert')).toBeNull());
    expect(urls).toHaveLength(2);
    expect(within(trendSection()).getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('Groceries')).toBeInTheDocument();
  });

  it('T-035 axe finds no serious or critical violation with the trend section rendered', async () => {
    mockApi((months, end) => json(200, trend(months, end)));
    const { container } = renderPage();
    await within(await screen.findByRole('region', { name: 'Spending trend' })).findByRole('table');
    await screen.findByText('Groceries');
    expect(screen.getByRole('tablist', { name: 'Period' })).toBeInTheDocument();
    expect(await serious(container)).toEqual([]);
  });
});
