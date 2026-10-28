import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Transaction } from './api';
import { formatForInput, parseAmount } from './money';
import { DeleteTransaction, TransactionForm } from './TransactionForm';

const ACCOUNTS = [
  { id: 1, name: 'Main' },
  { id: 2, name: 'Wallet' },
];
const CATEGORIES = [
  { id: 10, name: 'Groceries', kind: 'expense' },
  { id: 11, name: 'Salary', kind: 'income' },
];

const existing: Transaction = {
  id: 7,
  accountId: 1,
  categoryId: 10,
  occurredOn: '2026-03-15',
  amountMinor: 1250,
  description: 'Weekly shop',
  createdAt: '2026-03-15T10:00:00.000Z',
  updatedAt: '2026-03-15T10:00:00.000Z',
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

interface Call {
  url: string;
  method: string;
  body: unknown;
}

/** Stubs fetch: the pickers plus the transaction mutation routes; records every call. */
function mockApi(options: { accounts?: unknown[]; categories?: unknown[]; mutate?: () => Response } = {}) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      calls.push({ url: input, method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (input === '/api/accounts') return json(200, options.accounts ?? ACCOUNTS);
      if (input === '/api/categories') return json(200, options.categories ?? CATEGORIES);
      if (input.startsWith('/api/transactions')) {
        if (options.mutate) return options.mutate();
        if (method === 'DELETE') return new Response(null, { status: 204 });
        return json(method === 'POST' ? 201 : 200, existing);
      }
      throw new Error(`unexpected request ${input}`);
    }),
  );
  return calls;
}

const writes = (calls: Call[]) => calls.filter((call) => call.method !== 'GET');

function renderUi(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const view = render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
  return { ...view, invalidate };
}

