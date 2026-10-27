import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Spending } from './api';
import { SpendingByCategory } from './SpendingByCategory';

const collapse = (text: string) => text.replace(/\s+/g, ' ');
const usd = (value: string) =>
  collapse(new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(value as unknown as number));

const DATA: Spending = {
  month: '2026-03',
  currency: 'USD',
  totalMinor: 20000,
  categories: [
    { categoryId: 1, name: 'Groceries', amountMinor: 10000 },
    { categoryId: 2, name: 'Rent', amountMinor: 6000 },
    { categoryId: 3, name: 'Fun', amountMinor: 4000 },
  ],
};

describe('SpendingByCategory', () => {
  it('T-024 renders a Recharts pie with one slice per category', () => {
    const { container } = render(<SpendingByCategory data={DATA} />);
    expect(container.querySelector('.recharts-wrapper')).not.toBeNull();
    expect(container.querySelector('.recharts-pie')).not.toBeNull();
    expect(container.querySelectorAll('.recharts-pie-sector')).toHaveLength(3);
    // the chart is hidden from assistive technology; the table below is its text alternative
    expect(screen.getByTestId('spending-chart')).toHaveAttribute('aria-hidden', 'true');
  });

  it('T-024 renders a table of category, formatted amount and share with a total row', () => {
    render(<SpendingByCategory data={DATA} />);
    const table = screen.getByRole('table', { name: /Spending by category for 2026-03/ });
    expect(within(table).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual([
      'Slice',
      'Category',
      'Amount',
      'Share',
    ]);
    const rows = within(table).getAllByRole('row');
    // header + 3 categories + total
    expect(rows).toHaveLength(5);
    const groceries = rows[1] as HTMLElement;
    expect(groceries).toHaveTextContent('Groceries');
    expect(collapse(groceries.textContent ?? '')).toContain(usd('100.00'));
    expect(groceries).toHaveTextContent('50.0%');
    const total = rows[4] as HTMLElement;
    expect(total).toHaveTextContent('Total');
    expect(collapse(total.textContent ?? '')).toContain(usd('200.00'));
    expect(total).toHaveTextContent('100.0%');
  });

  it('T-029 every slice is also a table row carrying its number, name and share as text', () => {
    const { container } = render(<SpendingByCategory data={DATA} />);
    const sectors = container.querySelectorAll('.recharts-pie-sector').length;
    const body = screen.getAllByRole('rowgroup')[1] as HTMLElement;
    const rows = within(body).getAllByRole('row');
    expect(rows).toHaveLength(sectors);
    rows.forEach((row, index) => {
      expect(row.textContent).toContain(String(index + 1));
      expect(row.textContent).toMatch(/\d+\.\d%/);
      expect(within(row).getByRole('rowheader').textContent).toBe(DATA.categories[index]?.name);
    });
    // the pie labels the slices with the same numbers, so a slice is identified without its colour
    const labels = Array.from(container.querySelectorAll('.recharts-pie-labels text')).map((node) => node.textContent);
    expect(labels).toEqual(['1', '2', '3']);
  });

  it('T-029 shares of the rows add up to the total share', () => {
    const odd: Spending = {
      month: '2026-03',
      currency: 'USD',
      totalMinor: 300,
      categories: [
        { categoryId: 1, name: 'A', amountMinor: 100 },
        { categoryId: 2, name: 'B', amountMinor: 100 },
        { categoryId: 3, name: 'C', amountMinor: 100 },
      ],
    };
    render(<SpendingByCategory data={odd} />);
    const body = screen.getAllByRole('rowgroup')[1] as HTMLElement;
    const shares = within(body)
      .getAllByRole('row')
      .map((row) => Number((row.lastElementChild?.textContent ?? '').replace('%', '').replace('.', '')));
    expect(shares.reduce((a, b) => a + b, 0)).toBe(1000);
  });
});
