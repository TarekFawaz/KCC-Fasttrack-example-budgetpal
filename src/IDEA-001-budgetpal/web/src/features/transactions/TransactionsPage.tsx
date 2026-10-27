import { Fragment, useEffect, useRef, useState } from 'react';
import {
  PAGE_SIZE,
  useAccountOptions,
  useCategoryOptions,
  useTransactions,
  type CategoryKind,
  type TransactionFilters,
} from './api';
import { DeleteTransaction, TransactionForm } from './TransactionForm';
import styles from './TransactionsPage.module.css';

/**
 * Display helpers. Money is formatted here (not through another feature, GR-006) from integer minor
 * units: the decimal text is built by string math and handed to `Intl`, never through a float (GR-007).
 */
function installCurrency(): string {
  const configured = (import.meta.env.VITE_CURRENCY as string | undefined)?.trim().toUpperCase();
  return configured && /^[A-Z]{3}$/.test(configured) ? configured : 'USD';
}

export function formatAmount(minor: number, currency: string = installCurrency()): string {
  const digits =
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
  const padded = String(Math.abs(minor)).padStart(digits + 1, '0');
  const whole = padded.slice(0, padded.length - digits);
  const fraction = padded.slice(padded.length - digits);
  const decimal = `${minor < 0 ? '-' : ''}${whole}${digits > 0 ? `.${fraction}` : ''}`;
  // Intl.NumberFormat v3 formats a decimal string exactly; the cast only satisfies the older lib typing.
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(decimal as unknown as number);
}

/** `YYYY-MM-DD` shown in the user's locale; read as UTC so the day never shifts with the time zone. */
export function formatDate(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return day;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' }).format(date);
}

/** Direction as text plus an icon, so it never rests on colour alone (D-20). */
export function directionOf(kind: CategoryKind | undefined): { label: string; icon: string } | null {
  if (kind === 'expense') return { label: 'Expense', icon: '↓' };
  if (kind === 'income') return { label: 'Income', icon: '↑' };
  return null;
}

const INITIAL: TransactionFilters = { month: '', accountId: '', categoryId: '', limit: PAGE_SIZE, offset: 0 };

/** Columns of the table: the five data columns plus the row actions. */
const COLUMN_COUNT = 6;

/**
 * Transactions page: the add control, filters (month, account, category), the table with Edit and Delete
 * per row, then the pager. The add form opens on request; one row at a time can be edited.
 */
