import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import axe from 'axe-core';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BudgetItem, BudgetStatus, UnbudgetedItem } from './api';
import { formatAmount } from './BudgetForm';
import { BudgetProgress, STATUS_LABEL, barPercent } from './BudgetProgress';
import { BudgetsPage } from './BudgetsPage';
import { setMatchMedia } from '../../test/setup';

// The theme tokens (SPEC-010 D-25) are what the contrast test reads, as text.
const indexCss = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'index.css'), 'utf8');

const routerFuture = { v7_startTransition: true, v7_relativeSplatPath: true } as const;
// Intl may use no-break spaces; expected text is collapsed the same way as the DOM text.
const collapse = (text: string) => text.replace(/\s+/g, ' ');
const money = (minor: number) => collapse(formatAmount(minor, 'USD'));

const CATEGORIES = [
  { id: 10, name: 'Groceries', kind: 'expense' },
  { id: 12, name: 'Rent', kind: 'expense' },
  { id: 13, name: 'Dining', kind: 'expense' },
  { id: 11, name: 'Salary', kind: 'income' },
];

const item = (
  categoryId: number,
  categoryName: string,
  budgetMinor: number,
  spentMinor: number,
  status: BudgetStatus,
  percent: number,
): BudgetItem => ({ categoryId, categoryName, budgetMinor, spentMinor, percent, status });

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

