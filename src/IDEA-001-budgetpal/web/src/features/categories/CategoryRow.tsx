import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  CategoryApiError,
  useDeleteCategory,
  useUpdateCategory,
  type Category,
  type CategoryKind,
} from './categories.api';
import styles from './CategoriesPage.module.css';

export const MAX_NAME_LENGTH = 60;
export const KIND_LABELS: Record<CategoryKind, string> = { expense: 'Expense', income: 'Income' };

/** Mirrors the api's rules so the common mistake is caught before a request; the server stays the authority. */
export function validateName(name: string): string | undefined {
  const trimmed = name.trim();
  if (trimmed === '') return 'Name is required.';
  if (trimmed.length > MAX_NAME_LENGTH) return `Name must be at most ${MAX_NAME_LENGTH} characters.`;
  return undefined;
}

const rowId = (id: number) => `category-row-${id}`;

/** Moves focus to the row by id: the row may have been re-created in another group after a kind change. */
function focusRow(id: number) {
  document.getElementById(rowId(id))?.focus();
}

function editError(problem: unknown): string {
  if (problem instanceof CategoryApiError) {
    if (problem.status === 409 || problem.status === 400) {
      return problem.errors[0]?.message ?? problem.message;
    }
    if (problem.status === 404) return 'This category no longer exists.';
  }
  return 'Could not save the category right now. Try again.';
}

type Mode = 'view' | 'edit' | 'confirm';

export function CategoryRow({ category }: { category: Category }) {
  const update = useUpdateCategory();
  const remove = useDeleteCategory();
  const [mode, setMode] = useState<Mode>('view');
  const [name, setName] = useState(category.name);
  const [kind, setKind] = useState<CategoryKind>(category.kind);
  const [error, setError] = useState<string | undefined>();
  const [deleteMessage, setDeleteMessage] = useState<string | undefined>();
  const nameRef = useRef<HTMLInputElement | null>(null);
  const confirmRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (mode === 'edit') nameRef.current?.focus();
    else if (mode === 'confirm') confirmRef.current?.focus();
  }, [mode]);

  const errorId = `${rowId(category.id)}-error`;
  const messageId = `${rowId(category.id)}-message`;

  function startEdit() {
    setName(category.name);
    setKind(category.kind);
    setError(undefined);
    setDeleteMessage(undefined);
    setMode('edit');
  }

  function cancel() {
    setError(undefined);
    setMode('view');
    // Wait for the view mode to render before moving focus back to the row.
    queueMicrotask(() => focusRow(category.id));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const invalid = validateName(name);
    if (invalid) {
      setError(invalid);
      nameRef.current?.focus();
      return;
    }
    setError(undefined);
    try {
      await update.mutateAsync({ id: category.id, name: name.trim(), kind });
      setMode('view');
      queueMicrotask(() => focusRow(category.id));
    } catch (problem) {
      setError(editError(problem));
      nameRef.current?.focus();
    }
  }

  async function confirmDelete() {
    try {
      await remove.mutateAsync(category.id);
    } catch (problem) {
      setMode('view');
      setDeleteMessage(
        problem instanceof CategoryApiError && problem.status === 409
          ? `${category.name} is in use and cannot be deleted.`
          : 'Could not delete the category right now. Try again.',
      );
      queueMicrotask(() => focusRow(category.id));
    }
  }

  if (mode === 'edit') {
    const nameId = `${rowId(category.id)}-name`;
    const kindId = `${rowId(category.id)}-kind`;
    return (
      <li id={rowId(category.id)} tabIndex={-1} className={styles.item}>
        <form onSubmit={save} noValidate className={styles.rowForm} aria-label={`Edit ${category.name}`}>
          <div className={styles.field}>
            <label htmlFor={nameId} className={styles.label}>
              Name
            </label>
            <input
              id={nameId}
              type="text"
              autoComplete="off"
              className={styles.input}
              value={name}
              onChange={(event) => setName(event.target.value)}
              ref={nameRef}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor={kindId} className={styles.label}>
              Kind
            </label>
            <select
              id={kindId}
              className={styles.input}
              value={kind}
              onChange={(event) => setKind(event.target.value as CategoryKind)}
            >
              <option value="expense">{KIND_LABELS.expense}</option>
              <option value="income">{KIND_LABELS.income}</option>
            </select>
          </div>
          <div className={styles.actions}>
            <button type="submit" className={styles.button} disabled={update.isPending} aria-label={`Save ${category.name}`}>
              Save
            </button>
            <button type="button" className={styles.button} onClick={cancel} aria-label={`Cancel editing ${category.name}`}>
              Cancel
            </button>
          </div>
          {error ? (
            <p id={errorId} role="alert" className={styles.message}>
              <span aria-hidden="true">⚠ </span>
              {error}
            </p>
          ) : null}
        </form>
      </li>
    );
  }

  return (
    <li id={rowId(category.id)} tabIndex={-1} className={styles.item}>
      <span>{category.name}</span>
      <span className={styles.kind}>{KIND_LABELS[category.kind]}</span>
      {mode === 'confirm' ? (
        <span className={styles.actions} role="group" aria-label={`Confirm deleting ${category.name}`}>
          <span>Delete {category.name}?</span>
          <button
            type="button"
            className={styles.button}
            onClick={confirmDelete}
            disabled={remove.isPending}
            ref={confirmRef}
            aria-label={`Confirm delete ${category.name}`}
          >
            Confirm
          </button>
          <button
            type="button"
            className={styles.button}
            onClick={() => {
              setMode('view');
              queueMicrotask(() => focusRow(category.id));
            }}
            aria-label={`Keep ${category.name}`}
          >
            Keep
          </button>
        </span>
      ) : (
        <span className={styles.actions}>
          <button type="button" className={styles.button} onClick={startEdit} aria-label={`Edit ${category.name}`}>
            Edit
          </button>
          <button
            type="button"
            className={styles.button}
            onClick={() => {
              setDeleteMessage(undefined);
              setMode('confirm');
            }}
            aria-label={`Delete ${category.name}`}
          >
            Delete
          </button>
        </span>
      )}
      {deleteMessage ? (
        <p id={messageId} role="alert" className={styles.message}>
          <span aria-hidden="true">⚠ </span>
          {deleteMessage}
        </p>
      ) : null}
    </li>
  );
}
