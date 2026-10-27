import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import axe from 'axe-core';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Shell } from '../../kernel/Shell';
import { features } from '../../kernel/registry';
import type { Transaction } from './api';
import feature from './feature';
import { directionOf, formatAmount, formatDate, TransactionsPage } from './TransactionsPage';

const here = dirname(fileURLToPath(import.meta.url));
const routerFuture = { v7_startTransition: true, v7_relativeSplatPath: true } as const;
// toHaveTextContent collapses whitespace runs (Intl may use no-break spaces), so expected text is collapsed the same way.
const currency = (value: number) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(value).replace(/\s+/g, ' ');

const ACCOUNTS = [
  { id: 1, name: 'Main' },
  { id: 2, name: 'Wallet' },
];
const CATEGORIES = [
  { id: 10, name: 'Groceries', kind: 'expense' },
  { id: 11, name: 'Salary', kind: 'income' },
];

const tx = (id: number, over: Partial<Transaction> = {}): Transaction => ({
  id,
  accountId: 1,
  categoryId: 10,
  occurredOn: '2026-03-15',
  amountMinor: 1250,
  description: `Row ${id}`,
  createdAt: '2026-03-15T10:00:00.000Z',
  updatedAt: '2026-03-15T10:00:00.000Z',
  ...over,
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

interface MockOptions {
  rows?: Transaction[];
  total?: number;
  listStatus?: number;
  delayList?: boolean;
}

/** Stubs fetch: the two picker endpoints and the transactions list (paged from `rows`). Records every request url. */
function mockApi(options: MockOptions = {}) {
  const rows = options.rows ?? [];
  const urls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string) => {
      urls.push(input);
      if (input === '/api/accounts') return json(200, ACCOUNTS);
      if (input === '/api/categories') return json(200, CATEGORIES);
      if (input.startsWith('/api/transactions?')) {
        if (options.delayList) return new Promise<Response>(() => undefined);
        if (options.listStatus) return json(options.listStatus, { title: 'Error', status: options.listStatus, detail: 'boom' });
        const params = new URL(input, 'http://x').searchParams;
        const limit = Number(params.get('limit'));
        const offset = Number(params.get('offset'));
        return json(200, { items: rows.slice(offset, offset + limit), total: options.total ?? rows.length, limit, offset });
      }
      throw new Error(`unexpected request ${input}`);
    }),
  );
  return urls;
}

const listUrls = (urls: string[]) => urls.filter((url) => url.startsWith('/api/transactions?'));

function renderPage(ui = <TransactionsPage />) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/transactions']} future={routerFuture}>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const serious = async (container: HTMLElement) => {
  // jsdom has no layout engine, so colour contrast is checked visually by the verifier.
  const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
  return results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id);
};

afterEach(() => vi.unstubAllGlobals());

describe('transactions feature registration', () => {
  it('T-028 feature.ts exports {id, path, label: "Transactions", order, component} and the registry lists it', () => {
    expect(feature).toMatchObject({ id: 'transactions', path: '/transactions', label: 'Transactions' });
    expect(typeof feature.order).toBe('number');
    expect(feature.component).toBe(TransactionsPage);
    expect(features.find((entry) => entry.id === 'transactions')).toBe(feature);
  });

  it('T-028 the shell shows a "Transactions" nav entry that leads to /transactions', async () => {
    mockApi({ rows: [] });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/']} future={routerFuture}>
          <Shell features={features} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const nav = screen.getByRole('navigation', { name: 'Main' });
    const link = within(nav).getByRole('link', { name: 'Transactions' });
    expect(link).toHaveAttribute('href', '/transactions');
    fireEvent.click(link);
    expect(await screen.findByRole('heading', { level: 1, name: 'Transactions' })).toBeInTheDocument();
  });
});

