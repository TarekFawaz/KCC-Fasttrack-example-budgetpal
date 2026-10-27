import { Cell, Pie, PieChart } from 'recharts';
import { Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Spending } from './api';
import { formatMoney, formatPermille, sharePermille } from './format';

const CHART_SIZE = 260;

/**
 * Slice colours come from the theme tokens (`--chart-1` to `--chart-5`, light and dark) through Tailwind
 * classes; the lists are literal so the class scanner finds them. More than five categories reuse the colours,
 * and every slice also carries its number, so no meaning rests on colour alone.
 */
export const SLICE_CLASSES = ['fill-chart-1', 'fill-chart-2', 'fill-chart-3', 'fill-chart-4', 'fill-chart-5'] as const;
export const SWATCH_CLASSES = ['bg-chart-1', 'bg-chart-2', 'bg-chart-3', 'bg-chart-4', 'bg-chart-5'] as const;

/** Chart box that scales its svg down inside a narrow card instead of widening the page. */
export const CHART_BOX_CLASSES =
  'max-w-full overflow-hidden [&_.recharts-wrapper]:!h-auto [&_.recharts-wrapper]:!max-w-full [&_svg]:h-auto [&_svg]:max-w-full';

/**
 * Spending by category: a Recharts pie plus the table that holds the same data (D-20). The pie is hidden
 * from assistive technology because the table is its text alternative: each slice is a table row, and every
 * row carries its number and share as text, so no meaning rests on colour alone.
 */
export function SpendingByCategory({ data }: { data: Spending }) {
  const shares = sharePermille(
    data.categories.map((category) => category.amountMinor),
    data.totalMinor,
  );
  return (
    <div className="flex flex-col items-center gap-4">
      <div className={`${CHART_BOX_CLASSES} [&_text]:fill-background [&_text]:font-bold`} aria-hidden="true" data-testid="spending-chart">
        <PieChart width={CHART_SIZE} height={CHART_SIZE}>
          <Pie
            data={data.categories}
            dataKey="amountMinor"
            nameKey="name"
            innerRadius={50}
            outerRadius={110}
            paddingAngle={1}
            isAnimationActive={false}
            label={({ index }: { index: number }) => String(index + 1)}
            labelLine={false}
          >
            {data.categories.map((category, index) => (
              <Cell key={category.categoryId} className={`stroke-card stroke-2 ${SLICE_CLASSES[index % SLICE_CLASSES.length]}`} />
            ))}
          </Pie>
        </PieChart>
      </div>
      <Table>
        <TableCaption className="sr-only">Spending by category for {data.month}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">Slice</TableHead>
            <TableHead scope="col">Category</TableHead>
            <TableHead scope="col" className="text-right">
              Amount
            </TableHead>
            <TableHead scope="col" className="text-right">
              Share
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.categories.map((category, index) => (
            <TableRow key={category.categoryId}>
              <TableCell>
                <span
                  className={`mr-2 inline-block size-3.5 rounded-sm border align-middle ${SWATCH_CLASSES[index % SWATCH_CLASSES.length]}`}
                  aria-hidden="true"
                />
                {index + 1}
              </TableCell>
              <TableHead scope="row" className="font-medium text-foreground">
                {category.name}
              </TableHead>
              <TableCell className="whitespace-nowrap text-right tabular-nums">
                {formatMoney(category.amountMinor, data.currency)}
              </TableCell>
              <TableCell className="whitespace-nowrap text-right tabular-nums">{formatPermille(shares[index] ?? 0)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell />
            <TableHead scope="row" className="font-bold text-foreground">
              Total
            </TableHead>
            <TableCell className="whitespace-nowrap text-right font-bold tabular-nums">
              {formatMoney(data.totalMinor, data.currency)}
            </TableCell>
            <TableCell className="whitespace-nowrap text-right font-bold tabular-nums">
              {formatPermille(data.totalMinor > 0 ? 1000 : 0)}
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}
