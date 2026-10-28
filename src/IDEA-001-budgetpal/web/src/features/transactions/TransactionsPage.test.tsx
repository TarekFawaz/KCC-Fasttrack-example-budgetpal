import { existsSync, readFileSync } from 'node:fs';
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
      'Actions',
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

  it('T-034 the layout is one column by default, uses tokens only and shows keyboard focus', () => {
    expect(existsSync(resolve(here, 'TransactionsPage.module.css'))).toBe(false);
    const page = readFileSync(resolve(here, 'TransactionsPage.tsx'), 'utf8');
    const form = readFileSync(resolve(here, 'TransactionForm.tsx'), 'utf8');
    for (const text of [page, form]) {
      expect(text).not.toMatch(/#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\(/);
      expect(text).not.toMatch(/style=\{\{/);
    }
    // Filters: one column, three from the md breakpoint. Controls carry the kit focus ring.
    expect(page).toMatch(/grid-cols-1[^'"`]*md:grid-cols-3/);
    expect(form).toMatch(/focus-visible:ring-/);
  });
});

interface Write {
  url: string;
  method: string;
  body: unknown;
}

/**
 * A fetch stub with a small in-memory store: POST, PATCH and DELETE change `rows`, and the list endpoint
 * serves the changed rows, so a refetch after a mutation shows the new state. Records every write.
 */
function mockCrudApi(initial: Transaction[], options: { accounts?: unknown[]; categories?: unknown[] } = {}) {
  const rows = [...initial];
  const writes: Write[] = [];
  let nextId = 100;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      if (input === '/api/accounts') return json(200, options.accounts ?? ACCOUNTS);
      if (input === '/api/categories') return json(200, options.categories ?? CATEGORIES);
      if (method === 'GET' && input.startsWith('/api/transactions?')) {
        const params = new URL(input, 'http://x').searchParams;
        const limit = Number(params.get('limit'));
        const offset = Number(params.get('offset'));
        return json(200, { items: rows.slice(offset, offset + limit), total: rows.length, limit, offset });
      }
      const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined;
      if (method === 'POST' && input === '/api/transactions' && body) {
        writes.push({ url: input, method, body });
        const created = { ...tx(nextId++), ...body } as Transaction;
        rows.unshift(created);
        return json(201, created);
      }
      const target = input.match(/^\/api\/transactions\/(\d+)$/);
      const index = target ? rows.findIndex((row) => row.id === Number(target[1])) : -1;
      if (method === 'PATCH' && index >= 0 && body) {
        writes.push({ url: input, method, body });
        rows[index] = { ...rows[index]!, ...body } as Transaction;
        return json(200, rows[index]);
      }
      if (method === 'DELETE' && index >= 0) {
        writes.push({ url: input, method, body });
        rows.splice(index, 1);
        return new Response(null, { status: 204 });
      }
      throw new Error(`unexpected request ${method} ${input}`);
    }),
  );
  return { rows, writes };
}

