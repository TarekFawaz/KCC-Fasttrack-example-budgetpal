import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import axe from 'axe-core';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Shell } from '../../kernel/Shell';
import { features } from '../../kernel/registry';
import feature from './feature';
import { ImportPage, formatMinor } from './ImportPage';
import { COMMIT_URL, PREVIEW_URL, type CommitResponse, type PreviewResponse } from './importApi';

const routerFuture = { v7_startTransition: true, v7_relativeSplatPath: true } as const;

const ACCOUNTS = [
  { id: 1, name: 'Main' },
  { id: 2, name: 'Wallet' },
];
const CATEGORIES = [
  { id: 10, name: 'Groceries', kind: 'expense' },
  { id: 11, name: 'Salary', kind: 'income' },
];

/** Shapes follow the api's `ImportPreviewResponse` and `ImportCommitResponse` (SPEC-006 Enabler-001). */
const PREVIEW: PreviewResponse = {
  headers: ['Booking Date', 'Memo', 'Amount'],
  hasHeader: true,
  suggestedMapping: { date: 0, amount: 2, description: 1 },
  rowCount: 4,
  validCount: 2,
  invalidCount: 1,
  validRows: [
    { line: 2, date: '2026-03-01', amountMinor: -1250, description: 'Coffee beans' },
    { line: 3, date: '2026-03-02', amountMinor: 250000, description: 'Salary March' },
  ],
  invalidRows: [{ line: 4, reason: 'Date is not a real date in YYYY-MM-DD format' }],
};
const COMMIT: CommitResponse = {
  imported: 8,
  skipped: 2,
  invalid: 1,
  invalidRows: [{ line: 4, reason: 'Amount must be a non-zero number with at most 2 decimals' }],
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/problem+json' } });

interface Call {
  url: string;
  form: FormData;
}
interface MockOptions {
  /** Answer for a preview request; receives the multipart form. */
  preview?: (form: FormData) => Response;
  commit?: () => Response;
  accounts?: unknown[];
}

/** Stubs fetch for the two pickers and the import routes; records every multipart request. */
function mockApi(options: MockOptions = {}) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init?: RequestInit) => {
      if (input === '/api/accounts') return json(200, options.accounts ?? ACCOUNTS);
      if (input === '/api/categories') return json(200, CATEGORIES);
      if (input === PREVIEW_URL || input === COMMIT_URL) {
        const form = init?.body as FormData;
        calls.push({ url: input, form });
        if (input === COMMIT_URL) return options.commit?.() ?? json(200, COMMIT);
        return options.preview?.(form) ?? json(200, PREVIEW);
      }
      throw new Error(`unexpected request ${input}`);
    }),
  );
  return calls;
}

const previews = (calls: Call[]) => calls.filter((call) => call.url === PREVIEW_URL);
const mappingOf = (call: Call | undefined) => JSON.parse(String(call?.form.get('mapping') ?? 'null')) as unknown;

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/import']} future={routerFuture}>
        <ImportPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const csvFile = () => new File(['Booking Date,Memo,Amount\n2026-03-01,Coffee,-12.50\n'], 'bank.csv', { type: 'text/csv' });

async function chooseFile() {
  const input = (await screen.findByLabelText('CSV file')) as HTMLInputElement;
  await waitFor(() => expect(input).not.toBeDisabled());
  fireEvent.change(input, { target: { files: [csvFile()] } });
  return input;
}

/** Uploads and waits until the suggested mapping is applied and the preview rows are on screen. */
async function uploadAndPreview(calls: Call[]) {
  await chooseFile();
  await screen.findByRole('heading', { level: 2, name: 'Preview' });
  await waitFor(() => expect(screen.getByLabelText('Amount column')).toHaveValue('2'));
  await waitFor(() => expect(previews(calls).length).toBeGreaterThanOrEqual(2));
  await screen.findByText('Coffee beans');
}

const serious = async (container: HTMLElement) => {
  // jsdom has no layout engine, so colour contrast is checked visually by the verifier.
  const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
  return results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id);
};

afterEach(() => vi.unstubAllGlobals());

