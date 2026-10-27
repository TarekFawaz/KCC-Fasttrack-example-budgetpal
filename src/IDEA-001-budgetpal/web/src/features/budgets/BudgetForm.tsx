import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiProblem, useSetBudget, type CategoryOption, type FieldProblem } from './api';

/**
 * Money helpers (D-13, GR-007): amounts are integer minor units. Decimal text is converted by string
 * math, never through a float, so `12.50` is exactly `1250`. Kept inside this feature (GR-006).
 */

/** Largest amount in minor units; the api rejects anything beyond it. */
export const MAX_AMOUNT_MINOR = 999_999_999_999;

export function installCurrency(): string {
  const configured = (import.meta.env.VITE_CURRENCY as string | undefined)?.trim().toUpperCase();
  return configured && /^[A-Z]{3}$/.test(configured) ? configured : 'USD';
}

/** Number of minor-unit digits of the install currency (2 for USD, 0 for JPY), from `Intl`. */
export function minorDigits(currency: string = installCurrency()): number {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
}

/**
 * Parses positive decimal text (`12.50`, `12`, `0.05`, `.5`) into integer minor units. Returns `null` for
 * anything else: blank, signs, letters, more fraction digits than the currency has, zero or too large.
 */
export function parseAmount(text: string, digits: number = minorDigits()): number | null {
  const match = /^(\d*)(?:\.(\d*))?$/.exec(text.trim());
  if (!match) return null;
  const [, whole = '', fraction = ''] = match;
  if (whole === '' && fraction === '') return null;
  if (fraction.length > digits) return null;
  const magnitude = Number(`${whole === '' ? '0' : whole}${fraction.padEnd(digits, '0')}`);
  if (!Number.isSafeInteger(magnitude) || magnitude < 1 || magnitude > MAX_AMOUNT_MINOR) return null;
  return magnitude;
}

/** Integer minor units to decimal text, built by string math (`1250` -> `12.50`). */
export function toDecimalText(minor: number, digits: number = minorDigits()): string {
  const padded = String(Math.abs(minor)).padStart(digits + 1, '0');
  const whole = padded.slice(0, padded.length - digits);
  const fraction = padded.slice(padded.length - digits);
  return `${minor < 0 ? '-' : ''}${whole}${digits > 0 ? `.${fraction}` : ''}`;
}

/** Integer minor units shown through `Intl` with the install currency; no float on the way. */
export function formatAmount(minor: number, currency: string = installCurrency()): string {
  const decimal = toDecimalText(minor, minorDigits(currency));
  // Intl.NumberFormat v3 formats a decimal string exactly; the cast only satisfies the older lib typing.
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(decimal as unknown as number);
}

/** The native category select keeps its role, label and keyboard behaviour; it is dressed like the kit Input. */
export const SELECT_CLASSES =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive md:text-sm';

const ERROR_CLASSES = 'm-0 text-sm font-semibold text-destructive';

type FieldName = 'category' | 'amount';
export type FieldErrors = Partial<Record<FieldName, string>>;

const FIELD_ORDER: readonly FieldName[] = ['category', 'amount'];

/** The api names these `categoryId` and `amountMinor`; the form calls its inputs `category` and `amount`. */
const API_FIELD: Record<string, FieldName> = { categoryId: 'category', amountMinor: 'amount' };

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

/** The message under the amount input for text that is not a positive amount the currency can hold. */
export function amountMessage(digits: number): string {
  return digits === 0
    ? 'Enter a whole number greater than zero, for example 500.'
    : `Enter an amount greater than zero with at most ${digits} decimal places, for example 500.00.`;
}

export interface BudgetFormProps {
  /** `YYYY-MM` the budget is set for. */
  month: string;
  /** The expense categories to choose from. */
  categories: CategoryOption[];
  /** The chosen category id as text, or empty. The page owns it so a list row can preselect one. */
  categoryId: string;
  onCategoryChange: (categoryId: string) => void;
  /** Gives the page the amount input, so it can move focus there. */
  amountRef?: RefObject<HTMLInputElement>;
  /** Called after the api stored the budget. */
  onSaved?: () => void;
}

/**
 * Set-budget form: an expense category and an amount for the selected month. Decimal text becomes integer
 * minor units by string math before it is sent; saving again for the same category replaces the amount.
 * Invalid input shows a labelled inline error and sends nothing; an api error sits next to its field.
 */
