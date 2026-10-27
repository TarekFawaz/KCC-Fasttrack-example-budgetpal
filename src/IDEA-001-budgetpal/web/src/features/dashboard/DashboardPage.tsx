import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSpending } from './api';
import { currentMonth, MONTH_PATTERN } from './format';
import { SpendingByCategory } from './SpendingByCategory';
import { TrendChart } from './TrendChart';

/** Dashboard page: a month picker (current month by default) and the spending-by-category section. */
export function DashboardPage() {
  const [month, setMonth] = useState(() => currentMonth());
  const valid = MONTH_PATTERN.test(month);
  const spending = useSpending(month, valid);

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <div className="flex max-w-xs flex-col gap-1.5">
        <Label htmlFor="dashboard-month">Month</Label>
        <Input id="dashboard-month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
      </div>
      <section aria-labelledby="dashboard-spending-heading">
        <Card>
          <CardHeader>
            <h2 id="dashboard-spending-heading" className="text-lg font-semibold leading-none tracking-tight">
              Spending by category
            </h2>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {!valid ? (
              <p className="rounded-md border border-dashed p-4 text-muted-foreground">Choose a month to see your spending.</p>
            ) : spending.isPending ? (
              <p role="status">Loading spending…</p>
            ) : spending.isError ? (
              <div role="alert" className="flex flex-col items-start gap-3">
                <p className="font-semibold text-destructive">
                  <span aria-hidden="true">⚠ </span>
                  Could not load your spending. {spending.error.message}
                </p>
                <Button type="button" variant="outline" onClick={() => void spending.refetch()}>
                  Retry
                </Button>
              </div>
            ) : spending.data.categories.length === 0 ? (
              <p className="rounded-md border border-dashed p-4 text-muted-foreground">
                No expenses in this month.{' '}
                <Link to="/transactions" className="font-medium text-primary underline underline-offset-4">
                  Add or review transactions
                </Link>
              </p>
            ) : (
              <SpendingByCategory data={spending.data} />
            )}
          </CardContent>
        </Card>
      </section>
      {valid ? <TrendChart end={month} /> : null}
    </section>
  );
}
