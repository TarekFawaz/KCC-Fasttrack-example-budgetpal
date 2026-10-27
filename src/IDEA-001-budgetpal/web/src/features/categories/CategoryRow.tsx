import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  CategoryApiError,
  useDeleteCategory,
  useUpdateCategory,
  type Category,
  type CategoryKind,
} from './categories.api';

export const MAX_NAME_LENGTH = 60;
export const KIND_LABELS: Record<CategoryKind, string> = { expense: 'Expense', income: 'Income' };

/** Icon and word per kind: the kind is never shown by colour alone. */
export const KIND_ICONS: Record<CategoryKind, string> = { expense: '↓', income: '↑' };

/** The one look of an inline error: text with an icon, never colour alone. */
export const MESSAGE_CLASSES = 'm-0 basis-full text-sm font-semibold text-destructive';

/** The native kind select keeps its role, label and keyboard behaviour; it is dressed like the kit Input. */
export const SELECT_CLASSES =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive md:text-sm';

const ITEM_CLASSES = 'flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3 text-card-foreground [overflow-wrap:anywhere] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/** A category kind as a Badge: icon plus text. */
export function KindBadge({ kind }: { kind: CategoryKind }) {
  return (
    <Badge variant="secondary">
      <span aria-hidden="true">{KIND_ICONS[kind]}</span>
      <span>{KIND_LABELS[kind]}</span>
    </Badge>
  );
}

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
      <li id={rowId(category.id)} tabIndex={-1} className={ITEM_CLASSES}>
        <form onSubmit={save} noValidate className="flex w-full flex-wrap items-start gap-3" aria-label={`Edit ${category.name}`}>
          <div className="flex min-w-0 flex-1 basis-40 flex-col gap-1.5">
            <Label htmlFor={nameId}>
              Name
            </Label>
            <Input
              id={nameId}
              type="text"
              autoComplete="off"
              value={name}
              onChange={(event) => setName(event.target.value)}
              ref={nameRef}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
            />
          </div>
          <div className="flex min-w-0 flex-1 basis-40 flex-col gap-1.5">
            <Label htmlFor={kindId}>
              Kind
            </Label>
            <select
              id={kindId}
              className={SELECT_CLASSES}
              value={kind}
              onChange={(event) => setKind(event.target.value as CategoryKind)}
            >
              <option value="expense">{KIND_LABELS.expense}</option>
              <option value="income">{KIND_LABELS.income}</option>
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" size="sm" disabled={update.isPending} aria-label={`Save ${category.name}`}>
              Save
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={cancel} aria-label={`Cancel editing ${category.name}`}>
              Cancel
            </Button>
          </div>
          {error ? (
            <p id={errorId} role="alert" className={MESSAGE_CLASSES}>
              <span aria-hidden="true">⚠ </span>
              {error}
            </p>
          ) : null}
        </form>
      </li>
    );
  }

  return (
    <li id={rowId(category.id)} tabIndex={-1} className={ITEM_CLASSES}>
      <span className="min-w-0 flex-1 basis-32 font-semibold">{category.name}</span>
      <KindBadge kind={category.kind} />
      {mode === 'confirm' ? (
        <span className="flex flex-wrap items-center gap-2" role="group" aria-label={`Confirm deleting ${category.name}`}>
          <span>Delete {category.name}?</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={confirmDelete}
            disabled={remove.isPending}
            ref={confirmRef}
            aria-label={`Confirm delete ${category.name}`}
          >
            Confirm
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setMode('view');
              queueMicrotask(() => focusRow(category.id));
            }}
            aria-label={`Keep ${category.name}`}
          >
            Keep
          </Button>
        </span>
      ) : (
        <span className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={startEdit} aria-label={`Edit ${category.name}`}>
            Edit
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setDeleteMessage(undefined);
              setMode('confirm');
            }}
            aria-label={`Delete ${category.name}`}
          >
            Delete
          </Button>
        </span>
      )}
      {deleteMessage ? (
        <p id={messageId} role="alert" className={MESSAGE_CLASSES}>
          <span aria-hidden="true">⚠ </span>
          {deleteMessage}
        </p>
      ) : null}
    </li>
  );
}
