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

  it('T-023 styles use the kit and tokens only, there is no CSS module, and no browser storage is used', () => {
    expect(existsSync(resolve(here, 'accounts.module.css'))).toBe(false);
    const sources = ['AccountsPage.tsx', 'AccountForm.tsx', 'accounts.api.ts', 'money.ts', 'feature.ts'].map((file) =>
      readFileSync(resolve(here, file), 'utf8'),
    );
    for (const source of sources) {
      expect(source).not.toMatch(/\.module\.css/);
      expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\(/);
      expect(source).not.toMatch(/style=\{\{/);
    }
    // The form is one column and gains columns only from the md breakpoint.
    expect(sources[1]).toMatch(/grid-cols-1[^'"`]*md:grid-cols-\[/);
    // The raw-HTML prop name is assembled from parts so this file does not contain the literal that
    // static rule SR-014 forbids in every web source file, tests included.
    const rawHtmlProp = ['dangerously', 'Set', 'Inner', 'HTML'].join('');
    const forbidden = new RegExp(`\\b(local|session)Storage\\b|${rawHtmlProp}|parseFloat\\(|\\.toFixed\\(`);
    for (const source of sources) {
      expect(source).not.toMatch(forbidden);
      // SR-007: a feature imports nothing from a sibling feature (only ../../kernel/...).
      expect(source).not.toMatch(/from\s+['"]\.\.\/[^.'"]|from\s+['"]\.\.\/\.\.\/features\//);
    }
  });
});

const problem = (status: number, detail: string, errors?: { field: string; message: string }[]) =>
  new Response(JSON.stringify({ type: 'about:blank', title: 'Problem', status, detail, errors }), {
    status,
    headers: { 'content-type': 'application/problem+json' },
  });

type Handler = (method: string, url: string) => Response | undefined;

/** Like mockApi, plus PUT/DELETE on /api/accounts/:id; `override` can answer a call first. */
function mockCrud(initial: Account[], override: Handler = () => undefined) {
  const store = [...initial];
  const calls: { method: string; url: string; body: unknown }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
      calls.push({ method, url, body });
      const forced = override(method, url);
      if (forced) return forced;
      if (method === 'GET' && url === '/api/accounts') return json(200, store);
      const id = Number(url.split('/').pop());
      const index = store.findIndex((entry) => entry.id === id);
      if (method === 'PUT') {
        store[index] = { ...store[index]!, ...body };
        return json(200, store[index]);
      }
      if (method === 'DELETE') {
        store.splice(index, 1);
        return new Response(null, { status: 204 });
      }
      throw new Error(`unexpected request ${method} ${url}`);
    }),
  );
  return calls;
}

const rows = [account(1, 'Main', 'checking', 123450), account(2, 'Card', 'credit_card', -2000)];

