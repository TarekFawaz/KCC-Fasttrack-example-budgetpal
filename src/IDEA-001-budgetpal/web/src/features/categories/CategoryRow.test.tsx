import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import axe from 'axe-core';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CategoriesPage } from './CategoriesPage';

const routerFuture = { v7_startTransition: true, v7_relativeSplatPath: true } as const;

interface Stored {
  id: number;
  name: string;
  kind: 'expense' | 'income';
  createdAt: string;
}
const stored = (id: number, name: string, kind: Stored['kind']): Stored => ({ id, name, kind, createdAt: '2026-01-01T00:00:00.000Z' });

const json = (status: number, body: unknown, type = 'application/json') =>
  new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { 'content-type': type } });
const problem = (status: number, detail: string, errors?: { field: string; message: string }[]) =>
  json(status, { type: 'about:blank', title: 'Problem', status, detail, errors }, 'application/problem+json');

type Patch = { name?: string; kind?: Stored['kind'] };
interface Hooks {
  onPatch?: (id: number, body: Patch, list: Stored[]) => Response | undefined;
  onDelete?: (id: number, list: Stored[]) => Response | undefined;
}

/** In-memory api: PATCH and DELETE apply to the list unless a hook answers instead. Returns the recorded calls. */
function mockApi(initial: Stored[], hooks: Hooks = {}) {
  const list = [...initial];
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      calls.push(`${method} ${url}`);
      if (method === 'GET' && url === '/api/categories') return json(200, [...list].sort((a, b) => a.name.localeCompare(b.name)));
      const id = Number(url.split('/').pop());
      const target = list.find((item) => item.id === id);
      if (method === 'PATCH' && target) {
        const body = JSON.parse(init?.body as string) as Patch;
        const custom = hooks.onPatch?.(id, body, list);
        if (custom) return custom;
        Object.assign(target, body);
        return json(200, target);
      }
      if (method === 'DELETE' && target) {
        const custom = hooks.onDelete?.(id, list);
        if (custom) return custom;
        list.splice(list.indexOf(target), 1);
        return json(204, null);
      }
      throw new Error(`unexpected request ${method} ${url}`);
    }),
  );
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

const editForm = () => screen.getByRole('form', { name: /^Edit / });
const editName = () => within(editForm()).getByLabelText('Name');
const changing = (calls: string[]) => calls.filter((call) => !call.startsWith('GET'));
const rowOf = (name: string) => screen.getByText(name).closest('li') as HTMLElement;
const noViolations = async (container: HTMLElement) =>
  (await axe.run(container, { rules: { 'color-contrast': { enabled: false } } })).violations.map((v) => `${v.id}: ${v.help}`);

afterEach(() => vi.unstubAllGlobals());

