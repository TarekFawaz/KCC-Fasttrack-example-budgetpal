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
import type { Account } from './accounts.api';
import { AccountsPage } from './AccountsPage';
import feature from './feature';

const here = dirname(fileURLToPath(import.meta.url));
const routerFuture = { v7_startTransition: true, v7_relativeSplatPath: true } as const;
// toHaveTextContent collapses whitespace runs (Intl uses no-break spaces in some locales), so the expected text is collapsed the same way.
const currency = (value: number) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(value).replace(/\s+/g, ' ');

const account = (id: number, name: string, type: Account['type'], openingBalanceMinor: number): Account => ({
  id,
  name,
  type,
  openingBalanceMinor,
  createdAt: 1,
  updatedAt: 1,
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

/** Stubs fetch with an in-memory account list that POST appends to. */
function mockApi(initial: Account[]) {
  const store = [...initial];
  const calls: { method: string; url: string; body: unknown }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
      calls.push({ method, url, body });
      if (method === 'GET' && url === '/api/accounts') return json(200, store);
      if (method === 'POST' && url === '/api/accounts') {
        const created = account(store.length + 1, body.name, body.type, body.openingBalanceMinor);
        store.push(created);
        return json(201, created);
      }
      throw new Error(`unexpected request ${method} ${url}`);
    }),
  );
  return calls;
}

function renderPage(ui = <AccountsPage />) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/accounts']} future={routerFuture}>
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

describe('accounts feature registration', () => {
  it('T-018 feature.ts exports {id, path, label: "Accounts", order, component} and the registry lists it', () => {
    expect(feature).toMatchObject({ id: 'accounts', path: '/accounts', label: 'Accounts' });
    expect(typeof feature.order).toBe('number');
    expect(feature.component).toBe(AccountsPage);
    expect(features.find((entry) => entry.id === 'accounts')).toBe(feature);
  });

  it('T-018 the shell shows an "Accounts" nav entry that routes to the page, with no shared file edited', async () => {
    mockApi([]);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/']} future={routerFuture}>
          <Shell features={features} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const nav = screen.getByRole('navigation', { name: 'Main' });
    fireEvent.click(within(nav).getByRole('link', { name: 'Accounts' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Accounts' })).toBeInTheDocument();
  });
});

describe('AccountsPage', () => {
  it('T-019 with no accounts it shows an empty state that explains how to add the first one', async () => {
    mockApi([]);
    renderPage();
    const empty = await screen.findByText(/You have no accounts yet/);
    expect(empty).toHaveTextContent(/enter a name/i);
    expect(empty).toHaveTextContent(/Add account/);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('T-020 each row shows name, type and the Intl-formatted opening balance in the install currency', async () => {
    mockApi([account(1, 'Main', 'checking', 123450), account(2, 'Card', 'credit_card', -2000), account(3, 'Wallet', 'cash', 0)]);
    renderPage();
    const table = await screen.findByRole('table');
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(3);
    expect(within(rows[0]!).getByRole('rowheader')).toHaveTextContent('Main');
    expect(rows[0]).toHaveTextContent('Checking');
    expect(rows[0]).toHaveTextContent(currency(1234.5));
    expect(rows[1]).toHaveTextContent('Credit card');
    expect(rows[1]).toHaveTextContent(currency(-20));
    expect(rows[2]).toHaveTextContent(currency(0));
    expect(screen.queryByText(/You have no accounts yet/)).not.toBeInTheDocument();
  });

  it('T-021 adding an account sends minor units, the new row appears and the form resets', async () => {
    const calls = mockApi([]);
    renderPage();
    await screen.findByText(/You have no accounts yet/);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Savings' } });
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'savings' } });
    fireEvent.change(screen.getByLabelText('Opening balance'), { target: { value: '1234.50' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add account' }));

    const table = await screen.findByRole('table');
    expect(table).toHaveTextContent('Savings');
    expect(table).toHaveTextContent(currency(1234.5));
    expect(calls).toContainEqual({ method: 'POST', url: '/api/accounts', body: { name: 'Savings', type: 'savings', openingBalanceMinor: 123450 } });
    expect(screen.getByLabelText('Name')).toHaveValue('');
    expect(screen.getByLabelText('Opening balance')).toHaveValue('');
  });

  it('T-022 a failing list shows one alert instead of rows', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(500, { detail: 'internal' })));
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load your accounts.');
  });

  it('T-023 axe finds no serious or critical violation on the empty and the populated page; inputs are labelled', async () => {
    mockApi([]);
    const empty = renderPage();
    await screen.findByText(/You have no accounts yet/);
    expect(await serious(empty.container)).toEqual([]);
    for (const label of ['Name', 'Type', 'Opening balance']) expect(screen.getByLabelText(label)).toBeInTheDocument();
    empty.unmount();

    mockApi([account(1, 'Main', 'checking', 123450), account(2, 'Card', 'credit_card', -2000)]);
    const populated = renderPage();
    await screen.findByRole('table');
    expect(await serious(populated.container)).toEqual([]);
  });

  it('T-023 axe finds no serious or critical violation while the form shows field errors', async () => {
    mockApi([]);
    const { container } = renderPage();
    await screen.findByText(/You have no accounts yet/);
    fireEvent.click(screen.getByRole('button', { name: 'Add account' }));
    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true'));
    expect(await serious(container)).toEqual([]);
  });

  it('T-023 styles use CSS variables only, the layout is one column below 768 px, and no browser storage is used', () => {
    const css = readFileSync(resolve(here, 'accounts.module.css'), 'utf8');
    const sources = ['AccountsPage.tsx', 'AccountForm.tsx', 'accounts.api.ts', 'money.ts', 'feature.ts'].map((file) =>
      readFileSync(resolve(here, file), 'utf8'),
    );
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/);
    expect(css).toMatch(/:focus-visible|var\(--/);
    // The base .form is a single column; columns appear only inside the min-width: 768px query.
    const [base, wide] = css.split('@media (min-width: 768px)');
    expect(base).toMatch(/\.form \{[^}]*grid-template-columns: 1fr;/);
    expect(wide).toMatch(/grid-template-columns: 2fr 1fr 1fr auto/);
    for (const source of sources) {
      expect(source).not.toMatch(/\b(local|session)Storage\b|dangerouslySetInnerHTML|parseFloat\(|\.toFixed\(/);
      // SR-007: a feature imports nothing from a sibling feature (only ../../kernel/...).
      expect(source).not.toMatch(/from\s+['"]\.\.\/[^.'"]|from\s+['"]\.\.\/\.\.\/features\//);
    }
  });
});
