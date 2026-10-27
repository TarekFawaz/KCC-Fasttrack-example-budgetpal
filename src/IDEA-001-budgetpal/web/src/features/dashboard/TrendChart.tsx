import { useState } from 'react';
import { Bar, BarChart, XAxis, YAxis } from 'recharts';
import { useTrend, type Trend } from './api';
import styles from './dashboard.module.css';
import { formatMoney } from './format';

const RANGES = [3, 6, 12] as const;
const DEFAULT_RANGE = 6;
const CHART_WIDTH = 520;
const CHART_HEIGHT = 240;

/** The bar chart plus the table that holds the same points (D-20); the chart is hidden from assistive technology. */
function TrendView({ data }: { data: Trend }) {
  return (
    <div className={styles.spending}>
      <div className={styles.chart} aria-hidden="true" data-testid="trend-chart">
        <BarChart width={CHART_WIDTH} height={CHART_HEIGHT} data={data.points}>
          <XAxis dataKey="month" />
          <YAxis hide />
          <Bar dataKey="totalMinor" isAnimationActive={false} className={styles.slice} style={{ fill: 'var(--chart-1)' }} />
        </BarChart>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <caption className={styles.visuallyHidden}>Spending per month</caption>
          <thead>
            <tr>
              <th scope="col">Month</th>
              <th scope="col" className={styles.amount}>
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {data.points.map((point) => (
              <tr key={point.month}>
                <th scope="row">{point.month}</th>
                <td className={styles.amount}>{formatMoney(point.totalMinor, data.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Spending trend: the last 3, 6 (default) or 12 months ending at the selected month. It owns its loading,
 * error and empty states so a failure here never blanks the category section.
 */
export function TrendChart({ end }: { end: string }) {
  const [months, setMonths] = useState<number>(DEFAULT_RANGE);
  const trend = useTrend(months, end);

  return (
    <section aria-labelledby="dashboard-trend-heading" className={styles.section}>
      <h2 id="dashboard-trend-heading">Spending trend</h2>
      <div className={styles.field}>
        <label htmlFor="dashboard-trend-range">Period</label>
        <select
          id="dashboard-trend-range"
          className={styles.control}
          value={months}
          onChange={(event) => setMonths(Number(event.target.value))}
        >
          {RANGES.map((range) => (
            <option key={range} value={range}>
              Last {range} months
            </option>
          ))}
        </select>
      </div>
      {trend.isPending ? (
        <p role="status">Loading trend…</p>
      ) : trend.isError ? (
        <div role="alert" className={styles.errorBox}>
          <p className={styles.error}>Could not load your trend. {trend.error.message}</p>
          <button type="button" className={styles.button} onClick={() => void trend.refetch()}>
            Retry
          </button>
        </div>
      ) : trend.data.points.every((point) => point.totalMinor === 0) ? (
        <p className={styles.empty}>No spending in this period.</p>
      ) : (
        <TrendView data={trend.data} />
      )}
    </section>
  );
}
