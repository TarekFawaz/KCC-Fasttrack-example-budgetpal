import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import axe from 'axe-core';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Shell } from '../../kernel/Shell';
import { buildRegistry, features } from '../../kernel/registry';
import { CategoriesPage } from './CategoriesPage';
import feature from './feature';

const routerFuture = { v7_startTransition: true, v7_relativeSplatPath: true } as const;

interface Stored {
  id: number;
  name: string;
  kind: 'expense' | 'income';
  createdAt: string;
}
const stored = (id: number, name: string, kind: Stored['kind']): Stored => ({ id, name, kind, createdAt: '2026-01-01T00:00:00.000Z' });

const json = (status: number, body: unknown, type = 'application/json') =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': type } });
const problem = (status: number, detail: string, errors?: { field: string; message: string }[]) =>
  json(status, { type: 'about:blank', title: 'Problem', status, detail, errors }, 'application/problem+json');

/** Stubs fetch with an in-memory list; `onPost` decides the answer to a create. Returns the recorded calls. */
function mockApi(initial: Stored[], onPost?: (body: { name: string; kind: Stored['kind'] }, list: Stored[]) => Response) {
  const list = [...initial];
  const calls: { key: string; body: unknown }[] = [];
  const stub = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as { name: string; kind: Stored['kind'] }) : undefined;
    calls.push({ key: `${method} ${url}`, body });
    if (method === 'GET' && url === '/api/categories') return json(200, list);
    if (method === 'POST' && url === '/api/categories' && body) {
      if (onPost) return onPost(body, list);
      const created = stored(list.length + 100, body.name, body.kind);
      list.push(created);
      return json(201, created);
    }
    throw new Error(`unexpected request ${method} ${url}`);
  });
  vi.stubGlobal('fetch', stub);
  return calls;
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/categories']} future={routerFuture}>
        <CategoriesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const fillName = (value: string) => fireEvent.change(screen.getByLabelText('Name'), { target: { value } });
const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Add category' }));
const posts = (calls: { key: string; body: unknown }[]) => calls.filter((call) => call.key.startsWith('POST'));

afterEach(() => vi.unstubAllGlobals());

describe('categories feature registration (Story-003 AC-1)', () => {
  it('T-023 feature.ts exports the route and a "Categories" nav entry that the kernel registry picks up', () => {
    expect(feature).toMatchObject({ id: 'categories', path: '/categories', label: 'Categories' });
    expect(features.some((f) => f.id === 'categories' && f.component === CategoriesPage)).toBe(true);
    expect(buildRegistry({ './categories/feature.ts': { default: feature } })).toEqual([feature]);

    mockApi([]);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/categories']} future={routerFuture}>
          <Shell features={features} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Categories' })).toHaveAttribute('href', '/categories');
    expect(screen.getByRole('heading', { level: 1, name: 'Categories' })).toBeInTheDocument();
  });
});

