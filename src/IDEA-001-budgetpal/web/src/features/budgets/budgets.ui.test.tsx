import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import axe from 'axe-core';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setMatchMedia } from '../../test/setup';
import type { BudgetItem, BudgetStatus } from './api';
import { BudgetProgress } from './BudgetProgress';
import { BudgetsPage } from './BudgetsPage';

const routerFuture = { v7_startTransition: true, v7_relativeSplatPath: true } as const;
const here = dirname(fileURLToPath(import.meta.url));

const CATEGORIES = [
  { id: 10, name: 'Groceries', kind: 'expense' },
  { id: 12, name: 'Rent', kind: 'expense' },
];

const item = (name: string, percent: number, status: BudgetStatus): BudgetItem => ({
  categoryId: name.length,
  categoryName: name,
  budgetMinor: 10_000,
  spentMinor: percent * 100,
  percent,
  status,
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function mockApi(items: BudgetItem[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string) => {
      if (input === '/api/categories') return json(200, CATEGORIES);
      if (input.startsWith('/api/budgets?')) {
        const month = new URL(input, 'http://x').searchParams.get('month') ?? '';
        return json(200, { month, items, unbudgeted: [{ categoryId: 13, categoryName: 'Dining', spentMinor: 4_550 }] });
      }
      throw new Error(`unexpected request ${input}`);
    }),
  );
}

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

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.classList.remove('dark');
});

describe('SPEC-010 Story-001 budgets restyle', () => {
  it('SPEC-010 T-016 a budget row has a named Progress and a Badge with icon and text; the form uses Input and Button with inline errors', async () => {
    mockApi([item('Groceries', 62, 'ok')]);
    const { container } = renderPage();
    const list = await screen.findByRole('list', { name: 'Budgets' });
    const bar = within(list).getByRole('progressbar', { name: 'Groceries budget used' });
    expect(bar).toHaveAttribute('aria-valuenow', '62');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
    const badge = container.querySelector('[data-status-icon="ok"]')?.parentElement as HTMLElement;
    expect(badge.className).toMatch(/\brounded-full\b/);
    expect(badge).toHaveTextContent('✓');
    expect(badge).toHaveTextContent('Within budget');

    // The amount form: kit Input (rounded-md border-input) and Button (bg-primary), same inline errors as before.
    const amount = screen.getByLabelText('Budget amount');
    expect(amount.className).toMatch(/border-input/);
    const submit = screen.getByRole('button', { name: 'Set budget' });
    expect(submit.className).toMatch(/bg-primary/);
    fireEvent.click(submit);
    const category = screen.getByLabelText('Category');
    expect(await screen.findByText('Choose an expense category.')).toBeInTheDocument();
    expect(category).toHaveAttribute('aria-invalid', 'true');
    expect(category).toHaveAttribute('aria-describedby', 'budget-category-error');
    expect(amount).toHaveAttribute('aria-invalid', 'true');
    expect(amount.getAttribute('aria-describedby')).toContain('budget-amount-error');
  });

  it.each<[number, BudgetStatus, string, string]>([
    [79, 'ok', '✓', 'Within budget'],
    [80, 'warning', '⚠', 'Near limit: 80% used or more'],
    [100, 'warning', '⚠', 'Near limit: 80% used or more'],
    [101, 'over', '✕', 'Over budget'],
  ])('SPEC-010 T-017 at %s%% the status is %s with icon and text', (percent, status, icon, text) => {
    const { container } = render(<BudgetProgress item={item('Groceries', percent, status)} currency="USD" />);
    const glyph = container.querySelector(`[data-status-icon="${status}"]`) as HTMLElement;
    expect(glyph).toHaveTextContent(icon);
    expect(glyph).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText(text)).toBeInTheDocument();
    // The Badge colour is a status token, never the only cue.
    expect((glyph.parentElement as HTMLElement).className).toContain(`bg-status-${status}`);
  });

  it.each([
    ['light', false],
    ['dark', true],
  ])('SPEC-010 T-018 axe finds no serious or critical violation on the budgets page with all statuses (%s)', async (_name, dark) => {
    setMatchMedia({ dark });
    document.documentElement.classList.toggle('dark', dark);
    mockApi([item('Groceries', 62, 'ok'), item('Rent', 85, 'warning'), item('Travel', 150, 'over')]);
    const { container } = renderPage();
    await screen.findByRole('list', { name: 'Unbudgeted categories' });
    expect(await seriousViolations(container)).toEqual([]);
  });

  it('SPEC-010 T-019 controls are reachable with the focus ring class; no fixed width over 360 px', async () => {
    mockApi([item('Groceries', 62, 'ok')]);
    renderPage();
    await screen.findByRole('list', { name: 'Budgets' });
    const controls = [
      screen.getByLabelText('Month'),
      screen.getByLabelText('Category'),
      screen.getByLabelText('Budget amount'),
      screen.getByRole('button', { name: 'Set budget' }),
      screen.getByRole('button', { name: 'Remove budget for Groceries' }),
      screen.getByRole('button', { name: 'Add budget for Dining' }),
    ];
    for (const control of controls) {
      control.focus();
      expect(control).toHaveFocus();
      expect(control.className).toMatch(/focus-visible:ring-/);
    }
    for (const file of sources()) {
      const text = readFileSync(file, 'utf8');
      for (const match of text.matchAll(/(?:^|[\s"'`:])(?:min-)?w-(?:\[(\d+(?:\.\d+)?)(px|rem)\]|(\d+(?:\.\d+)?))(?=[\s"'`\\]|$)/gm)) {
        const px = match[1] ? Number(match[1]) * (match[2] === 'rem' ? 16 : 1) : Number(match[3]) * 4;
        expect(px, `${file}: ${match[0].trim()}`).toBeLessThanOrEqual(360);
      }
    }
  });

  it('SPEC-010 T-020 both CSS modules are gone, nothing imports one and no hard-coded colour remains', () => {
    expect(existsSync(join(here, 'BudgetsPage.module.css'))).toBe(false);
    expect(existsSync(join(here, 'BudgetProgress.module.css'))).toBe(false);
    for (const file of sources()) {
      const text = readFileSync(file, 'utf8');
      expect(file.endsWith('.css'), file).toBe(false);
      expect(text, file).not.toMatch(/\.module\.css/);
      expect(text, file).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(text, file).not.toMatch(/\b(?:rgb|rgba|hsl|hsla)\(/);
      expect(text, file).not.toMatch(/\b(?:bg|text|border|fill|stroke)-(?:red|green|blue|yellow|orange|amber|gray|slate|zinc|neutral|stone|emerald|teal|cyan|sky|indigo|violet|purple|pink|rose|white|black)(?:-\d+)?\b/);
      expect(text, file).not.toMatch(/style=\{\{/);
    }
  });
});
