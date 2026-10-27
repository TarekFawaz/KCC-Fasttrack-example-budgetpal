import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { currentMonth, isMonth, useBudgets, useExpenseCategories, useRemoveBudget, type BudgetItem } from './api';
import { BudgetForm, installCurrency } from './BudgetForm';
import { BudgetProgress, UnbudgetedList } from './BudgetProgress';

interface RemoveBudgetProps {
  month: string;
  item: BudgetItem;
  /** Called after the api confirmed the removal. */
  onRemoved: () => void;
}

/** Remove one budget. The row stays until the api confirms, so a failed request leaves it in place. */
function RemoveBudget({ month, item, onRemoved }: RemoveBudgetProps) {
  const remove = useRemoveBudget();
  const [failed, setFailed] = useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      <Button
        type="button"
        variant="outline"
        aria-label={`Remove budget for ${item.categoryName}`}
        disabled={remove.isPending}
        onClick={() => {
          setFailed(false);
          remove.mutate({ month, categoryId: item.categoryId }, { onSuccess: onRemoved, onError: () => setFailed(true) });
        }}
      >
        {remove.isPending ? 'Removing...' : 'Remove'}
      </Button>
      {failed ? (
        <p role="alert" className="m-0 text-sm font-semibold text-destructive">
          <span aria-hidden="true">⚠ </span>
          Could not remove the budget right now. Try again.
        </p>
      ) : null}
    </div>
  );
}

/**
 * Budgets page: a month picker (the current month first), the set-budget form, then the month's budgets
 * with a Remove button each. Without expense categories or without budgets it says what to do next.
 */
export function BudgetsPage() {
  const [month, setMonth] = useState(() => currentMonth());
  const [categoryId, setCategoryId] = useState('');
  const [removedCount, setRemovedCount] = useState(0);
  const categories = useExpenseCategories();
  const budgets = useBudgets(month);
  const currency = installCurrency();
  const amountRef = useRef<HTMLInputElement | null>(null);
  const listHeadingRef = useRef<HTMLHeadingElement | null>(null);

  // A removed row takes its Remove button with it, so focus moves to the list heading.
  useEffect(() => {
    if (removedCount > 0) listHeadingRef.current?.focus();
  }, [removedCount]);

  // "Add budget" on an unbudgeted category: preselect it and put the cursor in the amount field.
  function addBudgetFor(id: number) {
    setCategoryId(String(id));
    amountRef.current?.focus();
  }

  const expenseCategories = categories.data ?? [];
  const items = budgets.data?.items ?? [];

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Budgets</h1>
      <div className="flex max-w-xs flex-col gap-1.5">
        <Label htmlFor="budget-month">Month</Label>
        <Input
          id="budget-month"
          type="month"
          value={month}
          onChange={(event) => setMonth(event.target.value)}
          aria-describedby={isMonth(month) ? undefined : 'budget-month-error'}
          aria-invalid={isMonth(month) ? undefined : true}
        />
        {isMonth(month) ? null : (
          <p id="budget-month-error" className="m-0 text-sm font-semibold text-destructive">
            <span aria-hidden="true">⚠ </span>
            Choose a month to see and set its budgets.
          </p>
        )}
      </div>

      {categories.isPending ? <p role="status">Loading categories...</p> : null}
      {categories.isError ? (
        <p role="alert" className="m-0 text-sm font-semibold text-destructive">
          <span aria-hidden="true">⚠ </span>
          Could not load your categories. Try again.
        </p>
      ) : null}
      {categories.data && expenseCategories.length === 0 ? (
        <p className="m-0 rounded-md border border-dashed p-4 text-muted-foreground" role="status">
          You have no expense categories yet. Create one on the Categories page, then come back to set a budget.
        </p>
      ) : null}
      {expenseCategories.length > 0 && isMonth(month) ? (
        <BudgetForm
          month={month}
          categories={expenseCategories}
          categoryId={categoryId}
          onCategoryChange={setCategoryId}
          amountRef={amountRef}
        />
      ) : null}

      <section aria-labelledby="budgets-list-heading" className="flex flex-col gap-3">
        <h2 id="budgets-list-heading" tabIndex={-1} ref={listHeadingRef} className="text-lg font-semibold tracking-tight">
          Budgets for this month
        </h2>
        {isMonth(month) && budgets.isPending ? <p role="status">Loading budgets...</p> : null}
        {budgets.isError ? (
          <p role="alert" className="m-0 text-sm font-semibold text-destructive">
            <span aria-hidden="true">⚠ </span>
            Could not load your budgets. Try again.
          </p>
        ) : null}
        {budgets.data && items.length === 0 ? (
          <p className="m-0 rounded-md border border-dashed p-4 text-muted-foreground">
            You have no budgets for this month. To plan your spending, choose a category, enter an amount and select Set
            budget.
          </p>
        ) : null}
        {items.length > 0 ? (
          <ul className="m-0 flex list-none flex-col gap-3 p-0" aria-label="Budgets">
            {items.map((item) => (
              <li
                key={item.categoryId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4 text-card-foreground shadow-sm"
              >
                <BudgetProgress item={item} currency={currency} />
                <RemoveBudget month={month} item={item} onRemoved={() => setRemovedCount((count) => count + 1)} />
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {budgets.data ? <UnbudgetedList items={budgets.data.unbudgeted ?? []} currency={currency} onAdd={addBudgetFor} /> : null}
    </section>
  );
}
