import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import axe from 'axe-core';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setMatchMedia } from '../../test/setup';
import { ImportPage } from './ImportPage';
import { COMMIT_URL, PREVIEW_URL, type CommitResponse, type PreviewResponse } from './importApi';

const routerFuture = { v7_startTransition: true, v7_relativeSplatPath: true } as const;
const here = dirname(fileURLToPath(import.meta.url));

const PREVIEW: PreviewResponse = {
  headers: ['Booking Date', 'Memo', 'Amount'],
  hasHeader: true,
  suggestedMapping: { date: 0, amount: 2, description: 1 },
  rowCount: 4,
  validCount: 2,
  invalidCount: 1,
  validRows: [
    { line: 2, date: '2026-03-01', amountMinor: -1250, description: '=SUM(A1)' },
    { line: 3, date: '2026-03-02', amountMinor: 250000, description: 'Salary March' },
  ],
  invalidRows: [{ line: 4, reason: 'Date is not a real date in YYYY-MM-DD format' }],
};
const COMMIT: CommitResponse = { imported: 8, skipped: 2, invalid: 0, invalidRows: [] };

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function mockApi() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string) => {
      if (input === '/api/accounts') return json(200, [{ id: 1, name: 'Main' }]);
      if (input === '/api/categories') {
        return json(200, [
          { id: 10, name: 'Groceries', kind: 'expense' },
          { id: 11, name: 'Salary', kind: 'income' },
        ]);
      }
      if (input === PREVIEW_URL) return json(200, PREVIEW);
      if (input === COMMIT_URL) return json(200, COMMIT);
      throw new Error(`unexpected request ${input}`);
    }),
  );
}

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

async function uploadAndPreview() {
  const input = (await screen.findByLabelText('CSV file')) as HTMLInputElement;
  await waitFor(() => expect(input).not.toBeDisabled());
  fireEvent.change(input, {
    target: { files: [new File(['Booking Date,Memo,Amount\n'], 'bank.csv', { type: 'text/csv' })] },
  });
  await screen.findByRole('heading', { level: 2, name: 'Preview' });
  await waitFor(() => expect(screen.getByLabelText('Amount column')).toHaveValue('2'));
  await screen.findByText('=SUM(A1)');
}

const seriousViolations = async (container: HTMLElement) => {
  // jsdom applies no CSS, so contrast is proven by the token-pair tests, not by axe.
  const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
  return results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id);
};

function sources(): string[] {
  return readdirSync(here, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(ts|tsx|css)$/.test(entry.name) && !/\.test\./.test(entry.name))
    .map((entry) => join(here, entry.name));
}

const current = () => document.querySelector('[aria-current="step"]');

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.classList.remove('dark');
});

describe('SPEC-010 Story-003 import restyle', () => {
  it('SPEC-010 T-032 the stepper marks the current step with aria-current and moves from file to preview to result', async () => {
    mockApi();
    renderPage();
    const steps = within(await screen.findByRole('navigation', { name: 'Import steps' }));
    expect(steps.getAllByRole('listitem')).toHaveLength(4);
    expect(current()).toHaveTextContent('Choose a file');
    // The stepper shows progress only: it adds no button and no link to the tab order.
    expect(steps.queryAllByRole('button')).toHaveLength(0);

    await uploadAndPreview();
    expect(current()).toHaveTextContent('Preview and import');

    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    await screen.findByRole('heading', { level: 2, name: 'Import result' });
    expect(current()).toHaveTextContent('Result');
    expect(screen.getByRole('link', { name: 'View transactions' }).className).toMatch(/bg-primary/);
  });

  it('SPEC-010 T-033 the preview is a kit Table in its own scroll container, with a per-line error list and the direction as icon plus text', async () => {
    mockApi();
    renderPage();
    await uploadAndPreview();
    const table = screen.getByRole('table', { name: 'First 2 valid rows' });
    expect(table.parentElement?.className).toMatch(/overflow-x-auto/);
    expect(within(table).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual([
      'Line',
      'Date',
      'Description',
      'Amount',
    ]);
    expect(within(table).getByText('(expense)')).toBeInTheDocument();
    expect(within(table).getByText('(income)')).toBeInTheDocument();
    expect(screen.getByText('Line 4: Date is not a real date in YYYY-MM-DD format')).toBeInTheDocument();
  });

  it('SPEC-010 T-033 a formula-looking description is plain text, never evaluated or turned into markup', async () => {
    mockApi();
    renderPage();
    await uploadAndPreview();
    const cell = screen.getByText('=SUM(A1)');
    expect(cell.tagName).toBe('TD');
    expect(cell.children).toHaveLength(0);
    expect(cell.textContent).toBe('=SUM(A1)');
  });

  it('SPEC-010 T-034 the controls are kit controls with the focus ring', async () => {
    mockApi();
    renderPage();
    await uploadAndPreview();
    const controls = [
      screen.getByLabelText('CSV file'),
      screen.getByLabelText('Date column'),
      screen.getByLabelText('Date format'),
      screen.getByRole('button', { name: 'Import' }),
    ];
    for (const control of controls) {
      control.focus();
      expect(control).toHaveFocus();
      expect(control.className).toMatch(/focus-visible:ring-/);
    }
  });

  it.each([
    ['light', false],
    ['dark', true],
  ])('SPEC-010 T-034 axe finds no serious or critical violation on the preview and on the result (%s)', async (_name, dark) => {
    setMatchMedia({ dark });
    document.documentElement.classList.toggle('dark', dark);
    mockApi();
    const { container } = renderPage();
    await uploadAndPreview();
    expect(await seriousViolations(container)).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    await screen.findByRole('heading', { level: 2, name: 'Import result' });
    expect(await seriousViolations(container)).toEqual([]);
  });

  it('SPEC-010 T-035 the CSS module is gone, no hard-coded colour, inline style or fixed width over 360 px remains', () => {
    expect(existsSync(join(here, 'ImportPage.module.css'))).toBe(false);
    for (const file of sources()) {
      const text = readFileSync(file, 'utf8');
      expect(file.endsWith('.css'), file).toBe(false);
      expect(text, file).not.toMatch(/\.module\.css/);
      expect(text, file).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(text, file).not.toMatch(/\b(?:rgb|rgba|hsl|hsla)\(/);
      expect(text, file).not.toMatch(/style=\{\{/);
      expect(text, file).not.toMatch(/\b(?:bg|text|border|fill|stroke)-(?:red|green|blue|yellow|orange|amber|gray|slate|zinc|neutral|stone|white|black)(?:-\d+)?\b/);
      for (const match of text.matchAll(/(?:^|[\s"'`:])(?:min-)?w-(?:\[(\d+(?:\.\d+)?)(px|rem)\]|(\d+(?:\.\d+)?))(?=[\s"'`\\]|$)/gm)) {
        const px = match[1] ? Number(match[1]) * (match[2] === 'rem' ? 16 : 1) : Number(match[3]) * 4;
        expect(px, `${file}: ${match[0].trim()}`).toBeLessThanOrEqual(360);
      }
    }
  });
});
