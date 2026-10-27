import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  ACCOUNT_TYPES,
  ACCOUNT_TYPE_LABELS,
  ApiProblem,
  useCreateAccount,
  useUpdateAccount,
  type Account,
  type AccountType,
  type FieldProblem,
} from './accounts.api';
import styles from './accounts.module.css';
import { fromMinorUnits, minorDigits, toMinorUnits } from './money';

type FieldName = 'name' | 'type' | 'openingBalance';
export type FieldErrors = Partial<Record<FieldName, string>>;

const FIELD_ORDER: readonly FieldName[] = ['name', 'type', 'openingBalance'];

/** The api names the balance `openingBalanceMinor`; the form calls its input `openingBalance`. */
const API_FIELD: Record<string, FieldName> = { name: 'name', type: 'type', openingBalanceMinor: 'openingBalance' };

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
  children: (props: { id: string; describedBy: string | undefined; invalid: true | undefined }) => React.ReactNode;
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
        <p id={`${id}-hint`} className={styles.hint}>
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

interface AccountFormProps {
  /** Edit mode: the account to change; the fields start with its values. Absent means add mode. */
  account?: Account;
  /** Edit mode: called after a successful save. */
  onSaved?: () => void;
  /** Edit mode: called when the user gives up. */
  onCancel?: () => void;
}

/**
 * Add or edit form. Decimal text becomes integer minor units by string math before it is sent, and an
 * existing balance is shown back as decimal text.
 */
export function AccountForm({ account, onSaved, onCancel }: AccountFormProps = {}) {
  const create = useCreateAccount();
  const update = useUpdateAccount();
  const editing = account !== undefined;
  const idPrefix = editing ? 'account-edit' : 'account';
  const [name, setName] = useState(account?.name ?? '');
  const [type, setType] = useState<AccountType>(account?.type ?? 'checking');
  const [balance, setBalance] = useState(account ? fromMinorUnits(account.openingBalanceMinor, minorDigits()) : '');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const refs = useRef<Partial<Record<FieldName, HTMLInputElement | HTMLSelectElement | null>>>({});
  const alertRef = useRef<HTMLParagraphElement | null>(null);
  const digits = minorDigits();

  // Focus moves to the first field with an error each time the error set is replaced.
  useEffect(() => {
    const first = FIELD_ORDER.find((field) => errors[field]);
    if (first) refs.current[first]?.focus();
  }, [errors]);

  useEffect(() => {
    if (formError) alertRef.current?.focus();
  }, [formError]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const next: FieldErrors = {};
    const trimmed = name.trim();
    if (trimmed === '') next.name = 'Enter a name for the account.';
    else if (trimmed.length > 60) next.name = 'The name must be at most 60 characters.';
    // A blank balance means zero, the api default.
    const openingBalanceMinor = balance.trim() === '' ? 0 : toMinorUnits(balance, digits);
    if (openingBalanceMinor === null) {
      next.openingBalance =
        digits === 0
          ? 'Enter a whole number, for example 1200.'
          : `Enter an amount with at most ${digits} decimal places, for example 1234.50.`;
    }
    setErrors(next);
    if (next.name || next.openingBalance || openingBalanceMinor === null) return;

    const input = { name: trimmed, type, openingBalanceMinor };
    const handlers = {
      onSuccess: () => {
        if (editing) {
          onSaved?.();
          return;
        }
        setName('');
        setType('checking');
        setBalance('');
        setErrors({});
      },
      onError: (problem: Error) => {
        if (problem instanceof ApiProblem && (problem.status === 400 || problem.status === 409)) {
          const { fields, rest } = splitProblem(problem.errors);
          setErrors(fields);
          if (Object.keys(fields).length === 0) setFormError(rest[0] ?? problem.message);
        } else {
          setFormError('Could not save the account right now. Try again.');
        }
      },
    };
    if (account) update.mutate({ id: account.id, input }, handlers);
    else create.mutate(input, handlers);
  }

  const pending = create.isPending || update.isPending;

  return (
    <form onSubmit={onSubmit} noValidate className={styles.form} aria-label={editing ? `Edit account ${account.name}` : 'Add an account'}>
      {formError ? (
        <p role="alert" tabIndex={-1} ref={alertRef} className={styles.error}>
          <span aria-hidden="true">⚠ </span>
          {formError}
        </p>
      ) : null}
      <Field idPrefix={idPrefix} name="name" label="Name" error={errors.name}>
        {({ id, describedBy, invalid }) => (
          <input
            id={id}
            name="name"
            type="text"
            autoComplete="off"
            maxLength={120}
            value={name}
            onChange={(event) => setName(event.target.value)}
            ref={(element) => {
              refs.current.name = element;
            }}
            aria-invalid={invalid}
            aria-describedby={describedBy}
            className={styles.control}
          />
        )}
      </Field>
      <Field idPrefix={idPrefix} name="type" label="Type" error={errors.type}>
        {({ id, describedBy, invalid }) => (
          <select
            id={id}
            name="type"
            value={type}
            onChange={(event) => setType(event.target.value as AccountType)}
            ref={(element) => {
              refs.current.type = element;
            }}
            aria-invalid={invalid}
            aria-describedby={describedBy}
            className={styles.control}
          >
            {ACCOUNT_TYPES.map((option) => (
              <option key={option} value={option}>
                {ACCOUNT_TYPE_LABELS[option]}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field
        idPrefix={idPrefix}
        name="openingBalance"
        label="Opening balance"
        error={errors.openingBalance}
        hint="Optional. Leave blank for 0."
      >
        {({ id, describedBy, invalid }) => (
          <input
            id={id}
            name="openingBalance"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={balance}
            onChange={(event) => setBalance(event.target.value)}
            ref={(element) => {
              refs.current.openingBalance = element;
            }}
            aria-invalid={invalid}
            aria-describedby={describedBy}
            className={styles.control}
          />
        )}
      </Field>
      <button type="submit" disabled={pending} className={styles.button}>
        {editing ? (pending ? 'Saving...' : 'Save changes') : pending ? 'Adding...' : 'Add account'}
      </button>
      {editing ? (
        <button type="button" onClick={onCancel} className={styles.button}>
          Cancel
        </button>
      ) : null}
    </form>
  );
}
