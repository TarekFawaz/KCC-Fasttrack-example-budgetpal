import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSpending } from './api';
import styles from './dashboard.module.css';
import { currentMonth, MONTH_PATTERN } from './format';
import { SpendingByCategory } from './SpendingByCategory';

/** Dashboard page: a month picker (current month by default) and the spending-by-category section. */
export function DashboardPage() {
  const [month, setMonth] = useState(() => currentMonth());
  const valid = MONTH_PATTERN.test(month);
  const spending = useSpending(month, valid);

  return (
    <section className={styles.page}>
      <h1>Dashboard</h1>
      <div className={styles.field}>
        <label htmlFor="dashboard-month">Month</label>
        <input
          id="dashboard-month"
          type="month"
          className={styles.control}
          value={month}
          onChange={(event) => setMonth(event.target.value)}
        />
      </div>
      <section aria-labelledby="dashboard-spending-heading" className={styles.section}>
        <h2 id="dashboard-spending-heading">Spending by category</h2>
        {!valid ? (
          <p className={styles.empty}>Choose a month to see your spending.</p>
        ) : spending.isPending ? (
          <p role="status">Loading spending…</p>
        ) : spending.isError ? (
          <div role="alert" className={styles.errorBox}>
            <p className={styles.error}>Could not load your spending. {spending.error.message}</p>
            <button type="button" className={styles.button} onClick={() => void spending.refetch()}>
              Retry
            </button>
          </div>
        ) : spending.data.categories.length === 0 ? (
          <p className={styles.empty}>
            No expenses in this month. <Link to="/transactions">Add or review transactions</Link>
          </p>
        ) : (
          <SpendingByCategory data={spending.data} />
        )}
      </section>
    </section>
  );
}
