import { Cell, Pie, PieChart } from 'recharts';
import type { Spending } from './api';
import styles from './dashboard.module.css';
import { formatMoney, formatPermille, sharePermille } from './format';

const SLICE_COLOURS = 8;
const CHART_SIZE = 260;

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
    <div className={styles.spending}>
      <div className={styles.chart} aria-hidden="true" data-testid="spending-chart">
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
              <Cell
                key={category.categoryId}
                className={styles.slice}
                style={{ fill: `var(--chart-${(index % SLICE_COLOURS) + 1})` }}
              />
            ))}
          </Pie>
        </PieChart>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <caption className={styles.visuallyHidden}>Spending by category for {data.month}</caption>
          <thead>
            <tr>
              <th scope="col">Slice</th>
              <th scope="col">Category</th>
              <th scope="col" className={styles.amount}>
                Amount
              </th>
              <th scope="col" className={styles.amount}>
                Share
              </th>
            </tr>
          </thead>
          <tbody>
            {data.categories.map((category, index) => (
              <tr key={category.categoryId}>
                <td>
                  <span
                    className={styles.swatch}
                    aria-hidden="true"
                    style={{ background: `var(--chart-${(index % SLICE_COLOURS) + 1})` }}
                  />
                  {index + 1}
                </td>
                <th scope="row">{category.name}</th>
                <td className={styles.amount}>{formatMoney(category.amountMinor, data.currency)}</td>
                <td className={styles.amount}>{formatPermille(shares[index] ?? 0)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td />
              <th scope="row">Total</th>
              <td className={styles.amount}>{formatMoney(data.totalMinor, data.currency)}</td>
              <td className={styles.amount}>{formatPermille(data.totalMinor > 0 ? 1000 : 0)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
