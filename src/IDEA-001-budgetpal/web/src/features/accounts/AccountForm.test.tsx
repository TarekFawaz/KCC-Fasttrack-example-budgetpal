import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccountForm, splitProblem } from './AccountForm';

function json(status: number, body: unknown, type = 'application/json') {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': type } });
}
const problem = (status: number, detail: string, errors?: { field: string; message: string }[]) =>
  json(status, { type: 'about:blank', title: 'Problem', status, detail, errors }, 'application/problem+json');

/** Stubs fetch; records every call so a test can assert what was sent. */
function mockFetch(handler: (url: string, init?: RequestInit) => Response) {
  const calls: { method: string; url: string; body: unknown }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ method: init?.method ?? 'GET', url, body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined });
      return handler(url, init);
    }),
  );
  return calls;
}

function renderForm() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AccountForm />
    </QueryClientProvider>,
  );
}

const fill = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Add account' }));

afterEach(() => vi.unstubAllGlobals());

describe('AccountForm', () => {
  it('T-021 submit POSTs integer minor units, then resets the form', async () => {
    const calls = mockFetch(() => json(201, { id: 1, name: 'Main', type: 'savings', openingBalanceMinor: 123450, createdAt: 1, updatedAt: 1 }));
    renderForm();
    fill('Name', '  Main  ');
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'savings' } });
    fill('Opening balance', '1234.50');
    submit();
    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue(''));
    expect(calls).toContainEqual({
      method: 'POST',
      url: '/api/accounts',
      body: { name: 'Main', type: 'savings', openingBalanceMinor: 123450 },
    });
    expect(screen.getByLabelText('Opening balance')).toHaveValue('');
    expect(screen.getByLabelText('Type')).toHaveValue('checking');
  });

  it('T-021 a blank balance is sent as 0 and a negative one as negative minor units', async () => {
    const calls = mockFetch(() => json(201, { id: 1, name: 'x', type: 'cash', openingBalanceMinor: 0, createdAt: 1, updatedAt: 1 }));
    renderForm();
    fill('Name', 'Wallet');
    submit();
    await waitFor(() => expect(calls.some((call) => call.method === 'POST')).toBe(true));
    fill('Name', 'Card');
    fill('Opening balance', '-20');
    submit();
    await waitFor(() => expect(calls.filter((call) => call.method === 'POST')).toHaveLength(2));
    expect(calls.filter((call) => call.method === 'POST').map((call) => (call.body as { openingBalanceMinor: number }).openingBalanceMinor)).toEqual([0, -2000]);
  });

  it('T-021 an amount with too many decimals is refused before any request', async () => {
    const calls = mockFetch(() => json(500, {}));
    renderForm();
    fill('Name', 'Main');
    fill('Opening balance', '1.234');
    submit();
    await waitFor(() => expect(screen.getByLabelText('Opening balance')).toHaveFocus());
    expect(screen.getByLabelText('Opening balance')).toHaveAccessibleDescription(/at most 2 decimal places/);
    expect(calls).toHaveLength(0);
  });

  it('T-022 an empty name shows an inline error on the labelled input and focuses it', async () => {
    const calls = mockFetch(() => json(500, {}));
    renderForm();
    submit();
    const name = screen.getByLabelText('Name');
    await waitFor(() => expect(name).toHaveFocus());
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(name).toHaveAccessibleDescription('Enter a name for the account.');
    expect(calls).toHaveLength(0);
  });

  it('T-022 a 409 duplicate name shows its message next to Name and focuses it, keeping the typed values', async () => {
    mockFetch(() =>
      problem(409, 'An account with this name already exists.', [{ field: 'name', message: 'You already have an account with this name.' }]),
    );
    renderForm();
    fill('Name', 'Main');
    fill('Opening balance', '10');
    submit();
    const name = screen.getByLabelText('Name');
    await waitFor(() => expect(name).toHaveFocus());
    expect(name).toHaveAccessibleDescription(/You already have an account with this name\./);
    expect(screen.getByLabelText('Opening balance')).toHaveValue('10');
  });

  it('T-022 a 400 with several field errors shows each beside its input and focuses the first in form order', async () => {
    mockFetch(() =>
      problem(400, 'The request did not pass validation.', [
        { field: 'openingBalanceMinor', message: 'Opening balance is out of range' },
        { field: 'type', message: 'Invalid enum value' },
      ]),
    );
    renderForm();
    fill('Name', 'Main');
    submit();
    await waitFor(() => expect(screen.getByLabelText('Type')).toHaveFocus());
    expect(screen.getByLabelText('Type')).toHaveAccessibleDescription(/Invalid enum value/);
    expect(screen.getByLabelText('Opening balance')).toHaveAccessibleDescription(/Opening balance is out of range/);
  });

  it('T-022 a problem with no field of the form, and a server failure, show one alert', async () => {
    mockFetch(() => problem(400, 'The request did not pass validation.', [{ field: '(body)', message: 'Unrecognized key(s)' }]));
    renderForm();
    fill('Name', 'Main');
    submit();
    expect(await screen.findByRole('alert')).toHaveTextContent('Unrecognized key(s)');
    vi.unstubAllGlobals();

    mockFetch(() => json(500, { detail: 'internal' }));
    submit();
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Could not save the account right now. Try again.'));
    expect(screen.getByLabelText('Name')).toHaveValue('Main');
  });

  it('T-022 splitProblem maps api field names to form fields and keeps the rest', () => {
    expect(
      splitProblem([
        { field: 'openingBalanceMinor', message: 'a' },
        { field: 'name', message: 'b' },
        { field: 'name', message: 'second ignored' },
        { field: '(body)', message: 'c' },
      ]),
    ).toEqual({ fields: { openingBalance: 'a', name: 'b' }, rest: ['c'] });
  });
});

describe('AccountForm edit mode', () => {
  const existing = { id: 7, name: 'Main', type: 'savings' as const, openingBalanceMinor: 123450, createdAt: 1, updatedAt: 1 };

  function renderEdit(onSaved: () => void) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <AccountForm account={existing} onSaved={onSaved} />
      </QueryClientProvider>,
    );
  }

  it('T-024 starts with the account values, PUTs integer minor units and reports success', async () => {
    const calls = mockFetch(() => json(200, { ...existing, openingBalanceMinor: 500 }));
    const onSaved = vi.fn();
    renderEdit(onSaved);
    expect(screen.getByLabelText('Name')).toHaveValue('Main');
    expect(screen.getByLabelText('Type')).toHaveValue('savings');
    expect(screen.getByLabelText('Opening balance')).toHaveValue('1234.50');
    fill('Opening balance', '5');
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(calls).toContainEqual({
      method: 'PUT',
      url: '/api/accounts/7',
      body: { name: 'Main', type: 'savings', openingBalanceMinor: 500 },
    });
  });

  it('T-025 a 400 keeps the form open with the error beside the field and does not report success', async () => {
    mockFetch(() => problem(400, 'The request did not pass validation.', [{ field: 'name', message: 'Too long' }]));
    const onSaved = vi.fn();
    renderEdit(onSaved);
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveFocus());
    expect(screen.getByLabelText('Name')).toHaveAccessibleDescription(/Too long/);
    expect(onSaved).not.toHaveBeenCalled();
  });
});
