import { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  PAGE_SIZE,
  useAccountOptions,
  useCategoryOptions,
  useTransactions,
  type CategoryKind,
  type TransactionFilters,
} from './api';
import { DeleteTransaction, EMPTY_CLASSES, ERROR_CLASSES, SELECT_CLASSES, TransactionForm } from './TransactionForm';

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

/**
 * Transactions page: the add control, filters (month, account, category), the table with Edit and Delete
 * per row, then the pager. Add and edit open in a Dialog (one at a time); Delete asks in an AlertDialog.
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

  // Closing an edit dialog puts focus back on that row's Edit button.
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
  const editing = (list.data?.items ?? []).find((item) => item.id === editingId);

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
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Transactions</h1>
      <Dialog open={adding} onOpenChange={setAdding}>
        <div>
          <DialogTrigger asChild>
            <Button type="button">Add transaction</Button>
          </DialogTrigger>
        </div>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add a transaction</DialogTitle>
            <DialogDescription>Enter the date, amount, description, account and category.</DialogDescription>
          </DialogHeader>
          <TransactionForm onSaved={() => setAdding(false)} />
        </DialogContent>
      </Dialog>
      <Dialog
        open={editing !== undefined}
        onOpenChange={(open) => {
          if (!open) closeEdit();
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit {editing?.description}</DialogTitle>
            <DialogDescription>Change the details, then save.</DialogDescription>
          </DialogHeader>
          {editing ? (
            <TransactionForm key={editing.id} transaction={editing} onSaved={closeEdit} onCancel={closeEdit} />
          ) : null}
        </DialogContent>
      </Dialog>
      <form
        className="grid grid-cols-1 gap-4 rounded-lg border bg-card p-4 text-card-foreground shadow-sm md:grid-cols-3"
        aria-label="Filter transactions"
        onSubmit={(event) => event.preventDefault()}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="filter-month">Month</Label>
          <Input
            id="filter-month"
            type="month"
            value={filters.month}
            onChange={(event) => change({ month: event.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="filter-account">Account</Label>
          <select
            id="filter-account"
            className={SELECT_CLASSES}
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
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="filter-category">Category</Label>
          <select
            id="filter-category"
            className={SELECT_CLASSES}
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

      <section aria-labelledby="transactions-list-heading" className="flex flex-col gap-3">
        <h2
          id="transactions-list-heading"
          tabIndex={-1}
          ref={listHeadingRef}
          className="text-lg font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
        >
          Your transactions
        </h2>
        {list.isPending ? <p role="status">Loading transactions...</p> : null}
        {list.isError ? (
          <p role="alert" className={ERROR_CLASSES}>
            <span aria-hidden="true">⚠ </span>
            Could not load your transactions. Try again.
          </p>
        ) : null}
        {page && page.items.length === 0 ? (
          <p className={EMPTY_CLASSES}>
            {filtered
              ? 'No transactions match these filters. Change or clear a filter to see more.'
              : 'You have no transactions yet. To add your first one, choose Add transaction and enter a date, an amount, an account and a category.'}
          </p>
        ) : null}
        {page && page.items.length > 0 ? (
          <div className="rounded-lg border bg-card text-card-foreground">
            <Table>
              <TableCaption className="sr-only">
                Your transactions with date, description, account, category and amount
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Date</TableHead>
                  <TableHead scope="col">Description</TableHead>
                  <TableHead scope="col">Account</TableHead>
                  <TableHead scope="col">Category</TableHead>
                  <TableHead scope="col" className="text-right">
                    Amount
                  </TableHead>
                  <TableHead scope="col">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {page.items.map((item) => {
                  const category = categoryById.get(item.categoryId);
                  const direction = directionOf(category?.kind);
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="whitespace-nowrap">
                        <time dateTime={item.occurredOn}>{formatDate(item.occurredOn)}</time>
                      </TableCell>
                      <TableHead scope="row" className="h-auto py-3 font-semibold text-foreground [overflow-wrap:anywhere]">
                        {item.description}
                      </TableHead>
                      <TableCell>{accountNames.get(item.accountId) ?? `Account ${item.accountId}`}</TableCell>
                      <TableCell>{category?.name ?? `Category ${item.categoryId}`}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        <span className="inline-flex flex-wrap items-center justify-end gap-2">
                          {direction ? (
                            <Badge variant="outline">
                              <span aria-hidden="true">{direction.icon}</span>
                              <span>{direction.label}</span>
                            </Badge>
                          ) : null}
                          <span className="whitespace-nowrap">{formatAmount(item.amountMinor, currency)}</span>
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            aria-label={`Edit ${item.description}`}
                            ref={(element) => {
                              if (element) editButtons.current.set(item.id, element);
                              else editButtons.current.delete(item.id);
                            }}
                            onClick={() => openEdit(item.id)}
                          >
                            Edit
                          </Button>
                          <DeleteTransaction transaction={item} onDeleted={() => setDeletedCount((count) => count + 1)} />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : null}
        {page ? (
          <nav aria-label="Pages" className="flex flex-wrap items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={!hasPrevious}
              onClick={() =>
                setFilters((current) => ({ ...current, offset: Math.max(0, current.offset - current.limit) }))
              }
            >
              Previous
            </Button>
            <p role="status" className="m-0 text-sm text-muted-foreground">
              {page.total === 0 ? 'No transactions' : `Showing ${first}-${last} of ${page.total}`}
            </p>
            <Button
              type="button"
              variant="outline"
              disabled={!hasNext}
              onClick={() => setFilters((current) => ({ ...current, offset: current.offset + current.limit }))}
            >
              Next
            </Button>
          </nav>
        ) : null}
      </section>
    </section>
  );
}