describe('edit a category (Story-004 AC-1)', () => {
  it('T-029 Edit, change name and kind, Save shows the new values', async () => {
    const calls = mockApi([stored(1, 'Food', 'expense')]);
    renderPage();
    await screen.findByText('Food');

    fireEvent.click(screen.getByRole('button', { name: 'Edit Food' }));
    fireEvent.change(editName(), { target: { value: ' Groceries ' } });
    fireEvent.change(within(editForm()).getByLabelText('Kind'), { target: { value: 'income' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Food' }));

    const income = await screen.findByRole('region', { name: 'Income categories' });
    expect(within(income).getByText('Groceries')).toBeInTheDocument();
    expect(within(income).getByText('Income')).toBeInTheDocument();
    expect(screen.queryByText('Food')).not.toBeInTheDocument();
    expect(changing(calls)).toEqual(['PATCH /api/categories/1']);
  });

  it('T-030 Cancel restores the row and sends no request', async () => {
    const calls = mockApi([stored(1, 'Food', 'expense')]);
    renderPage();
    await screen.findByText('Food');

    fireEvent.click(screen.getByRole('button', { name: 'Edit Food' }));
    fireEvent.change(editName(), { target: { value: 'Other' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel editing Food' }));

    expect(screen.getByText('Food')).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: /^Edit / })).not.toBeInTheDocument();
    expect(changing(calls)).toEqual([]);
  });
});

describe('edit errors (Story-004 AC-2)', () => {
  it('T-031 an empty name and a 409 duplicate show an inline error on the row and keep edit mode', async () => {
    const calls = mockApi([stored(1, 'Food', 'expense'), stored(2, 'Rent', 'expense')], {
      onPatch: () => problem(409, 'A category with this name already exists.', [{ field: 'name', message: 'A category with this name already exists.' }]),
    });
    renderPage();
    await screen.findByText('Food');

    fireEvent.click(screen.getByRole('button', { name: 'Edit Food' }));
    const input = editName();
    fireEvent.change(input, { target: { value: '  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Food' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Name is required.');
    expect(input).toHaveAttribute('aria-describedby', alert.id);
    expect(changing(calls)).toEqual([]);

    fireEvent.change(input, { target: { value: 'rent' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Food' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('A category with this name already exists.'));
    expect(editName()).toHaveValue('rent');
    expect(screen.getByRole('button', { name: 'Save Food' })).toBeInTheDocument();
    expect(changing(calls)).toEqual(['PATCH /api/categories/1']);
  });
});

describe('delete a category (Story-004 AC-3, AC-4)', () => {
  it('T-032 Delete then confirm removes an unused category', async () => {
    const calls = mockApi([stored(1, 'Food', 'expense'), stored(2, 'Rent', 'expense')]);
    renderPage();
    await screen.findByText('Food');

    fireEvent.click(screen.getByRole('button', { name: 'Delete Food' }));
    expect(changing(calls)).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete Food' }));

    await waitFor(() => expect(screen.queryByText('Food')).not.toBeInTheDocument());
    expect(screen.getByText('Rent')).toBeInTheDocument();
    expect(changing(calls)).toEqual(['DELETE /api/categories/1']);
  });

  it('T-033 a 409 on delete keeps the row and says the category is in use', async () => {
    mockApi([stored(1, 'Food', 'expense')], {
      onDelete: () => problem(409, 'This category is in use and cannot be deleted.'),
    });
    renderPage();
    await screen.findByText('Food');

    fireEvent.click(screen.getByRole('button', { name: 'Delete Food' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete Food' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Food is in use and cannot be deleted.');
    expect(rowOf('Food')).toContainElement(alert);
    expect(screen.getByRole('button', { name: 'Edit Food' })).toBeInTheDocument();
  });
});

describe('keyboard, names, focus and axe (Story-004 AC-5)', () => {
  it('T-034 buttons carry the category name; focus moves to the field on Edit and back to the row after Save, Cancel and a refused delete', async () => {
    mockApi([stored(1, 'Food', 'expense'), stored(2, 'Rent', 'expense')], {
      onDelete: (id) => (id === 2 ? problem(409, 'This category is in use and cannot be deleted.') : undefined),
    });
    renderPage();
    await screen.findByText('Food');
    for (const name of ['Edit Food', 'Delete Food', 'Edit Rent', 'Delete Rent']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }

    fireEvent.click(screen.getByRole('button', { name: 'Edit Food' }));
    expect(editName()).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel editing Food' }));
    await waitFor(() => expect(rowOf('Food')).toHaveFocus());

    fireEvent.click(screen.getByRole('button', { name: 'Edit Food' }));
    fireEvent.change(editName(), { target: { value: 'Meals' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Food' }));
    await screen.findByText('Meals');
    await waitFor(() => expect(rowOf('Meals')).toHaveFocus());

    fireEvent.click(screen.getByRole('button', { name: 'Delete Rent' }));
    expect(screen.getByRole('button', { name: 'Confirm delete Rent' })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete Rent' }));
    await screen.findByRole('alert');
    await waitFor(() => expect(rowOf('Rent')).toHaveFocus());
  });

  it('T-035 axe reports no violations in view, edit, confirm and error states', async () => {
    mockApi([stored(1, 'Food', 'expense'), stored(2, 'Rent', 'expense')], {
      onDelete: () => problem(409, 'This category is in use and cannot be deleted.'),
    });
    const { container } = renderPage();
    await screen.findByText('Food');
    expect(await noViolations(container)).toEqual([]);

    fireEvent.click(screen.getByRole('button', { name: 'Edit Food' }));
    expect(await noViolations(container)).toEqual([]);
    fireEvent.change(editName(), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Food' }));
    await screen.findByRole('alert');
    expect(await noViolations(container)).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel editing Food' }));

    fireEvent.click(screen.getByRole('button', { name: 'Delete Rent' }));
    expect(await noViolations(container)).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete Rent' }));
    await screen.findByRole('alert');
    expect(await noViolations(container)).toEqual([]);
  });
});
