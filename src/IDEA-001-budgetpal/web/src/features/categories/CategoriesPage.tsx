import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  CategoryApiError,
  useCategories,
  useCreateCategory,
  type Category,
  type CategoryKind,
} from './categories.api';
import styles from './CategoriesPage.module.css';

export const MAX_NAME_LENGTH = 60;
export const KIND_LABELS: Record<CategoryKind, string> = { expense: 'Expense', income: 'Income' };
const GROUPS: readonly CategoryKind[] = ['expense', 'income'];

export interface CreateErrors {
  name?: string;
  kind?: string;
  form?: string;
}

/** Mirrors the api's rules so the common mistake is caught before a request; the server stays the authority. */
export function validateName(name: string): string | undefined {
  const trimmed = name.trim();
  if (trimmed === '') return 'Name is required.';
  if (trimmed.length > MAX_NAME_LENGTH) return `Name must be at most ${MAX_NAME_LENGTH} characters.`;
  return undefined;
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

function CategoryItem({ category }: { category: Category }) {
  return (
    <li className={styles.item}>
      <span>{category.name}</span>
      <span className={styles.kind}>{KIND_LABELS[category.kind]}</span>
    </li>
  );
}

function CategoryGroups({ categories }: { categories: Category[] }) {
  return (
    <>
      {GROUPS.map((kind) => {
        const members = categories.filter((category) => category.kind === kind);
        if (members.length === 0) return null;
        const headingId = `categories-${kind}`;
        return (
          <section key={kind} className={styles.group} aria-labelledby={headingId}>
            <h2 id={headingId} className={styles.groupTitle}>
              {KIND_LABELS[kind]} categories
            </h2>
            <ul className={styles.list}>
              {members.map((category) => (
                <CategoryItem key={category.id} category={category} />
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
    <section className={styles.page}>
      <h1>Categories</h1>
      <form onSubmit={onSubmit} noValidate className={styles.form} aria-label="Add a category">
        <div className={styles.field}>
          <label htmlFor="category-name" className={styles.label}>
            Name
          </label>
          <input
            id="category-name"
            name="name"
            type="text"
            autoComplete="off"
            className={styles.input}
            value={name}
            onChange={(event) => setName(event.target.value)}
            ref={nameRef}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? nameErrorId : undefined}
          />
          {errors.name ? (
            <p id={nameErrorId} role="alert" className={styles.message}>
              <span aria-hidden="true">⚠ </span>
              {errors.name}
            </p>
          ) : null}
        </div>
        <div className={styles.field}>
          <label htmlFor="category-kind" className={styles.label}>
            Kind
          </label>
          <select
            id="category-kind"
            name="kind"
            className={styles.input}
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
            <p id={kindErrorId} role="alert" className={styles.message}>
              <span aria-hidden="true">⚠ </span>
              {errors.kind}
            </p>
          ) : null}
        </div>
        <button type="submit" className={styles.button} disabled={create.isPending}>
          Add category
        </button>
      </form>
      {errors.form ? (
        <p role="alert" className={styles.message}>
          <span aria-hidden="true">⚠ </span>
          {errors.form}
        </p>
      ) : null}

      {categories.isPending ? <p role="status">Loading categories...</p> : null}
      {categories.isError ? (
        <p role="alert" className={styles.message}>
          <span aria-hidden="true">⚠ </span>
          Could not load your categories. Try again later.
        </p>
      ) : null}
      {categories.isSuccess && list.length === 0 ? (
        <p className={styles.empty}>
          You have no categories yet. Type a name, choose Expense or Income, and select Add category to create your first one.
        </p>
      ) : null}
      {categories.isSuccess && list.length > 0 ? <CategoryGroups categories={list} /> : null}
    </section>
  );
}