describe('import feature registration and empty state (AC-1)', () => {
  it('T-031 feature.ts exports the Import entry and the registry lists it', () => {
    expect(feature).toMatchObject({ id: 'import', path: '/import', label: 'Import' });
    expect(feature.component).toBe(ImportPage);
    expect(features.find((entry) => entry.id === 'import')).toBe(feature);
  });

  it('T-031 the shell shows an "Import" nav entry that leads to the page', async () => {
    mockApi();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/']} future={routerFuture}>
          <Shell features={features} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const link = within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', { name: 'Import' });
    expect(link).toHaveAttribute('href', '/import');
    fireEvent.click(link);
    expect(await screen.findByRole('heading', { level: 1, name: 'Import transactions' })).toBeInTheDocument();
  });

  it('T-031 the empty state shows the file picker, the 5 MB / 5000-row limits and the UTF-8 note', async () => {
    const calls = mockApi();
    renderPage();
    const input = await screen.findByLabelText('CSV file');
    expect(input).toHaveAttribute('type', 'file');
    expect(screen.getByText(/5 MB/)).toBeInTheDocument();
    expect(screen.getByText(/5000 rows/)).toBeInTheDocument();
    expect(screen.getByText(/UTF-8/)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Preview' })).not.toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it('T-031 with no account the page points to Accounts and disables the picker', async () => {
    mockApi({ accounts: [] });
    renderPage();
    expect(await screen.findByRole('link', { name: 'Create an account' })).toHaveAttribute('href', '/accounts');
    expect(screen.getByLabelText('CSV file')).toBeDisabled();
  });
});

describe('mapping (AC-2)', () => {
  it('T-032 uploading asks for a preview, pre-fills the selects from the suggestion and asks again with the mapping', async () => {
    const calls = mockApi();
    renderPage();
    await uploadAndPreview(calls);

    const first = previews(calls)[0];
    expect(first?.form.get('mapping')).toBeNull();
    expect(first?.form.get('accountId')).toBe('1');
    expect((first?.form.get('file') as File).name).toBe('bank.csv');

    expect(screen.getByLabelText('Date column')).toHaveValue('0');
    expect(screen.getByLabelText('Amount column')).toHaveValue('2');
    expect(screen.getByLabelText('Description column')).toHaveValue('1');
    expect(screen.getByLabelText('Date format')).toHaveValue('YYYY-MM-DD');
    expect(screen.getByLabelText('Account')).toHaveValue('1');
    expect(screen.getByLabelText('Category for expenses (negative amounts)')).toHaveValue('10');
    expect(screen.getByLabelText('Category for income (positive amounts)')).toHaveValue('11');

    const second = previews(calls)[1];
    expect(mappingOf(second)).toEqual({ date: 0, amount: 2, description: 1 });
    expect(second?.form.get('dateFormat')).toBe('YYYY-MM-DD');
    expect(second?.form.get('expenseCategoryId')).toBe('10');
    expect(second?.form.get('incomeCategoryId')).toBe('11');
  });

  it('T-032 changing a select asks for a new preview with the new value', async () => {
    const calls = mockApi();
    renderPage();
    await uploadAndPreview(calls);
    const before = previews(calls).length;

    fireEvent.change(screen.getByLabelText('Date format'), { target: { value: 'DD/MM/YYYY' } });
    await waitFor(() => expect(previews(calls)).toHaveLength(before + 1));
    expect(previews(calls).at(-1)?.form.get('dateFormat')).toBe('DD/MM/YYYY');

    fireEvent.change(screen.getByLabelText('Amount column'), { target: { value: '1' } });
    await waitFor(() => expect(previews(calls)).toHaveLength(before + 2));
    expect(mappingOf(previews(calls).at(-1))).toEqual({ date: 0, amount: 1, description: 1 });

    fireEvent.change(screen.getByLabelText('Account'), { target: { value: '2' } });
    await waitFor(() => expect(previews(calls)).toHaveLength(before + 3));
    expect(previews(calls).at(-1)?.form.get('accountId')).toBe('2');
  });

  it('T-032 without a suggestion the selects start empty and no rows are requested until all three are chosen', async () => {
    const calls = mockApi({ preview: () => json(200, { ...PREVIEW, suggestedMapping: null, validRows: [], validCount: 0 }) });
    renderPage();
    await chooseFile();
    await screen.findByRole('heading', { name: 'Preview' });
    expect(screen.getByLabelText('Date column')).toHaveValue('');
    expect(screen.getByText(/Choose the date, amount and description columns/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Date column'), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText('Amount column'), { target: { value: '2' } });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(previews(calls)).toHaveLength(1);
    fireEvent.change(screen.getByLabelText('Description column'), { target: { value: '1' } });
    await waitFor(() => expect(previews(calls)).toHaveLength(2));
    expect(mappingOf(previews(calls)[1])).toEqual({ date: 0, amount: 2, description: 1 });
  });
});

describe('preview (AC-3)', () => {
  it('T-033 valid rows show in a table, invalid rows by line with the reason, and Import is enabled', async () => {
    const calls = mockApi();
    renderPage();
    await uploadAndPreview(calls);
    const table = screen.getByRole('table');
    expect(within(table).getByText('Coffee beans')).toBeInTheDocument();
    expect(within(table).getByText('2026-03-02')).toBeInTheDocument();
    // The amount cell also holds a decorative arrow and a hidden direction word, so match on the row text.
    const row = within(table).getByText('Coffee beans').closest('tr') as HTMLElement;
    expect(row).toHaveTextContent(formatMinor(-1250).replace(/\s+/g, ' '));
    expect(row).toHaveTextContent('(expense)');
    expect(screen.getByText('Line 4: Date is not a real date in YYYY-MM-DD format')).toBeInTheDocument();
    expect(screen.getByText(/2 valid and 1 invalid of 4 rows/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import' })).toBeEnabled();
  });

  it('T-033 Import is disabled while no valid row exists', async () => {
    const calls = mockApi({
      preview: () => json(200, { ...PREVIEW, validCount: 0, validRows: [], invalidCount: 2, rowCount: 2 }),
    });
    renderPage();
    await chooseFile();
    await waitFor(() => expect(previews(calls).length).toBeGreaterThanOrEqual(2));
    await screen.findByText(/0 valid and 2 invalid of 2 rows/);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled();
  });
});

describe('result (AC-4)', () => {
  it('T-034 confirming sends the commit and shows imported, skipped and invalid as text with an icon, the invalid lines and a link', async () => {
    const calls = mockApi();
    renderPage();
    await uploadAndPreview(calls);
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));

    const heading = await screen.findByRole('heading', { level: 2, name: 'Import result' });
    const commitCall = calls.find((call) => call.url === COMMIT_URL);
    expect(mappingOf(commitCall)).toEqual({ date: 0, amount: 2, description: 1 });
    expect(commitCall?.form.get('accountId')).toBe('1');

    const list = heading.parentElement as HTMLElement;
    expect(within(list).getByText('Imported: 8')).toBeInTheDocument();
    expect(within(list).getByText('Skipped (duplicates): 2')).toBeInTheDocument();
    expect(within(list).getByText('Invalid: 1')).toBeInTheDocument();
    // The icons are decorative and sit beside the text: the status never rests on colour.
    expect(list.querySelectorAll('li [aria-hidden="true"]')).toHaveLength(3);
    expect(screen.getByText('Line 4: Amount must be a non-zero number with at most 2 decimals')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View transactions' })).toHaveAttribute('href', '/transactions');
    expect(screen.queryByRole('button', { name: 'Import' })).not.toBeInTheDocument();
  });

  it('T-034 "Import another file" returns to the empty state', async () => {
    const calls = mockApi();
    renderPage();
    await uploadAndPreview(calls);
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    await screen.findByRole('heading', { name: 'Import result' });
    fireEvent.click(screen.getByRole('button', { name: 'Import another file' }));
    expect(await screen.findByLabelText('CSV file')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Preview' })).not.toBeInTheDocument();
  });
});

describe('errors and plain text (AC-5)', () => {
  it('T-035 a 400 with a field error shows it inline next to that control', async () => {
    let attempt = 0;
    const calls = mockApi({
      preview: () => {
        attempt += 1;
        return attempt === 1
          ? json(200, PREVIEW)
          : json(400, {
              type: 'about:blank',
              title: 'Bad Request',
              status: 400,
              detail: 'The mapping names a column the file does not have.',
              errors: [{ field: 'mapping.amount', message: 'The file has no such column.' }],
            });
      },
    });
    renderPage();
    await chooseFile();
    await screen.findByRole('heading', { name: 'Preview' });
    await waitFor(() => expect(previews(calls).length).toBeGreaterThanOrEqual(2));
    const select = screen.getByLabelText('Amount column');
    const message = await screen.findByText('The file has no such column.');
    expect(select).toHaveAttribute('aria-invalid', 'true');
    expect(document.getElementById(select.getAttribute('aria-describedby') as string)).toContainElement(message);
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled();
  });

  it('T-035 a 400 on the file shows next to the picker; a 404 shows next to the account select', async () => {
    mockApi({
      preview: () =>
        json(400, {
          type: 'about:blank',
          title: 'Bad Request',
          status: 400,
          detail: 'The file is larger than 5 MB.',
          errors: [{ field: 'file', message: 'The file is larger than 5 MB.' }],
        }),
    });
    renderPage();
    const input = await chooseFile();
    const message = await screen.findByText('The file is larger than 5 MB.');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(message).toHaveAttribute('id', 'import-file-error');
  });

  it('T-035 a 404 shows an inline error next to the account select', async () => {
    let attempt = 0;
    mockApi({
      preview: () => {
        attempt += 1;
        return attempt === 1 ? json(200, PREVIEW) : json(404, { type: 'about:blank', title: 'Not Found', status: 404, detail: 'No account with this id.' });
      },
    });
    renderPage();
    await chooseFile();
    await screen.findByRole('heading', { name: 'Preview' });
    const message = await screen.findByText('That account was not found. Choose another account.');
    expect(document.getElementById('import-account-error')).toBe(message);
    expect(screen.getByLabelText('Account')).toHaveAttribute('aria-invalid', 'true');
  });

  it('T-035 HTML and spreadsheet formulas in a cell render as plain text', async () => {
    const hostile: PreviewResponse = {
      ...PREVIEW,
      validRows: [
        { line: 2, date: '2026-03-01', amountMinor: -100, description: '<img src=x onerror=alert(1)>' },
        { line: 3, date: '2026-03-02', amountMinor: -200, description: '=SUM(A1)' },
      ],
      invalidRows: [{ line: 4, reason: '<script>alert(1)</script>' }],
    };
    mockApi({ preview: () => json(200, hostile) });
    const { container } = renderPage();
    await chooseFile();
    expect(await screen.findByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(screen.getByText('=SUM(A1)')).toBeInTheDocument();
    expect(screen.getByText('Line 4: <script>alert(1)</script>')).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
  });

  it('T-035 a failing commit shows its field error and stays on the preview', async () => {
    const calls = mockApi({
      commit: () =>
        json(400, {
          type: 'about:blank',
          title: 'Bad Request',
          status: 400,
          detail: 'The category does not exist.',
          errors: [{ field: 'expenseCategoryId', message: 'Choose one of your expense categories.' }],
        }),
    });
    renderPage();
    await uploadAndPreview(calls);
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    expect(await screen.findByText('Choose one of your expense categories.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Import result' })).not.toBeInTheDocument();
  });
});

describe('accessibility (AC-6)', () => {
  it('T-036 axe finds no serious violations on the empty, mapping, preview and result steps', async () => {
    const calls = mockApi();
    const { container } = renderPage();
    await screen.findByLabelText('CSV file');
    expect(await serious(container)).toEqual([]);

    await uploadAndPreview(calls);
    expect(screen.getByLabelText('Date column')).toBeInTheDocument();
    expect(await serious(container)).toEqual([]);
    expect(screen.getByRole('table')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    await screen.findByRole('heading', { name: 'Import result' });
    expect(await serious(container)).toEqual([]);
  });

  it('T-037 every control has a label and the tab order follows the page', async () => {
    const calls = mockApi();
    const { container } = renderPage();
    await uploadAndPreview(calls);
    const controls = Array.from(container.querySelectorAll<HTMLElement>('input, select, button'));
    expect(controls.length).toBeGreaterThanOrEqual(9);
    for (const control of controls) {
      const name = control.id ? container.querySelector(`label[for="${control.id}"]`)?.textContent : control.textContent;
      expect(name?.trim(), `control ${control.tagName} ${control.id}`).toBeTruthy();
    }
    expect(controls.map((control) => control.id || control.textContent)).toEqual([
      'import-file',
      'import-col-date',
      'import-col-amount',
      'import-col-description',
      'import-date-format',
      'import-account',
      'import-expense-category',
      'import-income-category',
      'Import',
    ]);
    expect(controls.every((control) => (control as HTMLInputElement).tabIndex >= 0)).toBe(true);
  });

  it('T-037 focus moves to the Preview heading, then to the result heading', async () => {
    const calls = mockApi();
    renderPage();
    await uploadAndPreview(calls);
    expect(screen.getByRole('heading', { name: 'Preview' })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    const result = await screen.findByRole('heading', { name: 'Import result' });
    await waitFor(() => expect(result).toHaveFocus());
  });
});