describe('TransactionsPage mounts the add, edit and delete UI (Bug-002)', () => {
  it('T-035 the page offers Add transaction; the opened form posts minor units and the new row appears in the list', async () => {
    const api = mockCrudApi([tx(1, { description: 'Weekly shop' })]);
    renderPage();
    await screen.findByRole('table');
    expect(screen.queryByRole('form', { name: 'Add a transaction' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Add transaction' }));
    const form = await screen.findByRole('form', { name: 'Add a transaction' });
    await within(form).findByRole('option', { name: 'Main' });
    fireEvent.change(within(form).getByLabelText('Date'), { target: { value: '2026-04-02' } });
    fireEvent.change(within(form).getByLabelText('Amount'), { target: { value: '12.50' } });
    fireEvent.change(within(form).getByLabelText('Description'), { target: { value: 'Coffee beans' } });
    fireEvent.change(within(form).getByLabelText('Account'), { target: { value: '1' } });
    fireEvent.change(within(form).getByLabelText('Category'), { target: { value: '10' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Add transaction' }));

    await waitFor(() =>
      expect(api.writes).toEqual([
        {
          url: '/api/transactions',
          method: 'POST',
          body: { accountId: 1, categoryId: 10, occurredOn: '2026-04-02', amountMinor: 1250, description: 'Coffee beans' },
        },
      ]),
    );
    // The list was fetched again: the new row is in the table and the form was reset.
    expect(await screen.findByRole('rowheader', { name: 'Coffee beans' })).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(3);
    // The dialog closes once the transaction is saved.
    await waitFor(() => expect(screen.queryByRole('form', { name: 'Add a transaction' })).not.toBeInTheDocument());
  });

  it('T-035 the add dialog closes with Escape and focus returns to the Add transaction button', async () => {
    mockCrudApi([tx(1)]);
    renderPage();
    await screen.findByRole('table');
    const trigger = screen.getByRole('button', { name: 'Add transaction' });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: 'Add a transaction' });
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('form', { name: 'Add a transaction' })).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('T-035 with no rows the empty state points at a real Add transaction control', async () => {
    mockCrudApi([]);
    renderPage();
    await screen.findByText(/You have no transactions yet/);
    fireEvent.click(screen.getByRole('button', { name: 'Add transaction' }));
    expect(await screen.findByRole('form', { name: 'Add a transaction' })).toBeInTheDocument();
  });

  it('T-038 Edit opens the form for that row with its values; saving sends a PATCH and the row updates', async () => {
    const api = mockCrudApi([tx(1, { description: 'Weekly shop' }), tx(2, { description: 'Bus' })]);
    renderPage();
    const table = await screen.findByRole('table');
    fireEvent.click(within(table).getByRole('button', { name: 'Edit Weekly shop' }));

    const form = await screen.findByRole('form', { name: 'Edit transaction Weekly shop' });
    await within(form).findByRole('option', { name: 'Main' });
    expect(within(form).getByLabelText('Amount')).toHaveValue('12.50');
    fireEvent.change(within(form).getByLabelText('Description'), { target: { value: 'Weekly shop (big)' } });
    fireEvent.change(within(form).getByLabelText('Amount'), { target: { value: '20' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(api.writes).toEqual([
        {
          url: '/api/transactions/1',
          method: 'PATCH',
          body: { accountId: 1, categoryId: 10, occurredOn: '2026-03-15', amountMinor: 2000, description: 'Weekly shop (big)' },
        },
      ]),
    );
    expect(await screen.findByRole('rowheader', { name: 'Weekly shop (big)' })).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: /^Edit transaction/ })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Edit Weekly shop (big)' })).toHaveFocus());
  });

  it('T-038 Cancel closes the edit form, sends nothing and returns focus to Edit', async () => {
    const api = mockCrudApi([tx(1, { description: 'Weekly shop' })]);
    renderPage();
    await screen.findByRole('table');
    fireEvent.click(screen.getByRole('button', { name: 'Edit Weekly shop' }));
    const form = await screen.findByRole('form', { name: 'Edit transaction Weekly shop' });
    await within(form).findByRole('option', { name: 'Main' });
    fireEvent.click(within(form).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('form', { name: /^Edit transaction/ })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Edit Weekly shop' })).toHaveFocus());
    expect(api.writes).toHaveLength(0);
  });

  it('T-038 only one row is edited at a time: the open dialog makes the other rows inert, and another row opens after closing', async () => {
    mockCrudApi([tx(1, { description: 'Weekly shop' }), tx(2, { description: 'Bus' })]);
    renderPage();
    await screen.findByRole('table');
    fireEvent.click(screen.getByRole('button', { name: 'Edit Weekly shop' }));
    await screen.findByRole('form', { name: 'Edit transaction Weekly shop' });
    expect(screen.queryByRole('button', { name: 'Edit Bus' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('form', { name: /^Edit transaction/ })).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Edit Bus' }));
    expect(await screen.findByRole('form', { name: 'Edit transaction Bus' })).toBeInTheDocument();
  });

  it('T-039 Delete and confirm removes the row from the list; focus moves to the list heading', async () => {
    const api = mockCrudApi([tx(1, { description: 'Weekly shop' }), tx(2, { description: 'Bus' })]);
    renderPage();
    await screen.findByRole('table');
    fireEvent.click(screen.getByRole('button', { name: 'Delete Weekly shop' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));

    await waitFor(() => expect(api.writes).toEqual([{ url: '/api/transactions/1', method: 'DELETE', body: undefined }]));
    await waitFor(() => expect(screen.queryByRole('rowheader', { name: 'Weekly shop' })).not.toBeInTheDocument());
    expect(screen.getByRole('rowheader', { name: 'Bus' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('heading', { level: 2, name: 'Your transactions' })).toHaveFocus());
  });

  it('T-039 cancelling the confirm keeps the row and sends nothing', async () => {
    const api = mockCrudApi([tx(1, { description: 'Weekly shop' })]);
    renderPage();
    await screen.findByRole('table');
    fireEvent.click(screen.getByRole('button', { name: 'Delete Weekly shop' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('rowheader', { name: 'Weekly shop' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Delete Weekly shop' })).toHaveFocus());
    expect(api.writes).toHaveLength(0);
  });

  it('T-040 with no accounts the opened add form says to create an account first', async () => {
    mockCrudApi([], { accounts: [] });
    renderPage();
    await screen.findByText(/You have no transactions yet/);
    fireEvent.click(screen.getByRole('button', { name: 'Add transaction' }));
    expect(await screen.findByText(/you first need an account/)).toHaveTextContent('Accounts page');
    expect(screen.queryByRole('form', { name: 'Add a transaction' })).not.toBeInTheDocument();
  });

  it('T-041 axe finds no serious or critical violation with the add dialog, an edit dialog and a delete confirm open, one at a time', async () => {
    mockCrudApi([tx(1, { description: 'Weekly shop' }), tx(2, { description: 'Bus' })]);
    renderPage();
    await screen.findByRole('table');

    fireEvent.click(screen.getByRole('button', { name: 'Add transaction' }));
    const add = await screen.findByRole('dialog', { name: 'Add a transaction' });
    await within(add).findByRole('option', { name: 'Main' });
    expect(await serious(add)).toEqual([]);
    fireEvent.click(within(add).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Edit Weekly shop' }));
    const edit = await screen.findByRole('dialog', { name: 'Edit Weekly shop' });
    await within(edit).findByRole('option', { name: 'Main' });
    expect(await serious(edit)).toEqual([]);
    fireEvent.click(within(edit).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Delete Bus' }));
    expect(await serious(await screen.findByRole('alertdialog'))).toEqual([]);
  });
});