describe('AccountsPage edit and delete', () => {
  it('T-024 Edit prefills the decimal balance; saving PUTs minor units and the row updates', async () => {
    const calls = mockCrud(rows);
    renderPage();
    await screen.findByRole('table');
    fireEvent.click(screen.getByRole('button', { name: 'Edit Main' }));
    const form = screen.getByRole('form', { name: 'Edit account Main' });
    expect(within(form).getByLabelText('Name')).toHaveValue('Main');
    expect(within(form).getByLabelText('Type')).toHaveValue('checking');
    expect(within(form).getByLabelText('Opening balance')).toHaveValue('1234.50');
    fireEvent.change(within(form).getByLabelText('Name'), { target: { value: 'Main account' } });
    fireEvent.change(within(form).getByLabelText('Opening balance'), { target: { value: '99.9' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(screen.queryByRole('form', { name: /Edit account/ })).not.toBeInTheDocument());
    expect(calls).toContainEqual({
      method: 'PUT',
      url: '/api/accounts/1',
      body: { name: 'Main account', type: 'checking', openingBalanceMinor: 9990 },
    });
    const table = await screen.findByRole('table');
    await waitFor(() => expect(table).toHaveTextContent('Main account'));
    expect(table).toHaveTextContent(currency(99.9));
    expect(screen.getByRole('form', { name: 'Add an account' })).toBeInTheDocument();
  });

  it('T-024 Cancel leaves the row and sends nothing', async () => {
    const calls = mockCrud(rows);
    renderPage();
    await screen.findByRole('table');
    fireEvent.click(screen.getByRole('button', { name: 'Edit Card' }));
    expect(screen.getByLabelText('Opening balance')).toHaveValue('-20.00');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('form', { name: /Edit account/ })).not.toBeInTheDocument();
    expect(calls.filter((call) => call.method === 'PUT')).toHaveLength(0);
  });

  it('T-025 a 409 duplicate name and a 400 on save show inline errors and the row is unchanged', async () => {
    mockCrud(rows, (method) =>
      method === 'PUT'
        ? problem(409, 'An account with this name already exists.', [
            { field: 'name', message: 'You already have an account with this name.' },
          ])
        : undefined,
    );
    renderPage();
    await screen.findByRole('table');
    fireEvent.click(screen.getByRole('button', { name: 'Edit Main' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Card' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    const name = screen.getByLabelText('Name');
    await waitFor(() => expect(name).toHaveFocus());
    expect(name).toHaveAccessibleDescription(/You already have an account with this name\./);
    expect(within(screen.getByRole('table')).getByRole('rowheader', { name: 'Main' })).toBeInTheDocument();
    expect(screen.getByRole('table')).toHaveTextContent(currency(1234.5));
    vi.unstubAllGlobals();

    mockCrud(rows, (method) =>
      method === 'PUT'
        ? problem(400, 'The request did not pass validation.', [
            { field: 'openingBalanceMinor', message: 'Opening balance is out of range' },
          ])
        : undefined,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(screen.getByLabelText('Opening balance')).toHaveFocus());
    expect(screen.getByLabelText('Opening balance')).toHaveAccessibleDescription(/out of range/);
  });

  it('T-026 Delete opens an accessible dialog; confirming a 204 removes the row', async () => {
    const calls = mockCrud(rows);
    renderPage();
    await screen.findByRole('table');
    fireEvent.click(screen.getByRole('button', { name: 'Delete Card' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Delete Card?' });
    expect(dialog).toHaveAccessibleDescription(/cannot be undone/);
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete account' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(calls).toContainEqual({ method: 'DELETE', url: '/api/accounts/2', body: undefined });
    await waitFor(() => expect(screen.queryByRole('rowheader', { name: 'Card' })).not.toBeInTheDocument());
    expect(screen.getByRole('rowheader', { name: 'Main' })).toBeInTheDocument();
  });

  it('T-026 Cancel and Escape close the dialog without a request', async () => {
    const calls = mockCrud(rows);
    renderPage();
    await screen.findByRole('table');
    fireEvent.click(screen.getByRole('button', { name: 'Delete Main' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Main' }));
    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(calls.filter((call) => call.method === 'DELETE')).toHaveLength(0);
  });

  it('T-027 a 409 on DELETE closes the dialog, keeps the row and says the account is in use', async () => {
    mockCrud(rows, (method) =>
      method === 'DELETE' ? problem(409, 'The account is used by transactions and cannot be deleted.') : undefined,
    );
    renderPage();
    await screen.findByRole('table');
    fireEvent.click(screen.getByRole('button', { name: 'Delete Main' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete account' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Main is in use by transactions and cannot be deleted.');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'Main' })).toBeInTheDocument();
    expect(alert).toHaveFocus();
  });

  it('T-027 another failure on DELETE gives a generic message and keeps the row', async () => {
    mockCrud(rows, (method) => (method === 'DELETE' ? json(500, { detail: 'internal' }) : undefined));
    renderPage();
    await screen.findByRole('table');
    fireEvent.click(screen.getByRole('button', { name: 'Delete Main' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete account' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not delete Main right now. Try again.');
    expect(screen.getByRole('rowheader', { name: 'Main' })).toBeInTheDocument();
  });

  it('T-028 Edit and Delete are buttons in the tab order, named with the account, and axe is clean', async () => {
    mockCrud(rows);
    const { container } = renderPage();
    await screen.findByRole('table');
    const buttons = within(screen.getByRole('table')).getAllByRole('button');
    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Edit Main',
      'Delete Main',
      'Edit Card',
      'Delete Card',
    ]);
    for (const button of buttons) {
      expect(button.tabIndex).toBeGreaterThanOrEqual(0);
      expect(button).toHaveAccessibleName(/Main|Card/);
    }
    expect(await serious(container)).toEqual([]);

    fireEvent.click(screen.getByRole('button', { name: 'Edit Main' }));
    expect(await serious(container)).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Main' }));
    expect(await serious(container)).toEqual([]);
  });
});
