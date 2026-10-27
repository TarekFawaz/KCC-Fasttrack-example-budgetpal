import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Shell } from '../../kernel/Shell';
import { features } from '../../kernel/registry';
import { currentMonth, type BudgetItem } from './api';
import { formatAmount } from './BudgetForm';
import { BudgetsPage } from './BudgetsPage';
import feature from './feature';

const routerFuture = { v7_startTransition: true, v7_relativeSplatPath: true } as const;
// Intl may use no-break spaces; expected text is collapsed the same way as the DOM text.
const collapse = (text: string) => text.replace(/\s+/g, ' ');
const money = (minor: number) => collapse(formatAmount(minor, 'USD'));

const CATEGORIES = [
  { id: 10, name: 'Groceries', kind: 'expense' },
  { id: 12, name: 'Rent', kind: 'expense' },
  { id: 11, name: 'Salary', kind: 'income' },
];

const item = (categoryId: number, name: string, budgetMinor: number, spentMinor = 0): BudgetItem => ({
  categoryId,
  categoryName: name,
  budgetMinor,
  spentMinor,
  percent: 0,
  status: 'ok',
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

interface Store {
  /** Budgets by `month`, keyed by category id. */
  byMonth: Map<string, Map<number, BudgetItem>>;
  requests: Array<{ url: string; method: string; body?: unknown }>;
}

/** Stubs fetch with a small in-memory budgets api: GET list, PUT upsert, DELETE; plus the categories list. */
function mockApi(options: { categories?: unknown[]; seed?: Record<string, BudgetItem[]>; deleteDeferred?: boolean } = {}) {
  const store: Store = { byMonth: new Map(), requests: [] };
  for (const [month, rows] of Object.entries(options.seed ?? {})) {
    store.byMonth.set(month, new Map(rows.map((row) => [row.categoryId, row])));
  }
  const releases: Array<() => void> = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init: RequestInit = {}) => {
      const method = init.method ?? 'GET';
      store.requests.push({ url: input, method, body: init.body ? JSON.parse(String(init.body)) : undefined });
      if (input === '/api/categories') return json(200, options.categories ?? CATEGORIES);
      if (input.startsWith('/api/budgets?')) {
        const month = new URL(input, 'http://x').searchParams.get('month') ?? '';
        return json(200, { month, items: [...(store.byMonth.get(month)?.values() ?? [])], unbudgeted: [] });
      }
      const match = /^\/api\/budgets\/(\d{4}-\d{2})\/(\d+)$/.exec(input);
      if (match) {
        const [, month = '', id = ''] = match;
        const rows = store.byMonth.get(month) ?? new Map<number, BudgetItem>();
        store.byMonth.set(month, rows);
        const categoryId = Number(id);
        if (method === 'PUT') {
          const amountMinor = (JSON.parse(String(init.body)) as { amountMinor: number }).amountMinor;
          const name = CATEGORIES.find((category) => category.id === categoryId)?.name ?? 'Other';
          const created = !rows.has(categoryId);
          rows.set(categoryId, item(categoryId, name, amountMinor));
          return json(created ? 201 : 200, { categoryId, month, amountMinor });
        }
        if (method === 'DELETE') {
          if (options.deleteDeferred) await new Promise<void>((resolve) => releases.push(resolve));
          rows.delete(categoryId);
          return new Response(null, { status: 204 });
        }
      }
      throw new Error(`unexpected request ${method} ${input}`);
    }),
  );
  return { store, release: () => releases.splice(0).forEach((resolve) => resolve()) };
}

const listMonths = (store: Store) =>
  store.requests.filter((request) => request.url.startsWith('/api/budgets?')).map((request) => new URL(request.url, 'http://x').searchParams.get('month'));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/budgets']} future={routerFuture}>
        <BudgetsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** The row of a budgeted category. Looked up inside the list: the category select repeats the names. */
const findRow = (name: string) =>
  waitFor(() => within(screen.getByRole('list', { name: 'Budgets' })).getByText(name)).then(
    (node) => node.closest('li') as HTMLElement,
  );
const hasRow = (name: string) => {
  const list = screen.queryByRole('list', { name: 'Budgets' });
  return list !== null && within(list).queryByText(name) !== null;
};

afterEach(() => vi.unstubAllGlobals());

