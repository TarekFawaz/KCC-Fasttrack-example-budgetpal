import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  ApiProblem,
  useAccountOptions,
  useCategoryOptions,
  useCreateTransaction,
  useDeleteTransaction,
  useUpdateTransaction,
  type FieldProblem,
  type Transaction,
} from './api';
import { formatForInput, minorDigits, parseAmount } from './money';
import styles from './TransactionsPage.module.css';

type FieldName = 'occurredOn' | 'amount' | 'description' | 'accountId' | 'categoryId';
export type FieldErrors = Partial<Record<FieldName, string>>;

const FIELD_ORDER: readonly FieldName[] = ['occurredOn', 'amount', 'description', 'accountId', 'categoryId'];

/** The api names the amount `amountMinor`; the form calls its input `amount`. */
const API_FIELD: Record<string, FieldName> = {
  occurredOn: 'occurredOn',
  amountMinor: 'amount',
  description: 'description',
  accountId: 'accountId',
  categoryId: 'categoryId',
};

/** Field errors from an api problem; `rest` holds whatever has no input to sit next to. */
export function splitProblem(problem: FieldProblem[]): { fields: FieldErrors; rest: string[] } {
  const fields: FieldErrors = {};
  const rest: string[] = [];
  for (const entry of problem) {
    const name = API_FIELD[entry.field];
    if (name) fields[name] ??= entry.message;
    else rest.push(entry.message);
  }
  return { fields, rest };
}

interface FieldProps {
  name: FieldName;
  label: string;
  error?: string;
  hint?: string;
  idPrefix: string;
  children: (props: { id: string; describedBy: string | undefined; invalid: true | undefined }) => ReactNode;
}

/** A labelled control; its error (text, never colour alone) is tied to it with aria-describedby. */
function Field({ name, label, error, hint, idPrefix, children }: FieldProps) {
  const id = `${idPrefix}-${name}`;
  const describedBy = [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined;
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      {children({ id, describedBy, invalid: error ? true : undefined })}
      {hint ? (
        <p id={`${id}-hint`} className={styles.range}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className={styles.error}>
          <span aria-hidden="true">⚠ </span>
          {error}
        </p>
      ) : null}
    </div>
  );
}

interface TransactionFormProps {
  /** Edit mode: the transaction to change; the fields start with its values. Absent means add mode. */
  transaction?: Transaction;
  /** Edit mode: called after a successful save. */
  onSaved?: () => void;
  /** Edit mode: called when the user gives up. */
  onCancel?: () => void;
}

type ControlElement = HTMLInputElement | HTMLSelectElement;

/**
 * Add or edit form. Decimal text becomes integer minor units by string math before it is sent; an existing
 * amount is shown back as decimal text. Server field errors sit next to their inputs and the values stay.
 */
