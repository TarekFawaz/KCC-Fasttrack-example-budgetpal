import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import type { BudgetItem, BudgetStatus, UnbudgetedItem } from './api';
import { formatAmount } from './BudgetForm';

/** Icon and wording per status: colour is never the only signal (WCAG 1.4.1). */
export const STATUS_LABEL: Record<BudgetStatus, { icon: string; text: string }> = {
  ok: { icon: '✓', text: 'Within budget' },
  warning: { icon: '⚠', text: 'Near limit: 80% used or more' },
  over: { icon: '✕', text: 'Over budget' },
};

/** Badge variant and bar colour per status; the classes are literal so Tailwind finds them. */
export const STATUS_STYLE: Record<BudgetStatus, { badge: 'ok' | 'warning' | 'over'; bar: string }> = {
  ok: { badge: 'ok', bar: 'bg-status-ok' },
  warning: { badge: 'warning', bar: 'bg-status-warning' },
  over: { badge: 'over', bar: 'bg-status-over' },
};

/** The bar never grows past its track; the percent in the text still shows the real figure. */
export function barPercent(percent: number): number {
  if (!Number.isFinite(percent) || percent < 0) return 0;
  return Math.min(Math.floor(percent), 100);
}

export interface BudgetProgressProps {
  item: BudgetItem;
  /** ISO 4217 code of the install currency. */
  currency: string;
}

/**
 * One budget against its spending: category, spent, budget and percent, a progressbar with an accessible
 * name, and the status as a Badge with an icon plus text. Past 100% the bar stays full and the amount over
 * is written out. The status comes from the api (decided on integers); `percent` is display only.
 */
export function BudgetProgress({ item, currency }: BudgetProgressProps) {
  const status = STATUS_LABEL[item.status];
  const style = STATUS_STYLE[item.status];
  const overBy = item.spentMinor - item.budgetMinor;
  const width = barPercent(item.percent);

  return (
    <div className="flex min-w-0 flex-1 basis-full flex-col gap-2 [overflow-wrap:anywhere]" data-status={item.status}>
      <div className="flex min-w-0 flex-col items-start gap-1">
        <strong>{item.categoryName}</strong>
        <Badge variant={style.badge}>
          <span aria-hidden="true" data-status-icon={item.status}>
            {status.icon}
          </span>
          <span>{status.text}</span>
        </Badge>
      </div>
      <div className="flex min-w-0 flex-col gap-1 tabular-nums">
        <span>Budget: {formatAmount(item.budgetMinor, currency)}</span>
        <span>Spent: {formatAmount(item.spentMinor, currency)}</span>
        <span>{item.percent}% used</span>
      </div>
      <Progress
        aria-label={`${item.categoryName} budget used`}
        aria-valuetext={`${item.percent}% of the budget used`}
        value={width}
        indicatorClassName={style.bar}
        className="h-3 w-full border"
      />
      {overBy > 0 ? (
        <p className="m-0 font-semibold text-destructive">Over budget by {formatAmount(overBy, currency)}</p>
      ) : null}
    </div>
  );
}

export interface UnbudgetedListProps {
  items: UnbudgetedItem[];
  currency: string;
  /** Called with the category when its "Add budget" is chosen; the page preselects it and focuses the amount. */
  onAdd: (categoryId: number) => void;
}

/** Expense categories with spending this month and no budget, each with an "Add budget" action. */
export function UnbudgetedList({ items, currency, onAdd }: UnbudgetedListProps) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="unbudgeted-heading" className="flex flex-col gap-3">
      <h2 id="unbudgeted-heading" className="text-lg font-semibold tracking-tight">
        Spending without a budget
      </h2>
      <ul className="m-0 flex list-none flex-col gap-3 p-0" aria-label="Unbudgeted categories">
        {items.map((entry) => (
          <li
            key={entry.categoryId}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4 text-card-foreground"
          >
            <div className="flex min-w-0 flex-col gap-1 [overflow-wrap:anywhere]">
              <strong>{entry.categoryName}</strong>
              <span className="tabular-nums">Spent: {formatAmount(entry.spentMinor, currency)}</span>
            </div>
            <Button
              type="button"
              variant="outline"
              aria-label={`Add budget for ${entry.categoryName}`}
              onClick={() => onAdd(entry.categoryId)}
            >
              Add budget
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