async function fillAdd(amount = '12.50') {
  await screen.findByRole('option', { name: 'Main' });
  fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-04-02' } });
  fireEvent.change(screen.getByLabelText('Amount'), { target: { value: amount } });
  fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Coffee beans' } });
  fireEvent.change(screen.getByLabelText('Account'), { target: { value: '1' } });
  fireEvent.change(screen.getByLabelText('Category'), { target: { value: '10' } });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('money.ts (AC-2)', () => {
  it('T-036 parses 12.50, 12 and 0.05 into minor units', () => {
    expect(parseAmount('12.50', 2)).toBe(1250);
    expect(parseAmount('12', 2)).toBe(1200);
    expect(parseAmount('0.05', 2)).toBe(5);
    expect(parseAmount('.5', 2)).toBe(50);
  });

  it('T-036 rejects 1.234, abc, blank, zero, signs and out-of-range text', () => {
    for (const bad of ['1.234', 'abc', '', ' ', '0', '0.00', '-5', '+5', '1e3', '1,5', '10000000000.00']) {
      expect(parseAmount(bad, 2), bad).toBeNull();
    }
    expect(parseAmount('12.5', 0)).toBeNull();
    expect(parseAmount('12', 0)).toBe(12);
  });

  it('T-036 formats minor units back to input text', () => {
    expect(formatForInput(1250, 2)).toBe('12.50');
    expect(formatForInput(5, 2)).toBe('0.05');
    expect(formatForInput(1200, 0)).toBe('1200');
  });
});

describe('TransactionForm add (AC-1..AC-3)', () => {
  it('T-035 submits the add form as minor units, refreshes the list and resets the form', async () => {
    const calls = mockApi();
    const { invalidate } = renderUi(<TransactionForm />);
    await fillAdd('12.50');
    fireEvent.click(screen.getByRole('button', { name: 'Add transaction' }));

    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    expect(writes(calls)[0]).toEqual({
      url: '/api/transactions',
      method: 'POST',
      body: { accountId: 1, categoryId: 10, occurredOn: '2026-04-02', amountMinor: 1250, description: 'Coffee beans' },
    });
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['transactions'] }));
    await waitFor(() => expect(screen.getByLabelText('Amount')).toHaveValue(''));
    expect(screen.getByLabelText('Description')).toHaveValue('');
    expect(screen.getByLabelText('Account')).toHaveValue('');
  });

  it('T-036 shows an inline error for invalid amount text and sends nothing', async () => {
    const calls = mockApi();
    renderUi(<TransactionForm />);
    await fillAdd('1.234');
    fireEvent.click(screen.getByRole('button', { name: 'Add transaction' }));

    const amount = screen.getByLabelText('Amount');
    expect(await screen.findByText(/at most 2 decimal places/)).toBeInTheDocument();
    expect(amount).toHaveAttribute('aria-invalid', 'true');
    expect(amount).toHaveFocus();
    expect(writes(calls)).toHaveLength(0);
  });

  it('T-037 renders server 400 field errors next to the inputs and keeps the entered values', async () => {
    mockApi({
      mutate: () =>
        json(400, {
          title: 'Bad Request',
          status: 400,
          detail: 'Invalid request',
          errors: [
            { field: 'accountId', message: 'Account not found' },
            { field: 'description', message: 'Description is required' },
          ],
        }),
    });
    renderUi(<TransactionForm />);
    await fillAdd('12.50');
    fireEvent.click(screen.getByRole('button', { name: 'Add transaction' }));

    const account = screen.getByLabelText('Account');
    await waitFor(() => expect(account).toHaveAttribute('aria-invalid', 'true'));
    expect(account).toHaveAccessibleDescription('Account not found');
    expect(screen.getByLabelText('Description')).toHaveAccessibleDescription('Description is required');
    expect(screen.getByLabelText('Amount')).toHaveValue('12.50');
    expect(screen.getByLabelText('Description')).toHaveValue('Coffee beans');
    expect(screen.getByLabelText('Date')).toHaveValue('2026-04-02');
    expect(screen.getByLabelText('Category')).toHaveValue('10');
  });

  it('T-037 maps an amountMinor server error onto the Amount input', async () => {
    mockApi({
      mutate: () =>
        json(400, {
          title: 'Bad Request',
          status: 400,
          detail: 'Invalid request',
          errors: [{ field: 'amountMinor', message: 'Amount is out of range' }],
        }),
    });
    renderUi(<TransactionForm />);
    await fillAdd('12.50');
    fireEvent.click(screen.getByRole('button', { name: 'Add transaction' }));
    await waitFor(() => expect(screen.getByLabelText('Amount')).toHaveAccessibleDescription(/Amount is out of range/));
  });

  it('T-037 shows a form-level alert when the save fails for another reason', async () => {
    mockApi({ mutate: () => json(500, { title: 'Error', status: 500, detail: 'boom' }) });
    renderUi(<TransactionForm />);
    await fillAdd('12.50');
    fireEvent.click(screen.getByRole('button', { name: 'Add transaction' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save the transaction right now');
    expect(screen.getByLabelText('Amount')).toHaveValue('12.50');
  });
});

describe('TransactionForm edit (AC-4)', () => {
  it('T-038 starts with the stored values, sends the PATCH on save and calls onSaved', async () => {
    const calls = mockApi();
    const onSaved = vi.fn();
    const { invalidate } = renderUi(<TransactionForm transaction={existing} onSaved={onSaved} />);
    await screen.findByRole('option', { name: 'Main' });
    expect(screen.getByLabelText('Amount')).toHaveValue('12.50');
    expect(screen.getByLabelText('Description')).toHaveValue('Weekly shop');

    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '20' } });
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: '11' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(writes(calls)[0]).toEqual({
      url: '/api/transactions/7',
      method: 'PATCH',
      body: { accountId: 1, categoryId: 11, occurredOn: '2026-03-15', amountMinor: 2000, description: 'Weekly shop' },
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['transactions'] });
  });

  it('T-038 Cancel calls onCancel and sends nothing', async () => {
    const calls = mockApi();
    const onCancel = vi.fn();
    renderUi(<TransactionForm transaction={existing} onCancel={onCancel} />);
    await screen.findByRole('option', { name: 'Main' });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(writes(calls)).toHaveLength(0);
  });
});