describe('display helpers', () => {
  it('T-029 formats minor units through Intl without a float', () => {
    expect(formatAmount(1250, 'USD').replace(/\s+/g, ' ')).toBe(currency(12.5));
    expect(formatAmount(5, 'USD').replace(/\s+/g, ' ')).toBe(currency(0.05));
    expect(formatAmount(999_999_999_999, 'USD').replace(/\s+/g, ' ')).toBe(
      new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' })
        .format('9999999999.99' as unknown as number)
        .replace(/\s+/g, ' '),
    );
    // A zero-decimal currency keeps minor units whole: 1250 is 1,250 yen, not 12.50.
    expect(formatAmount(1250, 'JPY').replace(/\s+/g, ' ')).toBe(
      new Intl.NumberFormat(undefined, { style: 'currency', currency: 'JPY' }).format(1250).replace(/\s+/g, ' '),
    );
  });

  it('T-029 formats a stored day without shifting it by time zone', () => {
    expect(formatDate('2026-03-15')).toBe(
      new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date('2026-03-15T00:00:00Z')),
    );
    expect(formatDate('not-a-date')).toBe('not-a-date');
  });

  it('T-029 expense and income are told apart by text and an icon', () => {
    expect(directionOf('expense')).toEqual({ label: 'Expense', icon: '↓' });
    expect(directionOf('income')).toEqual({ label: 'Income', icon: '↑' });
    expect(directionOf(undefined)).toBeNull();
  });
});