export function TransactionsPage() {
  const [filters, setFilters] = useState<TransactionFilters>(INITIAL);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletedCount, setDeletedCount] = useState(0);
  const accounts = useAccountOptions();
  const categories = useCategoryOptions();
  const list = useTransactions(filters);
  const currency = installCurrency();
  const editButtons = useRef(new Map<number, HTMLButtonElement>());
  const editedId = useRef<number | null>(null);
  const listHeadingRef = useRef<HTMLHeadingElement | null>(null);

  // Closing an edit form puts focus back on that row's Edit button.
  useEffect(() => {
    if (editingId === null && editedId.current !== null) {
      editButtons.current.get(editedId.current)?.focus();
      editedId.current = null;
    }
  }, [editingId]);

  // A deleted row takes its Delete button with it, so focus moves to the list heading.
  useEffect(() => {
    if (deletedCount > 0) listHeadingRef.current?.focus();
  }, [deletedCount]);

  const openEdit = (id: number) => {
    editedId.current = null;
    setEditingId(id);
  };
  const closeEdit = () => {
    editedId.current = editingId;
    setEditingId(null);
  };

  const accountNames = new Map((accounts.data ?? []).map((account) => [account.id, account.name]));
  const categoryById = new Map((categories.data ?? []).map((category) => [category.id, category]));

  // A new filter always starts again at the first page.
  const change = (patch: Partial<Pick<TransactionFilters, 'month' | 'accountId' | 'categoryId'>>) =>
    setFilters((current) => ({ ...current, ...patch, offset: 0 }));

  const page = list.data;
  const first = page && page.total > 0 ? page.offset + 1 : 0;
  const last = page ? Math.min(page.offset + page.items.length, page.total) : 0;
  const hasPrevious = (page?.offset ?? 0) > 0;
  const hasNext = page ? page.offset + page.limit < page.total : false;
  const filtered = filters.month !== '' || filters.accountId !== '' || filters.categoryId !== '';

  return (
    <section className={styles.page}>
      <h1>Transactions</h1>
      <div className={styles.field}>
        <div>
          <button type="button" className={styles.button} onClick={() => setAdding((open) => !open)}>
            {adding ? 'Close add form' : 'Add transaction'}
          </button>
        </div>
        {adding ? <TransactionForm /> : null}
      </div>
      <form className={styles.filters} aria-label="Filter transactions" onSubmit={(event) => event.preventDefault()}>
        <div className={styles.field}>
          <label htmlFor="filter-month">Month</label>
          <input
            id="filter-month"
            type="month"
            className={styles.control}
            value={filters.month}
            onChange={(event) => change({ month: event.target.value })}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="filter-account">Account</label>
          <select
            id="filter-account"
            className={styles.control}
            value={filters.accountId}
            onChange={(event) => change({ accountId: event.target.value })}
          >
            <option value="">All accounts</option>
            {(accounts.data ?? []).map((account) => (
              <option key={account.id} value={String(account.id)}>
                {account.name}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor="filter-category">Category</label>
          <select
            id="filter-category"
            className={styles.control}
            value={filters.categoryId}
            onChange={(event) => change({ categoryId: event.target.value })}
          >
            <option value="">All categories</option>
            {(categories.data ?? []).map((category) => (
              <option key={category.id} value={String(category.id)}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
      </form>

      <section aria-labelledby="transactions-list-heading">
        <h2 id="transactions-list-heading" tabIndex={-1} ref={listHeadingRef}>
          Your transactions
        </h2>
        {list.isPending ? <p role="status">Loading transactions...</p> : null}
        {list.isError ? (
          <p role="alert" className={styles.error}>
            <span aria-hidden="true">⚠ </span>
            Could not load your transactions. Try again.
          </p>
        ) : null}
        {page && page.items.length === 0 ? (
          <p className={styles.empty}>
            {filtered
              ? 'No transactions match these filters. Change or clear a filter to see more.'
              : 'You have no transactions yet. To add your first one, choose Add transaction and enter a date, an amount, an account and a category.'}
          </p>
        ) : null}
        {page && page.items.length > 0 ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <caption className={styles.visuallyHidden}>
                Your transactions with date, description, account, category and amount
              </caption>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Description</th>
                  <th scope="col">Account</th>
                  <th scope="col">Category</th>
                  <th scope="col" className={styles.amount}>
                    Amount
                  </th>
                  <th scope="col">
                    <span className={styles.visuallyHidden}>Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {page.items.map((item) => {
                  const category = categoryById.get(item.categoryId);
                  const direction = directionOf(category?.kind);
                  return (
                    <Fragment key={item.id}>
                      <tr>
                        <td>
                          <time dateTime={item.occurredOn}>{formatDate(item.occurredOn)}</time>
                        </td>
                        <th scope="row">{item.description}</th>
                        <td>{accountNames.get(item.accountId) ?? `Account ${item.accountId}`}</td>
                        <td>{category?.name ?? `Category ${item.categoryId}`}</td>
                        <td className={styles.amount}>
                          {direction ? (
                            <span className={styles.direction}>
                              <span aria-hidden="true">{direction.icon} </span>
                              {direction.label}{' '}
                            </span>
                          ) : null}
                          {formatAmount(item.amountMinor, currency)}
                        </td>
                        <td>
                          <button
                            type="button"
                            className={styles.button}
                            aria-label={`Edit ${item.description}`}
                            ref={(element) => {
                              if (element) editButtons.current.set(item.id, element);
                              else editButtons.current.delete(item.id);
                            }}
                            onClick={() => openEdit(item.id)}
                          >
                            Edit
                          </button>{' '}
                          <DeleteTransaction
                            transaction={item}
                            onDeleted={() => setDeletedCount((count) => count + 1)}
                          />
                        </td>
                      </tr>
                      {editingId === item.id ? (
                        <tr>
                          <td colSpan={COLUMN_COUNT}>
                            <TransactionForm transaction={item} onSaved={closeEdit} onCancel={closeEdit} />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
        {page ? (
          <nav aria-label="Pages" className={styles.pager}>
            <button
              type="button"
              className={styles.button}
              disabled={!hasPrevious}
              onClick={() =>
                setFilters((current) => ({ ...current, offset: Math.max(0, current.offset - current.limit) }))
              }
            >
              Previous
            </button>
            <p role="status" className={styles.range}>
              {page.total === 0 ? 'No transactions' : `Showing ${first}-${last} of ${page.total}`}
            </p>
            <button
              type="button"
              className={styles.button}
              disabled={!hasNext}
              onClick={() => setFilters((current) => ({ ...current, offset: current.offset + current.limit }))}
            >
              Next
            </button>
          </nav>
        ) : null}
      </section>
    </section>
  );
}