export function BudgetForm({ month, categories, categoryId, onCategoryChange, amountRef, onSaved }: BudgetFormProps) {
  const save = useSetBudget();
  const digits = minorDigits();
  const [amount, setAmount] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const categoryRef = useRef<HTMLSelectElement | null>(null);
  const ownAmountRef = useRef<HTMLInputElement | null>(null);
  const alertRef = useRef<HTMLParagraphElement | null>(null);
  const amountInput = amountRef ?? ownAmountRef;

  // Focus moves to the first field with an error each time the error set is replaced.
  useEffect(() => {
    const first = FIELD_ORDER.find((field) => errors[field]);
    if (first === 'category') categoryRef.current?.focus();
    else if (first === 'amount') amountInput.current?.focus();
  }, [errors, amountInput]);

  useEffect(() => {
    if (formError) alertRef.current?.focus();
  }, [formError]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setSavedNote(null);
    const next: FieldErrors = {};
    if (categoryId === '') next.category = 'Choose an expense category.';
    const amountMinor = parseAmount(amount, digits);
    if (amountMinor === null) next.amount = amountMessage(digits);
    setErrors(next);
    if (Object.keys(next).length > 0 || amountMinor === null) return;

    save.mutate(
      { month, categoryId: Number(categoryId), amountMinor },
      {
        onSuccess: () => {
          setAmount('');
          setErrors({});
          setSavedNote('Budget saved.');
          amountInput.current?.focus();
          onSaved?.();
        },
        onError: (problem: Error) => {
          if (problem instanceof ApiProblem && (problem.status === 400 || problem.status === 404)) {
            const { fields, rest } = splitProblem(problem.errors);
            setErrors(fields);
            if (Object.keys(fields).length === 0) setFormError(rest[0] ?? problem.message);
          } else {
            setFormError('Could not save the budget right now. Try again.');
          }
        },
      },
    );
  }

  const categoryError = errors.category;
  const amountError = errors.amount;
  const categoryDescribed = categoryError ? 'budget-category-error' : undefined;
  const amountDescribed = ['budget-amount-hint', amountError ? 'budget-amount-error' : ''].filter(Boolean).join(' ');

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="grid grid-cols-1 gap-4 rounded-lg border bg-card p-4 text-card-foreground md:grid-cols-[1fr_1fr_auto] md:items-start"
      aria-label="Set a budget"
    >
      {formError ? (
        <p role="alert" tabIndex={-1} ref={alertRef} className={`${ERROR_CLASSES} md:col-span-3`}>
          <span aria-hidden="true">⚠ </span>
          {formError}
        </p>
      ) : null}
      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor="budget-category">Category</Label>
        <select
          id="budget-category"
          name="category"
          value={categoryId}
          onChange={(event) => onCategoryChange(event.target.value)}
          ref={categoryRef}
          aria-invalid={categoryError ? true : undefined}
          aria-describedby={categoryDescribed}
          className={SELECT_CLASSES}
        >
          <option value="">Choose a category</option>
          {categories.map((category) => (
            <option key={category.id} value={String(category.id)}>
              {category.name}
            </option>
          ))}
        </select>
        {categoryError ? (
          <p id="budget-category-error" className={ERROR_CLASSES}>
            <span aria-hidden="true">⚠ </span>
            {categoryError}
          </p>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor="budget-amount">Budget amount</Label>
        <Input
          id="budget-amount"
          name="amount"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          ref={amountInput}
          aria-invalid={amountError ? true : undefined}
          aria-describedby={amountDescribed}
        />
        <p id="budget-amount-hint" className="m-0 text-sm text-muted-foreground">
          For example 500.00. Saving again for the same category replaces the amount.
        </p>
        {amountError ? (
          <p id="budget-amount-error" className={ERROR_CLASSES}>
            <span aria-hidden="true">⚠ </span>
            {amountError}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-1.5 md:pt-[1.375rem]">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? 'Saving...' : 'Set budget'}
        </Button>
      </div>
      {savedNote ? (
        <p role="status" className="m-0 text-sm text-muted-foreground md:col-span-3">
          {savedNote}
        </p>
      ) : null}
    </form>
  );
}