export function TransactionForm({ transaction, onSaved, onCancel }: TransactionFormProps = {}) {
  const create = useCreateTransaction();
  const update = useUpdateTransaction();
  const accounts = useAccountOptions();
  const categories = useCategoryOptions();
  const editing = transaction !== undefined;
  const idPrefix = editing ? 'transaction-edit' : 'transaction';
  const digits = minorDigits();
  const [occurredOn, setOccurredOn] = useState(transaction?.occurredOn ?? '');
  const [amount, setAmount] = useState(transaction ? formatForInput(transaction.amountMinor, digits) : '');
  const [description, setDescription] = useState(transaction?.description ?? '');
  const [accountId, setAccountId] = useState(transaction ? String(transaction.accountId) : '');
  const [categoryId, setCategoryId] = useState(transaction ? String(transaction.categoryId) : '');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const refs = useRef<Partial<Record<FieldName, ControlElement | null>>>({});
  const alertRef = useRef<HTMLParagraphElement | null>(null);

  // Focus moves to the first field with an error each time the error set is replaced.
  useEffect(() => {
    const first = FIELD_ORDER.find((field) => errors[field]);
    if (first) refs.current[first]?.focus();
  }, [errors]);

  useEffect(() => {
    if (formError) alertRef.current?.focus();
  }, [formError]);

  if (accounts.isPending || categories.isPending) {
    return <p role="status">Loading the form...</p>;
  }

  const missing: string[] = [];
  if (!accounts.data || accounts.data.length === 0) missing.push('an account');
  if (!categories.data || categories.data.length === 0) missing.push('a category');
  if (missing.length > 0) {
    return (
      <p className={styles.empty} role="status">
        To add a transaction you first need {missing.join(' and ')}. Create {missing.length > 1 ? 'them' : 'it'} on the{' '}
        {missing.length > 1 ? 'Accounts and Categories pages' : missing[0] === 'an account' ? 'Accounts page' : 'Categories page'}
        , then come back.
      </p>
    );
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const next: FieldErrors = {};
    if (!/^\d{4}-\d{2}-\d{2}$/.test(occurredOn)) next.occurredOn = 'Enter the date of the transaction.';
    const amountMinor = parseAmount(amount, digits);
    if (amountMinor === null) {
      next.amount =
        digits === 0
          ? 'Enter a whole number greater than zero, for example 12.'
          : `Enter an amount greater than zero with at most ${digits} decimal places, for example 12.50.`;
    }
    const trimmed = description.trim();
    if (trimmed === '') next.description = 'Enter a description.';
    else if (trimmed.length > 200) next.description = 'The description must be at most 200 characters.';
    if (accountId === '') next.accountId = 'Choose an account.';
    if (categoryId === '') next.categoryId = 'Choose a category.';
    setErrors(next);
    if (Object.keys(next).length > 0 || amountMinor === null) return;

    const input = {
      accountId: Number(accountId),
      categoryId: Number(categoryId),
      occurredOn,
      amountMinor,
      description: trimmed,
    };
    const handlers = {
      onSuccess: () => {
        if (editing) {
          onSaved?.();
          return;
        }
        setOccurredOn('');
        setAmount('');
        setDescription('');
        setAccountId('');
        setCategoryId('');
        setErrors({});
      },
      onError: (problem: Error) => {
        if (problem instanceof ApiProblem && problem.status === 400) {
          const { fields, rest } = splitProblem(problem.errors);
          setErrors(fields);
          if (Object.keys(fields).length === 0) setFormError(rest[0] ?? problem.message);
        } else {
          setFormError('Could not save the transaction right now. Try again.');
        }
      },
    };
    if (transaction) update.mutate({ id: transaction.id, input }, handlers);
    else create.mutate(input, handlers);
  }

  const pending = create.isPending || update.isPending;
  const setRef = (name: FieldName) => (element: ControlElement | null) => {
    refs.current[name] = element;
  };

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className={styles.filters}
      aria-label={editing ? `Edit transaction ${transaction.description}` : 'Add a transaction'}
    >
      {formError ? (
        <p role="alert" tabIndex={-1} ref={alertRef} className={styles.error}>
          <span aria-hidden="true">⚠ </span>
          {formError}
        </p>
      ) : null}
      <Field idPrefix={idPrefix} name="occurredOn" label="Date" error={errors.occurredOn}>
        {({ id, describedBy, invalid }) => (
          <input
            id={id}
            name="occurredOn"
            type="date"
            value={occurredOn}
            onChange={(event) => setOccurredOn(event.target.value)}
            ref={setRef('occurredOn')}
            aria-invalid={invalid}
            aria-describedby={describedBy}
            className={styles.control}
          />
        )}
      </Field>
      <Field idPrefix={idPrefix} name="amount" label="Amount" error={errors.amount} hint="For example 12.50.">
        {({ id, describedBy, invalid }) => (
          <input
            id={id}
            name="amount"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            ref={setRef('amount')}
            aria-invalid={invalid}
            aria-describedby={describedBy}
            className={styles.control}
          />
        )}
      </Field>
      <Field idPrefix={idPrefix} name="description" label="Description" error={errors.description}>
        {({ id, describedBy, invalid }) => (
          <input
            id={id}
            name="description"
            type="text"
            autoComplete="off"
            maxLength={200}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            ref={setRef('description')}
            aria-invalid={invalid}
            aria-describedby={describedBy}
            className={styles.control}
          />
        )}
      </Field>
      <Field idPrefix={idPrefix} name="accountId" label="Account" error={errors.accountId}>
        {({ id, describedBy, invalid }) => (
          <select
            id={id}
            name="accountId"
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
            ref={setRef('accountId')}
            aria-invalid={invalid}
            aria-describedby={describedBy}
            className={styles.control}
          >
            <option value="">Choose an account</option>
            {(accounts.data ?? []).map((account) => (
              <option key={account.id} value={String(account.id)}>
                {account.name}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field idPrefix={idPrefix} name="categoryId" label="Category" error={errors.categoryId}>
        {({ id, describedBy, invalid }) => (
          <select
            id={id}
            name="categoryId"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            ref={setRef('categoryId')}
            aria-invalid={invalid}
            aria-describedby={describedBy}
            className={styles.control}
          >
            <option value="">Choose a category</option>
            {(categories.data ?? []).map((category) => (
              <option key={category.id} value={String(category.id)}>
                {category.name}
              </option>
            ))}
          </select>
        )}
      </Field>
      <div className={styles.field}>
        <button type="submit" disabled={pending} className={styles.button}>
          {editing ? (pending ? 'Saving...' : 'Save changes') : pending ? 'Adding...' : 'Add transaction'}
        </button>
        {editing ? (
          <button type="button" onClick={onCancel} className={styles.button}>
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}

interface DeleteTransactionProps {
  transaction: Transaction;
  /** Called after the transaction is deleted. */
  onDeleted?: () => void;
}

/**
 * Delete with a confirm step. The confirm group takes focus when it opens, Escape or Cancel closes it
 * and focus goes back to the Delete button; every control is a real button, so it is keyboard operable.
 */
export function DeleteTransaction({ transaction, onDeleted }: DeleteTransactionProps) {
  const remove = useDeleteTransaction();
  const [confirming, setConfirming] = useState(false);
  const [failed, setFailed] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  const returnFocus = useRef(false);

  useEffect(() => {
    if (confirming) cancelRef.current?.focus();
    else if (returnFocus.current) {
      returnFocus.current = false;
      triggerRef.current?.focus();
    }
  }, [confirming]);

  function close() {
    returnFocus.current = true;
    setConfirming(false);
    setFailed(false);
  }

  function confirm() {
    setFailed(false);
    remove.mutate(transaction.id, {
      onSuccess: () => {
        returnFocus.current = true;
        setConfirming(false);
        onDeleted?.();
      },
      onError: () => setFailed(true),
    });
  }

  if (!confirming) {
    return (
      <button
        type="button"
        ref={triggerRef}
        className={styles.button}
        aria-label={`Delete ${transaction.description}`}
        onClick={() => setConfirming(true)}
      >
        Delete
      </button>
    );
  }

  return (
    <div
      role="alertdialog"
      aria-modal="false"
      aria-labelledby={`delete-${transaction.id}-title`}
      className={styles.field}
      onKeyDown={(event) => {
        if (event.key === 'Escape') close();
      }}
    >
      <p id={`delete-${transaction.id}-title`}>Delete “{transaction.description}”? This cannot be undone.</p>
      {failed ? (
        <p role="alert" className={styles.error}>
          <span aria-hidden="true">⚠ </span>
          Could not delete the transaction right now. Try again.
        </p>
      ) : null}
      <button type="button" className={styles.button} onClick={confirm} disabled={remove.isPending}>
        {remove.isPending ? 'Deleting...' : 'Confirm delete'}
      </button>
      <button type="button" ref={cancelRef} className={styles.button} onClick={close}>
        Cancel
      </button>
    </div>
  );
}