describe('TransactionsPage', () => {
  it('T-029 each row says Expense or Income in text, not by colour', async () => {
    mockApi({ rows: [tx(1), tx(2, { categoryId: 11, amountMinor: 300000, description: 'Pay' })] });
    renderPage();
    const table = await screen.findByRole('table');
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('Expense');
    expect(rows[1]).toHaveTextContent('Income');
  });

  it('T-030 the table shows date, description, account, category and the Intl amount', async () => {
    mockApi({ rows: [tx(1, { description: 'Weekly shop' }), tx(2, { accountId: 2, categoryId: 11, amountMinor: 300000, description: 'Pay' })] });
    renderPage();
    const table = await screen.findByRole('table');
    expect(within(table).getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'Date',
      'Description',
      'Account',
      'Category',
      'Amount',
    ]);
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent(formatDate('2026-03-15'));
    expect(within(rows[0]!).getByRole('rowheader')).toHaveTextContent('Weekly shop');
    expect(rows[0]).toHaveTextContent('Main');
    expect(rows[0]).toHaveTextContent('Groceries');
    expect(rows[0]).toHaveTextContent(currency(12.5));
    expect(rows[1]).toHaveTextContent('Wallet');
    expect(rows[1]).toHaveTextContent('Salary');
    expect(rows[1]).toHaveTextContent(currency(3000));
    expect(screen.queryByText(/You have no transactions yet/)).not.toBeInTheDocument();
  });

  it('T-031 labelled selects are fed from the list endpoints; changing a filter refetches with its params', async () => {
    const urls = mockApi({ rows: [tx(1)] });
    renderPage();
    await screen.findByRole('table');
    expect(urls).toContain('/api/accounts');
    expect(urls).toContain('/api/categories');
    expect(listUrls(urls)[0]).toBe('/api/transactions?limit=50&offset=0');

    const account = screen.getByLabelText('Account');
    const category = screen.getByLabelText('Category');
    expect(within(account).getAllByRole('option').map((option) => option.textContent)).toEqual(['All accounts', 'Main', 'Wallet']);
    expect(within(category).getAllByRole('option').map((option) => option.textContent)).toEqual([
      'All categories',
      'Groceries',
      'Salary',
    ]);

    fireEvent.change(screen.getByLabelText('Month'), { target: { value: '2026-03' } });
    await waitFor(() => expect(listUrls(urls).at(-1)).toBe('/api/transactions?month=2026-03&limit=50&offset=0'));
    fireEvent.change(account, { target: { value: '2' } });
    await waitFor(() => expect(listUrls(urls).at(-1)).toBe('/api/transactions?month=2026-03&accountId=2&limit=50&offset=0'));
    fireEvent.change(category, { target: { value: '11' } });
    await waitFor(() =>
      expect(listUrls(urls).at(-1)).toBe('/api/transactions?month=2026-03&accountId=2&categoryId=11&limit=50&offset=0'),
    );
    fireEvent.change(account, { target: { value: '' } });
    await waitFor(() => expect(listUrls(urls).at(-1)).toBe('/api/transactions?month=2026-03&categoryId=11&limit=50&offset=0'));
  });

  it('T-032 Previous and Next move the offset by the limit and the range and total are shown', async () => {
    const rows = Array.from({ length: 120 }, (_, index) => tx(index + 1));
    const urls = mockApi({ rows });
    renderPage();
    await screen.findByRole('table');
    expect(screen.getByText('Showing 1-50 of 120')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Showing 51-100 of 120')).toBeInTheDocument();
    expect(listUrls(urls).at(-1)).toBe('/api/transactions?limit=50&offset=50');

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Showing 101-120 of 120')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(await screen.findByText('Showing 51-100 of 120')).toBeInTheDocument();
    expect(listUrls(urls).at(-1)).toBe('/api/transactions?limit=50&offset=50');
  });

  it('T-032 changing a filter starts again at the first page', async () => {
    const urls = mockApi({ rows: Array.from({ length: 120 }, (_, index) => tx(index + 1)) });
    renderPage();
    await screen.findByRole('table');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('Showing 51-100 of 120');
    fireEvent.change(screen.getByLabelText('Account'), { target: { value: '1' } });
    await waitFor(() => expect(listUrls(urls).at(-1)).toBe('/api/transactions?accountId=1&limit=50&offset=0'));
  });

  it('T-033 with no rows an empty state explains how to add the first one', async () => {
    mockApi({ rows: [] });
    renderPage();
    const empty = await screen.findByText(/You have no transactions yet/);
    expect(empty).toHaveTextContent(/Add transaction/);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('T-033 a filter with no match says so instead of the first-time message', async () => {
    mockApi({ rows: [] });
    renderPage();
    await screen.findByText(/You have no transactions yet/);
    fireEvent.change(screen.getByLabelText('Account'), { target: { value: '2' } });
    expect(await screen.findByText(/No transactions match these filters/)).toBeInTheDocument();
  });

  it('T-033 while loading a status message is shown', async () => {
    mockApi({ delayList: true });
    renderPage();
    expect(await screen.findByRole('status')).toHaveTextContent('Loading transactions...');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('T-033 on an error an alert is shown', async () => {
    mockApi({ listStatus: 500 });
    renderPage();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Could not load your transactions');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('T-034 axe finds no serious or critical violation with rows, with no rows and with an error', async () => {
    mockApi({ rows: [tx(1), tx(2, { categoryId: 11, description: 'Pay' })] });
    const first = renderPage();
    await screen.findByRole('table');
    expect(await serious(first.container)).toEqual([]);
    first.unmount();

    mockApi({ rows: [] });
    const second = renderPage();
    await screen.findByText(/You have no transactions yet/);
    expect(await serious(second.container)).toEqual([]);
    second.unmount();

    mockApi({ listStatus: 500 });
    const third = renderPage();
    await screen.findByRole('alert');
    expect(await serious(third.container)).toEqual([]);
  });

  it('T-034 filters and pager are labelled native controls in tab order, none with a positive tabindex', async () => {
    mockApi({ rows: [tx(1)] });
    const { container } = renderPage();
    await screen.findByRole('table');
    const controls = [
      screen.getByLabelText('Month'),
      screen.getByLabelText('Account'),
      screen.getByLabelText('Category'),
      screen.getByRole('button', { name: 'Previous' }),
      screen.getByRole('button', { name: 'Next' }),
    ];
    for (const control of controls) {
      expect(control.getAttribute('tabindex')).toBeNull();
    }
    expect(container.querySelector('[tabindex]:not([tabindex="-1"]):not([tabindex="0"])')).toBeNull();
    expect(screen.getByRole('form', { name: 'Filter transactions' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Pages' })).toBeInTheDocument();
  });

  it('T-034 the stylesheet is one column by default, uses tokens and shows keyboard focus', () => {
    const css = readFileSync(resolve(here, 'TransactionsPage.module.css'), 'utf8');
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/);
    expect(css).toMatch(/:focus-visible/);
    const [base, wide] = css.split('@media (min-width: 768px)');
    expect(wide).toBeDefined();
    expect(base).toMatch(/\.filters\s*\{[^}]*grid-template-columns:\s*1fr;/);
    expect(base).not.toMatch(/grid-template-columns:\s*1fr 1fr/);
    expect(wide).toMatch(/grid-template-columns:\s*1fr 1fr 1fr/);
  });
});