describe('budgets feature registration', () => {
  it('T-022 feature.ts exports {id, path, label: "Budgets", order, component} and the registry lists it', () => {
    expect(feature).toMatchObject({ id: 'budgets', path: '/budgets', label: 'Budgets' });
    expect(typeof feature.order).toBe('number');
    expect(feature.component).toBe(BudgetsPage);
    expect(features.find((entry) => entry.id === 'budgets')).toBe(feature);
  });

  it('T-022 the shell shows a "Budgets" nav link that opens the page with the current month selected', async () => {
    const { store } = mockApi();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/']} future={routerFuture}>
          <Shell features={features} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const nav = screen.getByRole('navigation', { name: 'Main' });
    const link = within(nav).getByRole('link', { name: 'Budgets' });
    expect(link).toHaveAttribute('href', '/budgets');
    fireEvent.click(link);
    expect(await screen.findByRole('heading', { level: 1, name: 'Budgets' })).toBeInTheDocument();
    expect(screen.getByLabelText('Month')).toHaveValue(currentMonth());
    await waitFor(() => expect(listMonths(store)).toContain(currentMonth()));
  });

  it('T-022 currentMonth is YYYY-MM with the month zero-padded', () => {
    expect(currentMonth(new Date(2026, 0, 5))).toBe('2026-01');
    expect(currentMonth(new Date(2026, 11, 31))).toBe('2026-12');
  });
});

describe('BudgetsPage month picker', () => {
  it('T-023 changing the month refetches the list with the new month and shows that month', async () => {
    const { store } = mockApi({ seed: { '2026-03': [item(10, 'Groceries', 40000)], '2026-04': [item(12, 'Rent', 90000)] } });
    renderPage();
    const month = screen.getByLabelText('Month');
    fireEvent.change(month, { target: { value: '2026-03' } });
    await findRow('Groceries');
    fireEvent.change(month, { target: { value: '2026-04' } });
    await findRow('Rent');
    expect(hasRow('Groceries')).toBe(false);
    expect(listMonths(store)).toEqual(expect.arrayContaining(['2026-03', '2026-04']));
  });

  it('T-023 a cleared month asks for a month and sends no list request for it', async () => {
    const { store } = mockApi();
    renderPage();
    await screen.findByLabelText('Budget amount');
    const before = listMonths(store).length;
    fireEvent.change(screen.getByLabelText('Month'), { target: { value: '' } });
    expect(await screen.findByText('Choose a month to see and set its budgets.')).toBeInTheDocument();
    expect(listMonths(store)).toHaveLength(before);
  });
});