describe('DeleteTransaction (AC-5)', () => {
  it('T-039 confirm deletes, refreshes the list and calls onDeleted', async () => {
    const calls = mockApi();
    const onDeleted = vi.fn();
    const { invalidate } = renderUi(<DeleteTransaction transaction={existing} onDeleted={onDeleted} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete Weekly shop' }));
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('Weekly shop');
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));

    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
    expect(writes(calls)).toEqual([{ url: '/api/transactions/7', method: 'DELETE', body: undefined }]);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['transactions'] });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('T-039 cancel changes nothing, returns focus to Delete; Escape does the same', async () => {
    const calls = mockApi();
    renderUi(<DeleteTransaction transaction={existing} />);
    const trigger = screen.getByRole('button', { name: 'Delete Weekly shop' });
    trigger.focus();
    fireEvent.click(trigger);

    // The confirm is keyboard operable: it takes focus on the safe choice.
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    await waitFor(() => expect(cancel).toHaveFocus());
    fireEvent.click(cancel);
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Delete Weekly shop' })).toHaveFocus());

    fireEvent.click(screen.getByRole('button', { name: 'Delete Weekly shop' }));
    fireEvent.keyDown(await screen.findByRole('alertdialog'), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Delete Weekly shop' })).toHaveFocus());
    expect(writes(calls)).toHaveLength(0);
  });

  it('T-039 a failed delete keeps the confirm open with an alert', async () => {
    mockApi({ mutate: () => json(500, { title: 'Error', status: 500, detail: 'boom' }) });
    renderUi(<DeleteTransaction transaction={existing} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete Weekly shop' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not delete');
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });
});

describe('TransactionForm prerequisites (AC-6)', () => {
  it('T-040 with no accounts says to create an account first', async () => {
    mockApi({ accounts: [] });
    renderUi(<TransactionForm />);
    expect(await screen.findByText(/you first need an account/)).toHaveTextContent('Accounts page');
    expect(screen.queryByLabelText('Amount')).not.toBeInTheDocument();
  });

  it('T-040 with no categories says to create a category first', async () => {
    mockApi({ categories: [] });
    renderUi(<TransactionForm />);
    expect(await screen.findByText(/you first need a category/)).toHaveTextContent('Categories page');
  });

  it('T-040 with neither, names both', async () => {
    mockApi({ accounts: [], categories: [] });
    renderUi(<TransactionForm />);
    expect(await screen.findByText(/an account and a category/)).toBeInTheDocument();
  });
});

describe('TransactionForm accessibility (AC-7)', () => {
  async function violations(container: HTMLElement) {
    const result = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    return result.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  }

  it('T-041 axe finds no serious or critical violation in the add form, with errors shown', async () => {
    mockApi();
    const { container } = renderUi(<TransactionForm />);
    await screen.findByRole('option', { name: 'Main' });
    expect(await violations(container)).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Add transaction' }));
    await screen.findByText('Enter the date of the transaction.');
    expect(await violations(container)).toEqual([]);
  });

  it('T-041 axe is clean for the edit form and the open delete confirm', async () => {
    mockApi();
    const edit = renderUi(<TransactionForm transaction={existing} />);
    await screen.findByRole('option', { name: 'Main' });
    expect(await violations(edit.container)).toEqual([]);
    edit.unmount();

    const del = renderUi(<DeleteTransaction transaction={existing} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete Weekly shop' }));
    expect(await violations(del.container)).toEqual([]);
  });

  it('T-041 every control has a visible label', async () => {
    mockApi();
    renderUi(<TransactionForm />);
    await screen.findByRole('option', { name: 'Main' });
    for (const label of ['Date', 'Amount', 'Description', 'Account', 'Category']) {
      const control = screen.getByLabelText(label);
      const visible = document.querySelector(`label[for="${control.id}"]`);
      expect(visible, label).not.toBeNull();
      expect(visible?.textContent).toBe(label);
    }
  });
});
