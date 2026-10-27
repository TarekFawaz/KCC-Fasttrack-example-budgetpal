import type { BudgetItem, BudgetStatus, UnbudgetedItem } from './api';
import { formatAmount } from './BudgetForm';
import styles from './BudgetProgress.module.css';

/** Icon and wording per status: colour is never the only signal (WCAG 1.4.1). */
export const STATUS_LABEL: Record<BudgetStatus, { icon: string; text: string }> = {
  ok: { icon: '✓', text: 'Within budget' },
  warning: { icon: '⚠', text: 'Near limit: 80% used or more' },
  over: { icon: '✕', text: 'Over budget' },
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
 * name, and the status as an icon plus text. Past 100% the bar stays full and the amount over is written out.
 * The status comes from the api (decided on integers); `percent` is display only.
 */
export function BudgetProgress({ item, currency }: BudgetProgressProps) {
  const status = STATUS_LABEL[item.status];
  const overBy = item.spentMinor - item.budgetMinor;
  const width = barPercent(item.percent);

  return (
    <div className={`${styles.progress} ${styles[item.status] ?? ''}`} data-status={item.status}>
      <div className={styles.head}>
        <strong>{item.categoryName}</strong>
        <span className={styles.status}>
          <span aria-hidden="true" className={styles.icon} data-status-icon={item.status}>
            {status.icon}
          </span>
          <span>{status.text}</span>
        </span>
      </div>
      <div className={styles.figures}>
        <span className={styles.amount}>Budget: {formatAmount(item.budgetMinor, currency)}</span>
        <span className={styles.amount}>Spent: {formatAmount(item.spentMinor, currency)}</span>
        <span className={styles.amount}>{item.percent}% used</span>
      </div>
      <div
        role="progressbar"
        className={styles.track}
        aria-label={`${item.categoryName} budget used`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={width}
        aria-valuetext={`${item.percent}% of the budget used`}
      >
        <div className={styles.fill} style={{ width: `${width}%` }} data-testid="progress-fill" />
      </div>
      {overBy > 0 ? (
        <p className={styles.overBy}>Over budget by {formatAmount(overBy, currency)}</p>
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
    <section aria-labelledby="unbudgeted-heading">
      <h2 id="unbudgeted-heading">Spending without a budget</h2>
      <ul className={styles.unbudgeted} aria-label="Unbudgeted categories">
        {items.map((entry) => (
          <li key={entry.categoryId} className={styles.unbudgetedRow}>
            <div className={styles.unbudgetedText}>
              <strong>{entry.categoryName}</strong>
              <span className={styles.amount}>Spent: {formatAmount(entry.spentMinor, currency)}</span>
            </div>
            <button
              type="button"
              className={styles.action}
              aria-label={`Add budget for ${entry.categoryName}`}
              onClick={() => onAdd(entry.categoryId)}
            >
              Add budget
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