describe('BudgetsPage set and remove', () => {
  it('T-024 "12.50" saves amountMinor 1250 for the selected month and the list shows the formatted amount', async () => {
    const { store } = mockApi();
    renderPage();
    fireEvent.change(screen.getByLabelText('Month'), { target: { value: '2026-03' } });
    await screen.findByText(/You have no budgets for this month/);
    fireEvent.change(await screen.findByLabelText('Category'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Budget amount'), { target: { value: '12.50' } });
    fireEvent.click(screen.getByRole('button', { name: 'Set budget' }));

    const row = await findRow('Groceries');
    expect(row).toHaveTextContent(`Budget: ${money(1250)}`);
    const put = store.requests.find((request) => request.method === 'PUT');
    expect(put).toMatchObject({ url: '/api/budgets/2026-03/10', body: { amountMinor: 1250 } });
    expect(screen.queryByText(/You have no budgets for this month/)).not.toBeInTheDocument();
  });

  it('T-024 saving the same category again replaces the amount in the list (one row)', async () => {
    mockApi({ seed: { '2026-03': [item(10, 'Groceries', 1000)] } });
    renderPage();
    fireEvent.change(screen.getByLabelText('Month'), { target: { value: '2026-03' } });
    await findRow('Groceries');
    fireEvent.change(await screen.findByLabelText('Category'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Budget amount'), { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Set budget' }));
    await waitFor(async () => expect(await findRow('Groceries')).toHaveTextContent(`Budget: ${money(3000)}`));
    expect(within(screen.getByRole('list', { name: 'Budgets' })).getAllByRole('listitem')).toHaveLength(1);
  });

  it('T-025 a zero amount shows the inline error and sends no PUT', async () => {
    const { store } = mockApi();
    renderPage();
    fireEvent.change(await screen.findByLabelText('Category'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Budget amount'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Set budget' }));
    expect(await screen.findByText(/Enter an amount greater than zero/)).toBeInTheDocument();
    expect(store.requests.some((request) => request.method === 'PUT')).toBe(false);
  });

  it('T-026 Remove keeps the row until the api confirms, then the row disappears', async () => {
    const { release } = mockApi({ seed: { '2026-03': [item(10, 'Groceries', 40000), item(12, 'Rent', 90000)] }, deleteDeferred: true });
    renderPage();
    fireEvent.change(screen.getByLabelText('Month'), { target: { value: '2026-03' } });
    await findRow('Groceries');
    fireEvent.click(screen.getByRole('button', { name: 'Remove budget for Groceries' }));
    // Request in flight: the row is still there and its button is busy.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Remove budget for Groceries' })).toBeDisabled());
    expect(hasRow('Groceries')).toBe(true);
    release();
    await waitFor(() => expect(hasRow('Groceries')).toBe(false));
    expect(hasRow('Rent')).toBe(true);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Budgets for this month' })).toHaveFocus());
  });

  it('T-026 a failed remove leaves the row and shows an alert', async () => {
    mockApi({ seed: { '2026-03': [item(10, 'Groceries', 40000)] } });
    renderPage();
    fireEvent.change(screen.getByLabelText('Month'), { target: { value: '2026-03' } });
    await findRow('Groceries');
    const original = globalThis.fetch;
    vi.stubGlobal('fetch', vi.fn(async (input: string, init?: RequestInit) =>
      init?.method === 'DELETE' ? json(500, { title: 'Error', status: 500, detail: 'boom' }) : original(input, init),
    ));
    fireEvent.click(screen.getByRole('button', { name: 'Remove budget for Groceries' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not remove the budget right now.');
    expect(hasRow('Groceries')).toBe(true);
  });
});

describe('BudgetsPage empty states', () => {
  it('T-027 no budgets for the month: the empty state names the next step and the form is available', async () => {
    mockApi();
    renderPage();
    expect(await screen.findByText(/You have no budgets for this month\. To plan your spending, choose a category/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Set budget' })).toBeInTheDocument();
  });

  it('T-027 no expense categories (only income): the empty state points to the Categories page and offers no form', async () => {
    mockApi({ categories: [{ id: 11, name: 'Salary', kind: 'income' }] });
    renderPage();
    expect(await screen.findByText(/You have no expense categories yet\. Create one on the Categories page/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Set budget' })).not.toBeInTheDocument();
  });

  it('T-027 income categories are not offered in the category select', async () => {
    mockApi();
    renderPage();
    const select = await screen.findByLabelText('Category');
    const names = within(select).getAllByRole('option').map((option) => option.textContent);
    expect(names).toEqual(['Choose a category', 'Groceries', 'Rent']);
  });
});

describe('BudgetsPage keyboard and labels', () => {
  it('T-028 the month, category, amount, save and remove controls are reachable, labelled and in tab order', async () => {
    mockApi({ seed: { '2026-03': [item(10, 'Groceries', 40000)] } });
    renderPage();
    fireEvent.change(screen.getByLabelText('Month'), { target: { value: '2026-03' } });
    await findRow('Groceries');
    await screen.findByLabelText('Category');

    const controls = [
      screen.getByLabelText('Month'),
      screen.getByLabelText('Category'),
      screen.getByLabelText('Budget amount'),
      screen.getByRole('button', { name: 'Set budget' }),
      screen.getByRole('button', { name: 'Remove budget for Groceries' }),
    ];
    for (const control of controls) {
      expect(control).not.toBeDisabled();
      expect(control.getAttribute('tabindex')).not.toBe('-1');
    }
    // DOM order is tab order: no positive tabindex anywhere on the page.
    expect(document.querySelectorAll('[tabindex]:not([tabindex="-1"]):not([tabindex="0"])')).toHaveLength(0);
    const positions = controls.map((control) => Array.from(document.querySelectorAll('*')).indexOf(control));
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('T-028 a failed validation puts focus on the amount field (the first invalid control)', async () => {
    mockApi();
    renderPage();
    fireEvent.change(await screen.findByLabelText('Category'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Set budget' }));
    await waitFor(() => expect(screen.getByLabelText('Budget amount')).toHaveFocus());
  });
});
