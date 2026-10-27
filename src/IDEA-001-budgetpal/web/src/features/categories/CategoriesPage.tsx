import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  CategoryApiError,
  useCategories,
  useCreateCategory,
  type Category,
  type CategoryKind,
} from './categories.api';
import { CategoryRow, KIND_LABELS, MAX_NAME_LENGTH, MESSAGE_CLASSES, SELECT_CLASSES, validateName } from './CategoryRow';

export { KIND_LABELS, MAX_NAME_LENGTH, validateName };

const GROUPS: readonly CategoryKind[] = ['expense', 'income'];

export interface CreateErrors {
  name?: string;
  kind?: string;
  form?: string;
}

/** Maps a refused create onto the fields: 400 `errors[]` by field name, 409 onto the name, the rest to a form message. */
export function errorsFromProblem(problem: unknown): CreateErrors {
  if (!(problem instanceof CategoryApiError)) return { form: 'Could not save the category right now. Try again.' };
  if (problem.status === 409) return { name: problem.errors.find((e) => e.field === 'name')?.message ?? problem.message };
  if (problem.status === 400) {
    const errors: CreateErrors = {};
    for (const entry of problem.errors) {
      if (entry.field === 'name' && !errors.name) errors.name = entry.message;
      else if (entry.field === 'kind' && !errors.kind) errors.kind = entry.message;
    }
    return errors.name || errors.kind ? errors : { form: problem.message };
  }
  return { form: 'Could not save the category right now. Try again.' };
}

function CategoryGroups({ categories }: { categories: Category[] }) {
  return (
    <>
      {GROUPS.map((kind) => {
        const members = categories.filter((category) => category.kind === kind);
        if (members.length === 0) return null;
        const headingId = `categories-${kind}`;
        return (
          <section key={kind} className="flex flex-col gap-3" aria-labelledby={headingId}>
            <h2 id={headingId} className="text-lg font-semibold tracking-tight">
              {KIND_LABELS[kind]} categories
            </h2>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {members.map((category) => (
                <CategoryRow key={category.id} category={category} />
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}

export function CategoriesPage() {
  const categories = useCategories();
  const create = useCreateCategory();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<CategoryKind>('expense');
  const [errors, setErrors] = useState<CreateErrors>({});
  const nameRef = useRef<HTMLInputElement | null>(null);
  const kindRef = useRef<HTMLSelectElement | null>(null);

  // Send the keyboard user to the first field with an error each time the error set is replaced.
  useEffect(() => {
    if (errors.name) nameRef.current?.focus();
    else if (errors.kind) kindRef.current?.focus();
  }, [errors]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nameError = validateName(name);
    if (nameError) {
      setErrors({ name: nameError });
      return;
    }
    setErrors({});
    create.mutate(
      { name: name.trim(), kind },
      {
        onSuccess: () => {
          setName('');
          setKind('expense');
          nameRef.current?.focus();
        },
        onError: (problem) => setErrors(errorsFromProblem(problem)),
      },
    );
  }

  const nameErrorId = 'category-name-error';
  const kindErrorId = 'category-kind-error';
  const list = categories.data ?? [];

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Categories</h1>
      <form onSubmit={onSubmit} noValidate
        className="grid grid-cols-1 gap-4 rounded-lg border bg-card p-4 text-card-foreground shadow-sm md:grid-cols-[2fr_1fr_auto] md:items-start"
        aria-label="Add a category">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="category-name">
            Name
          </Label>
          <Input
            id="category-name"
            name="name"
            type="text"
            autoComplete="off"
            value={name}
            onChange={(event) => setName(event.target.value)}
            ref={nameRef}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? nameErrorId : undefined}
          />
          {errors.name ? (
            <p id={nameErrorId} role="alert" className={MESSAGE_CLASSES}>
              <span aria-hidden="true">⚠ </span>
              {errors.name}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="category-kind">
            Kind
          </Label>
          <select
            id="category-kind"
            name="kind"
            className={SELECT_CLASSES}
            value={kind}
            onChange={(event) => setKind(event.target.value as CategoryKind)}
            ref={kindRef}
            aria-invalid={errors.kind ? true : undefined}
            aria-describedby={errors.kind ? kindErrorId : undefined}
          >
            <option value="expense">{KIND_LABELS.expense}</option>
            <option value="income">{KIND_LABELS.income}</option>
          </select>
          {errors.kind ? (
            <p id={kindErrorId} role="alert" className={MESSAGE_CLASSES}>
              <span aria-hidden="true">⚠ </span>
              {errors.kind}
            </p>
          ) : null}
        </div>
        <Button type="submit" disabled={create.isPending} className="md:mt-[1.625rem]">
          Add category
        </Button>
      </form>
      {errors.form ? (
        <p role="alert" className={MESSAGE_CLASSES}>
          <span aria-hidden="true">⚠ </span>
          {errors.form}
        </p>
      ) : null}

      {categories.isPending ? <p role="status">Loading categories...</p> : null}
      {categories.isError ? (
        <p role="alert" className={MESSAGE_CLASSES}>
          <span aria-hidden="true">⚠ </span>
          Could not load your categories. Try again later.
        </p>
      ) : null}
      {categories.isSuccess && list.length === 0 ? (
        <p className="m-0 rounded-md border border-dashed p-4 text-muted-foreground">
          You have no categories yet. Type a name, choose Expense or Income, and select Add category to create your first one.
        </p>
      ) : null}
      {categories.isSuccess && list.length > 0 ? <CategoryGroups categories={list} /> : null}
    </section>
  );
}