describe('categories list (Story-003 AC-2)', () => {
  it('T-024 an empty list shows the empty state that explains how to add the first category', async () => {
    mockApi([]);
    renderPage();
    const empty = await screen.findByText(/no categories yet/i);
    expect(empty).toHaveTextContent(/add category/i);
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('T-025 a filled list shows name and kind as text, expense and income labelled', async () => {
    mockApi([stored(1, 'Food', 'expense'), stored(2, 'Salary', 'income'), stored(3, 'Rent', 'expense')]);
    renderPage();
    const expenses = await screen.findByRole('region', { name: 'Expense categories' });
    const income = screen.getByRole('region', { name: 'Income categories' });
    const expenseItems = within(expenses).getAllByRole('listitem');
    // The kind is a Badge: an icon (decorative) plus the word.
    expect(expenseItems.map((item) => item.textContent)).toEqual(['Food↓ExpenseEditDelete', 'Rent↓ExpenseEditDelete']);
    expect(within(income).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Salary↑IncomeEditDelete']);
    expect(screen.queryByText(/no categories yet/i)).not.toBeInTheDocument();
  });
});

describe('create category (Story-003 AC-3)', () => {
  it('T-026 submitting a name and a kind adds the row and resets the form', async () => {
    const calls = mockApi([stored(1, 'Food', 'expense')]);
    renderPage();
    await screen.findByText('Food');

    fillName('  Salary ');
    fireEvent.change(screen.getByLabelText('Kind'), { target: { value: 'income' } });
    submit();

    const income = await screen.findByRole('region', { name: 'Income categories' });
    expect(within(income).getByText('Salary')).toBeInTheDocument();
    expect(posts(calls).map((call) => call.body)).toEqual([{ name: 'Salary', kind: 'income' }]);
    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue(''));
    expect(screen.getByLabelText('Kind')).toHaveValue('expense');
    expect(screen.getByLabelText('Name')).toHaveFocus();
  });
});

describe('inline errors (Story-003 AC-4)', () => {
  it('T-027 an empty name shows an announced inline error, sends nothing and leaves the list unchanged', async () => {
    const calls = mockApi([stored(1, 'Food', 'expense')]);
    renderPage();
    await screen.findByText('Food');

    fillName('   ');
    submit();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Name is required.');
    const input = screen.getByLabelText('Name');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input.getAttribute('aria-describedby')).toBe(alert.id);
    expect(input).toHaveFocus();
    expect(posts(calls)).toHaveLength(0);
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('T-027 a 409 duplicate shows the conflict next to the name field and the list is unchanged', async () => {
    mockApi([stored(1, 'Food', 'expense')], () =>
      problem(409, 'A category with this name already exists.', [
        { field: 'name', message: 'A category with this name already exists.' },
      ]),
    );
    renderPage();
    await screen.findByText('Food');

    fillName('food');
    submit();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('A category with this name already exists.');
    expect(screen.getByLabelText('Name')).toHaveAttribute('aria-describedby', alert.id);
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    // The typed value stays so the user can fix it.
    expect(screen.getByLabelText('Name')).toHaveValue('food');
  });

  it('T-027 a server 400 maps to the field and a server failure to a form-level message', async () => {
    let first = true;
    mockApi([], () => {
      if (first) {
        first = false;
        return problem(400, 'The request did not pass validation.', [{ field: 'kind', message: 'Kind must be expense or income.' }]);
      }
      return problem(500, 'An unexpected error occurred.');
    });
    renderPage();
    await screen.findByText(/no categories yet/i);

    fillName('Food');
    submit();
    expect(await screen.findByText('Kind must be expense or income.')).toBeInTheDocument();
    expect(screen.getByLabelText('Kind')).toHaveAttribute('aria-invalid', 'true');

    submit();
    await waitFor(() => expect(screen.getByText('Could not save the category right now. Try again.')).toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save the category right now.');
  });
});

describe('accessibility (Story-003 AC-5)', () => {
  it('T-028 axe reports no violations (empty, filled, error), inputs are found by label and tab order reaches the form', async () => {
    mockApi([stored(1, 'Food', 'expense'), stored(2, 'Salary', 'income')]);
    const { container } = renderPage();
    await screen.findByText('Food');

    // jsdom has no layout engine, so colour contrast is checked visually by the verifier.
    const run = async () => (await axe.run(container, { rules: { 'color-contrast': { enabled: false } } })).violations;
    expect((await run()).map((v) => `${v.id}: ${v.help}`)).toEqual([]);

    fillName('');
    submit();
    await screen.findByRole('alert');
    expect((await run()).map((v) => `${v.id}: ${v.help}`)).toEqual([]);

    expect(screen.getByLabelText('Name')).toBeInstanceOf(HTMLInputElement);
    expect(screen.getByLabelText('Kind')).toBeInstanceOf(HTMLSelectElement);
    const tabbable = Array.from(container.querySelectorAll<HTMLElement>('input, select, button, a[href], [tabindex]')).filter(
      (element) => element.tabIndex >= 0 && !element.hasAttribute('disabled'),
    );
    expect(tabbable.map((element) => element.id || element.textContent)).toEqual(['category-name', 'category-kind', 'Add category', 'Edit', 'Delete', 'Edit', 'Delete']);
  });

  it('T-028 axe reports no violations on the empty state', async () => {
    mockApi([]);
    const { container } = renderPage();
    await screen.findByText(/no categories yet/i);
    const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});
