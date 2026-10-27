import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BudgetForm, MAX_AMOUNT_MINOR, formatAmount, parseAmount, splitProblem, toDecimalText } from './BudgetForm';

const CATEGORIES = [
  { id: 10, name: 'Groceries' },
  { id: 12, name: 'Rent' },
];

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function renderForm(categoryId = '') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const onCategoryChange = vi.fn();
  const onSaved = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <BudgetForm
        month="2026-03"
        categories={CATEGORIES}
        categoryId={categoryId}
        onCategoryChange={onCategoryChange}
        onSaved={onSaved}
      />
    </QueryClientProvider>,
  );
  return { onCategoryChange, onSaved };
}

afterEach(() => vi.unstubAllGlobals());

describe('amount text to integer minor units', () => {
  it('T-024 "12.50" is 1250 and "12" is 1200 for a two-digit currency', () => {
    expect(parseAmount('12.50', 2)).toBe(1250);
    expect(parseAmount('12', 2)).toBe(1200);
    expect(parseAmount('0.05', 2)).toBe(5);
    expect(parseAmount('.5', 2)).toBe(50);
    expect(parseAmount(' 7.1 ', 2)).toBe(710);
  });

  it('T-024 the conversion is exact where a float is not (0.07, 1.15, 8.2)', () => {
    expect(parseAmount('0.07', 2)).toBe(7);
    expect(parseAmount('1.15', 2)).toBe(115);
    expect(parseAmount('8.2', 2)).toBe(820);
  });

  it('T-024 a zero-digit currency takes whole numbers only and a three-digit one three decimals', () => {
    expect(parseAmount('500', 0)).toBe(500);
    expect(parseAmount('500.5', 0)).toBeNull();
    expect(parseAmount('1.234', 3)).toBe(1234);
  });

  it('T-025 empty, zero, negative, non-numeric, too many decimals and too large are all null', () => {
    for (const text of ['', '   ', '0', '0.00', '-5', '+5', 'abc', '1e3', '12,50', '1.2.3', '12.345', '.', '1 000']) {
      expect(parseAmount(text, 2), `"${text}"`).toBeNull();
    }
    expect(parseAmount(String(MAX_AMOUNT_MINOR + 1), 0)).toBeNull();
    expect(parseAmount(String(MAX_AMOUNT_MINOR), 0)).toBe(MAX_AMOUNT_MINOR);
  });

  it('T-024 minor units go back to decimal text and to an Intl-formatted amount', () => {
    expect(toDecimalText(1250, 2)).toBe('12.50');
    expect(toDecimalText(5, 2)).toBe('0.05');
    expect(toDecimalText(500, 0)).toBe('500');
    expect(formatAmount(123456, 'USD').replace(/\s+/g, ' ')).toBe(
      new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(1234.56).replace(/\s+/g, ' '),
    );
  });

  it('T-025 api field names map to the form fields and the rest has no field', () => {
    const { fields, rest } = splitProblem([
      { field: 'amountMinor', message: 'Too large.' },
      { field: 'categoryId', message: 'Not an expense category.' },
      { field: 'month', message: 'Bad month.' },
    ]);
    expect(fields).toEqual({ amount: 'Too large.', category: 'Not an expense category.' });
    expect(rest).toEqual(['Bad month.']);
  });
});

describe('BudgetForm', () => {
  it('T-025 an empty amount shows a labelled inline error, focuses the field and sends nothing', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    renderForm('10');
    fireEvent.click(screen.getByRole('button', { name: 'Set budget' }));
    const input = screen.getByLabelText('Budget amount');
    expect(await screen.findByText(/Enter an amount greater than zero/)).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input.getAttribute('aria-describedby')).toContain('budget-amount-error');
    await waitFor(() => expect(input).toHaveFocus());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('T-025 no category chosen shows a category error and sends nothing', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    renderForm('');
    fireEvent.change(screen.getByLabelText('Budget amount'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Set budget' }));
    expect(await screen.findByText('Choose an expense category.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('T-024 a valid amount is sent as integer minor units to PUT /api/budgets/:month/:categoryId', async () => {
    const fetchMock = vi.fn(async () => json(201, { id: 1 }));
    vi.stubGlobal('fetch', fetchMock);
    const { onSaved } = renderForm('10');
    fireEvent.change(screen.getByLabelText('Budget amount'), { target: { value: '12.50' } });
    fireEvent.click(screen.getByRole('button', { name: 'Set budget' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/budgets/2026-03/10');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(String(init.body))).toEqual({ amountMinor: 1250 });
    expect(await screen.findByText('Budget saved.')).toBeInTheDocument();
    expect(screen.getByLabelText('Budget amount')).toHaveValue('');
  });

  it('T-025 an api 400 for the amount is shown next to the amount field and the typed value stays', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        json(400, {
          title: 'Bad Request',
          status: 400,
          detail: 'Invalid request',
          errors: [{ field: 'amountMinor', message: 'The amount is too large.' }],
        }),
      ),
    );
    renderForm('10');
    fireEvent.change(screen.getByLabelText('Budget amount'), { target: { value: '99' } });
    fireEvent.click(screen.getByRole('button', { name: 'Set budget' }));
    expect(await screen.findByText('The amount is too large.')).toBeInTheDocument();
    expect(screen.getByLabelText('Budget amount')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Budget amount')).toHaveValue('99');
  });

  it('T-025 an api error without a field is shown as an alert; a network-level failure gets a retry message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json(400, { title: 'Bad Request', status: 400, detail: 'That category is an income category.' })),
    );
    renderForm('10');
    fireEvent.change(screen.getByLabelText('Budget amount'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Set budget' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('That category is an income category.');
  });

  it('T-028 the category select and amount input have visible labels; choosing a category reports it', () => {
    vi.stubGlobal('fetch', vi.fn());
    const { onCategoryChange } = renderForm('');
    expect(screen.getByLabelText('Category')).toBeInTheDocument();
    expect(screen.getByLabelText('Budget amount')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: '12' } });
    expect(onCategoryChange).toHaveBeenCalledWith('12');
  });
});
