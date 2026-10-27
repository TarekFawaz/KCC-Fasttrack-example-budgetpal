import { useState } from 'react';
import { Bar, BarChart, Cell, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTrend, type Trend } from './api';
import { formatMoney } from './format';
import { CHART_BOX_CLASSES } from './SpendingByCategory';

const RANGES = [3, 6, 12] as const;
const DEFAULT_RANGE = 6;
const CHART_WIDTH = 520;
const CHART_HEIGHT = 240;

/** The bar chart plus the table that holds the same points (D-20); the chart is hidden from assistive technology. */
function TrendView({ data }: { data: Trend }) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className={`${CHART_BOX_CLASSES} [&_text]:fill-foreground`} aria-hidden="true" data-testid="trend-chart">
        <BarChart width={CHART_WIDTH} height={CHART_HEIGHT} data={data.points}>
          <XAxis dataKey="month" />
          <YAxis hide />
          <Bar dataKey="totalMinor" isAnimationActive={false}>
            {data.points.map((point) => (
              <Cell key={point.month} className="fill-chart-1" />
            ))}
          </Bar>
        </BarChart>
      </div>
      <Table>
        <TableCaption className="sr-only">Spending per month</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">Month</TableHead>
            <TableHead scope="col" className="text-right">
              Amount
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.points.map((point) => (
            <TableRow key={point.month}>
              <TableHead scope="row" className="font-medium text-foreground">
                {point.month}
              </TableHead>
              <TableCell className="whitespace-nowrap text-right tabular-nums">
                {formatMoney(point.totalMinor, data.currency)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * Spending trend: the last 3, 6 (default) or 12 months ending at the selected month. It owns its loading,
 * error and empty states so a failure here never blanks the category section. The range is a Tabs control.
 */
export function TrendChart({ end }: { end: string }) {
  const [months, setMonths] = useState<number>(DEFAULT_RANGE);
  const trend = useTrend(months, end);

  return (
    <section aria-labelledby="dashboard-trend-heading">
      <Card>
        <CardHeader>
          <h2 id="dashboard-trend-heading" className="text-lg font-semibold leading-none tracking-tight">
            Spending trend
          </h2>
        </CardHeader>
        <CardContent>
          <Tabs value={String(months)} onValueChange={(value) => setMonths(Number(value))}>
            <TabsList aria-label="Period" className="h-auto max-w-full flex-wrap">
              {RANGES.map((range) => (
                <TabsTrigger key={range} value={String(range)}>
                  Last {range} months
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value={String(months)} className="mt-4">
              {trend.isPending ? (
                <p role="status">Loading trend…</p>
              ) : trend.isError ? (
                <div role="alert" className="flex flex-col items-start gap-3">
                  <p className="font-semibold text-destructive">
                    <span aria-hidden="true">⚠ </span>
                    Could not load your trend. {trend.error.message}
                  </p>
                  <Button type="button" variant="outline" onClick={() => void trend.refetch()}>
                    Retry
                  </Button>
                </div>
              ) : trend.data.points.every((point) => point.totalMinor === 0) ? (
                <p className="rounded-md border border-dashed p-4 text-muted-foreground">No spending in this period.</p>
              ) : (
                <TrendView data={trend.data} />
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </section>
  );
}