/** Stubs fetch: the categories list and one month's progress (`items` and `unbudgeted`). */
function mockApi(items: BudgetItem[], unbudgeted: UnbudgetedItem[] = []) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string) => {
      if (input === '/api/categories') return json(200, CATEGORIES);
      if (input.startsWith('/api/budgets?')) {
        const month = new URL(input, 'http://x').searchParams.get('month') ?? '';
        return json(200, { month, items, unbudgeted });
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

/** Makes `prefers-color-scheme: dark` match (or not) and mirrors the scheme as a class for the test. */
function mockColorScheme(dark: boolean) {
  setMatchMedia({ dark });
  document.documentElement.classList.toggle('dark', dark);
}

const seriousViolations = async (container: HTMLElement) => {
  // jsdom has no layout engine, so contrast is checked on the CSS tokens below and visually by the verifier.
  const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
  return results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id);
};

// ---- contrast on the theme tokens (index.css) ----

type Tokens = Record<string, string>;

/** `--name: H S% L%` declarations of one CSS text. */
function hslTokens(css: string): Tokens {
  const tokens: Tokens = {};
  for (const match of css.matchAll(/--([a-z-]+0?\d?):\s*(\d+(?:\.\d+)?\s+\d+(?:\.\d+)?%\s+\d+(?:\.\d+)?%)\s*;/g)) {
    tokens[match[1] as string] = match[2] as string;
  }
  return tokens;
}

/** Light tokens come first; the dark media block overrides them. */
function schemeTokens(css: string, dark: boolean): Tokens {
  const at = css.indexOf('@media (prefers-color-scheme: dark)');
  expect(at).toBeGreaterThan(-1);
  const light = hslTokens(css.slice(0, at));
  return dark ? { ...light, ...hslTokens(css.slice(at)) } : light;
}

function luminance(hsl: string): number {
  const [h, s, l] = hsl.replace(/%/g, '').split(/\s+/).map(Number) as [number, number, number];
  const sat = s / 100;
  const light = l / 100;
  const a = sat * Math.min(light, 1 - light);
  const channel = (n: number) => {
    const k = (n + h / 30) % 12;
    const value = light - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(8) + 0.0722 * channel(4);
}

function contrast(foreground: string, background: string): number {
  const [a, b] = [luminance(foreground), luminance(background)].sort((x, y) => y - x) as [number, number];
  return (a + 0.05) / (b + 0.05);
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.classList.remove('dark');
});

/** The Progress indicator: the bar fill whose transform shows the used share. */
const indicator = (bar: HTMLElement) => bar.firstElementChild as HTMLElement;

describe('BudgetProgress row', () => {
  it('T-029 shows category, spent, budget and percent, and a progressbar with a name and aria-valuenow', () => {
    render(<BudgetProgress item={item(10, 'Groceries', 50_000, 31_000, 'ok', 62)} currency="USD" />);
    expect(screen.getByText('Groceries')).toBeInTheDocument();
    expect(screen.getByText(`Budget: ${money(50_000)}`)).toBeInTheDocument();
    expect(screen.getByText(`Spent: ${money(31_000)}`)).toBeInTheDocument();
    expect(screen.getByText('62% used')).toBeInTheDocument();
    const bar = screen.getByRole('progressbar', { name: 'Groceries budget used' });
    expect(bar).toHaveAttribute('aria-valuenow', '62');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
    expect(bar).toHaveAttribute('aria-valuetext', '62% of the budget used');
    expect(indicator(bar)).toHaveStyle({ transform: 'translateX(-38%)' });
  });

  it('T-029 the page renders each budget as a row with its progressbar and a Remove button', async () => {
    mockApi([item(10, 'Groceries', 50_000, 31_000, 'ok', 62), item(12, 'Rent', 100_000, 85_000, 'warning', 85)]);
    renderPage();
    const list = await screen.findByRole('list', { name: 'Budgets' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(within(list).getByRole('progressbar', { name: 'Rent budget used' })).toHaveAttribute('aria-valuenow', '85');
    expect(within(list).getByRole('button', { name: 'Remove budget for Rent' })).toBeInTheDocument();
  });

  it.each<[BudgetStatus, number, string, string]>([
    ['ok', 40, '✓', 'Within budget'],
    ['warning', 85, '⚠', 'Near limit: 80% used or more'],
    ['over', 120, '✕', 'Over budget'],
  ])('T-030 status %s renders its icon and the exact text', (status, percent, icon, text) => {
    const { container } = render(<BudgetProgress item={item(10, 'Groceries', 1000, percent * 10, status, percent)} currency="USD" />);
    expect(screen.getByText(text, { selector: 'span' })).toBeInTheDocument();
    const glyph = container.querySelector(`[data-status-icon="${status}"]`);
    expect(glyph).toHaveTextContent(icon);
    // The icon is decoration for the text; assistive technology reads the text.
    expect(glyph).toHaveAttribute('aria-hidden', 'true');
    expect(STATUS_LABEL[status]).toEqual({ icon, text });
  });

  it('T-030 the three statuses differ in icon and text, not in colour alone', () => {
    const icons = new Set(Object.values(STATUS_LABEL).map((entry) => entry.icon));
    const texts = new Set(Object.values(STATUS_LABEL).map((entry) => entry.text));
    expect(icons.size).toBe(3);
    expect(texts.size).toBe(3);
  });

  it('T-031 at 150% spent the bar is capped at full width and the amount over the budget is stated', () => {
    render(<BudgetProgress item={item(10, 'Groceries', 20_000, 30_000, 'over', 150)} currency="USD" />);
    expect(indicator(screen.getByRole('progressbar'))).toHaveStyle({ transform: 'translateX(-0%)' });
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', '150% of the budget used');
    expect(screen.getByText('150% used')).toBeInTheDocument();
    expect(screen.getByText(`Over budget by ${money(10_000)}`)).toBeInTheDocument();
  });

  it('T-031 within the budget there is no over-by text, and exactly at the limit there is none either', () => {
    const { rerender } = render(<BudgetProgress item={item(10, 'Groceries', 20_000, 15_000, 'ok', 75)} currency="USD" />);
    expect(screen.queryByText(/Over budget by/)).not.toBeInTheDocument();
    rerender(<BudgetProgress item={item(10, 'Groceries', 20_000, 20_000, 'warning', 100)} currency="USD" />);
    expect(screen.queryByText(/Over budget by/)).not.toBeInTheDocument();
    expect(indicator(screen.getByRole('progressbar'))).toHaveStyle({ transform: 'translateX(-0%)' });
  });

  it('T-031 barPercent keeps the bar inside its track for any figure', () => {
    expect(barPercent(0)).toBe(0);
    expect(barPercent(62)).toBe(62);
    expect(barPercent(100)).toBe(100);
    expect(barPercent(10_000)).toBe(100);
    expect(barPercent(-5)).toBe(0);
    expect(barPercent(Number.NaN)).toBe(0);
  });
});

describe('BudgetsPage unbudgeted categories', () => {
  it('T-032 lists unbudgeted expense categories with their spending and an "Add budget" action', async () => {
    mockApi([item(10, 'Groceries', 50_000, 31_000, 'ok', 62)], [{ categoryId: 13, categoryName: 'Dining', spentMinor: 4_550 }]);
    renderPage();
    const list = await screen.findByRole('list', { name: 'Unbudgeted categories' });
    expect(within(list).getByText('Dining')).toBeInTheDocument();
    expect(within(list).getByText(`Spent: ${money(4_550)}`)).toBeInTheDocument();
    const add = within(list).getByRole('button', { name: 'Add budget for Dining' });
    expect(add).toHaveTextContent('Add budget');
  });

  it('T-032 "Add budget" preselects the category and focuses the amount field', async () => {
    mockApi([], [{ categoryId: 13, categoryName: 'Dining', spentMinor: 4_550 }]);
    renderPage();
    const add = await screen.findByRole('button', { name: 'Add budget for Dining' });
    await screen.findByLabelText('Budget amount');
    fireEvent.click(add);
    const amount = screen.getByLabelText('Budget amount');
    await waitFor(() => expect(amount).toHaveFocus());
    expect(screen.getByLabelText('Category')).toHaveValue('13');
  });

  it('T-032 with nothing unbudgeted the section is not shown, and income categories are never offered', async () => {
    mockApi([item(10, 'Groceries', 50_000, 31_000, 'ok', 62)], []);
    renderPage();
    await screen.findByRole('list', { name: 'Budgets' });
    expect(screen.queryByText('Spending without a budget')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add budget for/ })).not.toBeInTheDocument();
  });
});

describe('budgets page accessibility and layout', () => {
  const seed = () =>
    mockApi(
      [
        item(10, 'Groceries', 50_000, 31_000, 'ok', 62),
        item(12, 'Rent', 100_000, 85_000, 'warning', 85),
        item(14, 'Travel', 20_000, 30_000, 'over', 150),
      ],
      [{ categoryId: 13, categoryName: 'Dining', spentMinor: 4_550 }],
    );

  it.each([
    ['light', false],
    ['dark', true],
  ])('T-033 axe finds no serious or critical violation with all three states and unbudgeted rows (%s)', async (_name, dark) => {
    mockColorScheme(dark);
    seed();
    const { container } = renderPage();
    await screen.findByRole('list', { name: 'Unbudgeted categories' });
    expect(await seriousViolations(container)).toEqual([]);
  });

  it.each([
    ['light', false],
    ['dark', true],
  ])('SPEC-010 T-021 the status tokens meet 4.5:1 for text and 3:1 for the bar (%s)', (_name, dark) => {
    const tokens = schemeTokens(indexCss, dark);
    for (const background of [tokens['background'], tokens['card']] as string[]) {
      expect(contrast(tokens['destructive'] as string, background), `destructive on ${background}`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(tokens['foreground'] as string, background)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(tokens['muted-foreground'] as string, background)).toBeGreaterThanOrEqual(4.5);
      for (const name of ['ok', 'warning', 'over']) {
        // The bar fill against the card is a non-text element: 3:1.
        expect(contrast(tokens[`status-${name}`] as string, background), `status-${name} bar on ${background}`).toBeGreaterThanOrEqual(3);
      }
    }
    for (const name of ['ok', 'warning', 'over']) {
      // The badge text sits on the status colour: 4.5:1.
      expect(
        contrast(tokens[`status-${name}-foreground`] as string, tokens[`status-${name}`] as string),
        `badge ${name}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
});
