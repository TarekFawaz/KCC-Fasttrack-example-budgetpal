import { useEffect, useMemo, useRef, useState, type ChangeEvent, type RefObject } from 'react';
import { Link } from 'react-router-dom';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  ApiProblem,
  DATE_FORMATS,
  MAX_FILE_MB,
  MAX_ROWS,
  useAccounts,
  useCategories,
  useCommit,
  usePreview,
  type CommitResponse,
  type DateFormat,
  type ImportParams,
  type InvalidRow,
  type PreviewResponse,
} from './importApi';

/** The one look of an inline error: text with an icon, never colour alone. */
const ERROR_CLASSES = 'm-0 text-sm font-semibold text-destructive';
const HINT_CLASSES = 'm-0 text-sm text-muted-foreground';
const EMPTY_CLASSES = 'm-0 rounded-md border border-dashed p-4 text-muted-foreground';
const CARD_CLASSES = 'flex flex-col gap-4 rounded-lg border bg-card p-4 text-card-foreground shadow-sm';
const FIELD_CLASSES = 'flex flex-col gap-1.5';
const ACTION_CLASSES = 'flex flex-wrap items-center gap-3';
const LINE_LIST_CLASSES = 'm-0 flex list-none flex-col gap-1 p-0 text-sm [overflow-wrap:anywhere]';

/** Native selects keep their role, label and keyboard behaviour; they are dressed like the kit Input. */
const SELECT_CLASSES =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive md:text-sm';

/** The steps of the wizard, in order. The current one carries aria-current="step"; none is a button. */
const STEPS = ['Choose a file', 'Map the columns', 'Preview and import', 'Result'] as const;

function Stepper({ current }: { current: number }) {
  return (
    <nav aria-label="Import steps">
      <ol className="m-0 flex list-none flex-wrap gap-2 p-0 text-sm">
        {STEPS.map((step, index) => {
          const state = index < current ? 'done' : index === current ? 'current' : 'todo';
          return (
            <li
              key={step}
              aria-current={state === 'current' ? 'step' : undefined}
              className={
                state === 'current'
                  ? 'rounded-full border border-primary bg-primary px-3 py-1 font-semibold text-primary-foreground'
                  : 'rounded-full border px-3 py-1 text-muted-foreground'
              }
            >
              <span aria-hidden="true">{state === 'done' ? '✓' : index + 1}. </span>
              {step}
              {state === 'done' ? <span className="sr-only"> (done)</span> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Invalid lines listed on screen; the rest are summarised so a 5000-line file stays readable. */
const INVALID_LINES_SHOWN = 200;

function installCurrency(): string {
  const configured = (import.meta.env.VITE_CURRENCY as string | undefined)?.trim().toUpperCase();
  return configured && /^[A-Z]{3}$/.test(configured) ? configured : 'USD';
}

/** Signed integer minor units shown through `Intl` from a decimal string; no float is involved (GR-007). */
export function formatMinor(minor: number, currency: string = installCurrency()): string {
  const digits =
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
  const padded = String(Math.abs(minor)).padStart(digits + 1, '0');
  const whole = padded.slice(0, padded.length - digits);
  const fraction = padded.slice(padded.length - digits);
  const decimal = `${minor < 0 ? '-' : ''}${whole}${digits > 0 ? `.${fraction}` : ''}`;
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(decimal as unknown as number);
}

interface FormMapping {
  date: string;
  amount: string;
  description: string;
}

const NO_MAPPING: FormMapping = { date: '', amount: '', description: '' };

interface Messages {
  fields: Record<string, string>;
  general: string | null;
}

/** Field-level messages from a 400/404 problem, plus one general line. Always rendered as text. */
function messagesOf(problem: Error | null): Messages {
  if (problem === null) return { fields: {}, general: null };
  if (!(problem instanceof ApiProblem)) return { fields: {}, general: 'Something went wrong. Try again.' };
  const fields: Record<string, string> = {};
  for (const entry of problem.errors) fields[entry.field] ??= entry.message;
  if (fields['mapping'] !== undefined) fields['mapping.date'] ??= fields['mapping'];
  if (problem.status === 404) fields['accountId'] ??= 'That account was not found. Choose another account.';
  if (problem.status === 401) return { fields, general: 'Your session has ended. Log in again.' };
  if (problem.status >= 500) return { fields, general: 'The server could not read the file. Try again.' };
  const hasField = Object.keys(fields).length > 0;
  return { fields, general: hasField ? null : problem.message };
}

interface SelectFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder: string;
  error?: string | undefined;
}

function SelectField({ id, label, value, onChange, options, placeholder, error }: SelectFieldProps) {
  const errorId = `${id}-error`;
  return (
    <div className={FIELD_CLASSES}>
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        className={SELECT_CLASSES}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? (
        <p id={errorId} className={ERROR_CLASSES}>
          <span aria-hidden="true">⚠ </span>
          {error}
        </p>
      ) : null}
    </div>
  );
}

function InvalidLines({ rows, title }: { rows: InvalidRow[]; title: string }) {
  if (rows.length === 0) return null;
  const shown = rows.slice(0, INVALID_LINES_SHOWN);
  return (
    <div className="flex flex-col gap-2">
      <h3 className="m-0 text-base font-semibold">{title}</h3>
      <ul className={LINE_LIST_CLASSES}>
        {shown.map((row) => (
          <li key={row.line}>
            Line {row.line}: {row.reason}
          </li>
        ))}
      </ul>
      {rows.length > shown.length ? <p>…and {rows.length - shown.length} more invalid lines.</p> : null}
    </div>
  );
}

function PreviewTable({ preview }: { preview: PreviewResponse }) {
  if (preview.validRows.length === 0) return null;
  return (
    <div className="rounded-md border">
      <Table>
        <TableCaption className="mb-2 mt-2 text-muted-foreground">First {preview.validRows.length} valid rows</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">Line</TableHead>
            <TableHead scope="col">Date</TableHead>
            <TableHead scope="col">Description</TableHead>
            <TableHead scope="col" className="text-right">
              Amount
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {preview.validRows.map((row) => (
            <TableRow key={row.line}>
              <TableCell>{row.line}</TableCell>
              <TableCell className="whitespace-nowrap">{row.date}</TableCell>
              <TableCell className="[overflow-wrap:anywhere]">{row.description}</TableCell>
              <TableCell className="whitespace-nowrap text-right tabular-nums">
                <span aria-hidden="true">{row.amountMinor < 0 ? '↓ ' : '↑ '}</span>
                {formatMinor(row.amountMinor)}
                <span className="sr-only">{row.amountMinor < 0 ? ' (expense)' : ' (income)'}</span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ResultView({
  result,
  onAnother,
  headingRef,
}: {
  result: CommitResponse;
  onAnother: () => void;
  headingRef: RefObject<HTMLHeadingElement>;
}) {
  return (
    <section aria-labelledby="import-result-title" className={CARD_CLASSES}>
      <h2
        id="import-result-title"
        ref={headingRef}
        tabIndex={-1}
        className="m-0 text-lg font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
      >
        Import result
      </h2>
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        <li>
          <span aria-hidden="true">✓ </span>Imported: {result.imported}
        </li>
        <li>
          <span aria-hidden="true">↷ </span>Skipped (duplicates): {result.skipped}
        </li>
        <li>
          <span aria-hidden="true">⚠ </span>Invalid: {result.invalid}
        </li>
      </ul>
      <InvalidLines rows={result.invalidRows} title="Invalid lines" />
      <div className={ACTION_CLASSES}>
        <Link className={buttonVariants()} to="/transactions">
          View transactions
        </Link>
        <Button type="button" variant="outline" onClick={onAnother}>
          Import another file
        </Button>
      </div>
    </section>
  );
}

/**
 * Import wizard: choose a CSV, map its columns, preview the rows, then import. The file stays in browser
 * memory and goes to the api as multipart; cell text is only ever rendered as React text (GR-013).
 */
export function ImportPage() {
  const accounts = useAccounts();
  const categories = useCategories();
  const commit = useCommit();

  const [file, setFile] = useState<File | null>(null);
  const [version, setVersion] = useState(0);
  const [inputKey, setInputKey] = useState(0);
  const [accountId, setAccountId] = useState('');
  const [mapping, setMapping] = useState<FormMapping>(NO_MAPPING);
  const [dateFormat, setDateFormat] = useState<DateFormat>('YYYY-MM-DD');
  const [expenseId, setExpenseId] = useState('');
  const [incomeId, setIncomeId] = useState('');
  const [shown, setShown] = useState<PreviewResponse | null>(null);
  const [result, setResult] = useState<CommitResponse | null>(null);

  const previewHeading = useRef<HTMLHeadingElement | null>(null);
  const resultHeading = useRef<HTMLHeadingElement | null>(null);
  const suggestionApplied = useRef(-1);
  const previewFocused = useRef(-1);
  const categoriesDefaulted = useRef(false);

  const accountList = accounts.data ?? [];
  const categoryList = categories.data ?? [];

  // Defaults: the first account, and the first expense and income category.
  useEffect(() => {
    if (accountId === '' && accountList.length > 0) setAccountId(String(accountList[0]?.id));
  }, [accountId, accountList]);
  useEffect(() => {
    if (categoriesDefaulted.current || categoryList.length === 0) return;
    categoriesDefaulted.current = true;
    const firstExpense = categoryList.find((category) => category.kind === 'expense');
    const firstIncome = categoryList.find((category) => category.kind === 'income');
    if (firstExpense) setExpenseId(String(firstExpense.id));
    if (firstIncome) setIncomeId(String(firstIncome.id));
  }, [categoryList]);

  const mappingComplete = mapping.date !== '' && mapping.amount !== '' && mapping.description !== '';
  const ready = file !== null && accountId !== '' && !categories.isPending;

  const params = useMemo<ImportParams | null>(() => {
    if (!ready || file === null) return null;
    return {
      file,
      accountId: Number(accountId),
      ...(mappingComplete
        ? {
            mapping: {
              date: Number(mapping.date),
              amount: Number(mapping.amount),
              description: Number(mapping.description),
            },
            dateFormat,
          }
        : {}),
      ...(expenseId !== '' ? { expenseCategoryId: Number(expenseId) } : {}),
      ...(incomeId !== '' ? { incomeCategoryId: Number(incomeId) } : {}),
    };
  }, [ready, file, accountId, mappingComplete, mapping, dateFormat, expenseId, incomeId]);

  const preview = usePreview(params, version);

  // Keep the last good answer for this file so the controls stay put while a new preview loads or fails.
  useEffect(() => {
    if (preview.data && !preview.isPlaceholderData) setShown(preview.data);
  }, [preview.data, preview.isPlaceholderData]);

  // The first answer for a file pre-fills the mapping from the suggestion.
  useEffect(() => {
    if (!shown || suggestionApplied.current === version) return;
    suggestionApplied.current = version;
    if (shown.suggestedMapping) {
      setMapping({
        date: String(shown.suggestedMapping.date),
        amount: String(shown.suggestedMapping.amount),
        description: String(shown.suggestedMapping.description),
      });
    }
  }, [shown, version]);

  // Focus follows the step: the preview heading when a file's first answer arrives, then the result heading.
  useEffect(() => {
    if (shown && previewFocused.current !== version) {
      previewFocused.current = version;
      previewHeading.current?.focus();
    }
  }, [shown, version]);
  useEffect(() => {
    if (result) resultHeading.current?.focus();
  }, [result]);

  const touch = () => commit.reset();

  const onFile = (event: ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files?.[0] ?? null;
    touch();
    setVersion((current) => current + 1);
    setFile(chosen);
    setShown(null);
    setResult(null);
    setMapping(NO_MAPPING);
    setDateFormat('YYYY-MM-DD');
  };

  const startOver = () => {
    touch();
    setFile(null);
    setShown(null);
    setResult(null);
    setMapping(NO_MAPPING);
    setVersion((current) => current + 1);
    setInputKey((current) => current + 1);
  };

  const problem = messagesOf(commit.error ?? preview.error);
  const previewFailed = preview.isError;
  const loading = file !== null && (preview.isFetching || accounts.isPending || categories.isPending);
  const canImport =
    shown !== null &&
    !previewFailed &&
    !preview.isFetching &&
    mappingComplete &&
    shown.validCount > 0 &&
    !commit.isPending &&
    params !== null;

  const columnOptions = (shown?.headers ?? []).map((header, index) => ({
    value: String(index),
    label: header.trim() === '' ? `Column ${index + 1}` : header,
  }));
  const noAccounts = accounts.isSuccess && accountList.length === 0;

  const step = result ? 3 : shown && mappingComplete ? 2 : shown ? 1 : 0;

  const doCommit = () => {
    if (!canImport || params === null) return;
    commit.mutate(params, { onSuccess: (outcome) => setResult(outcome) });
  };

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6" aria-labelledby="import-title">
      <h1 id="import-title" className="text-2xl font-semibold tracking-tight">
        Import transactions
      </h1>
      <Stepper current={step} />

      {result ? (
        <ResultView result={result} onAnother={startOver} headingRef={resultHeading} />
      ) : (
        <>
          <section aria-labelledby="import-upload-title" className={CARD_CLASSES}>
            <h2 id="import-upload-title" className="m-0 text-lg font-semibold tracking-tight">
              Choose a CSV file
            </h2>
            <p id="import-limits" className={HINT_CLASSES}>
              Up to {MAX_FILE_MB} MB and {MAX_ROWS} rows. The file must be UTF-8 text with commas between columns.
              Nothing is saved until you choose Import.
            </p>
            {noAccounts ? (
              <p role="status" className={EMPTY_CLASSES}>
                You have no account yet. <Link to="/accounts">Create an account</Link> first.
              </p>
            ) : null}
            <div className={FIELD_CLASSES}>
              <Label htmlFor="import-file">CSV file</Label>
              <Input
                key={inputKey}
                id="import-file"
                type="file"
                accept=".csv,text/csv"
                onChange={onFile}
                disabled={noAccounts}
                aria-describedby={problem.fields['file'] ? 'import-limits import-file-error' : 'import-limits'}
                aria-invalid={problem.fields['file'] ? true : undefined}
              />
              {problem.fields['file'] ? (
                <p id="import-file-error" className={ERROR_CLASSES}>
                  <span aria-hidden="true">⚠ </span>
                  {problem.fields['file']}
                </p>
              ) : null}
            </div>
            {loading && !shown ? (
              <p role="status" className={HINT_CLASSES}>
                Reading the file…
              </p>
            ) : null}
            {problem.general ? (
              <p role="alert" className={ERROR_CLASSES}>
                <span aria-hidden="true">⚠ </span>
                {problem.general}
              </p>
            ) : null}
          </section>

          {shown ? (
            <>
              <section aria-labelledby="import-map-title" className={CARD_CLASSES}>
                <h2 id="import-map-title" className="m-0 text-lg font-semibold tracking-tight">
                  Map the columns
                </h2>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <SelectField
                    id="import-col-date"
                    label="Date column"
                    value={mapping.date}
                    onChange={(value) => {
                      touch();
                      setMapping((current) => ({ ...current, date: value }));
                    }}
                    options={columnOptions}
                    placeholder="Choose a column"
                    error={problem.fields['mapping.date']}
                  />
                  <SelectField
                    id="import-col-amount"
                    label="Amount column"
                    value={mapping.amount}
                    onChange={(value) => {
                      touch();
                      setMapping((current) => ({ ...current, amount: value }));
                    }}
                    options={columnOptions}
                    placeholder="Choose a column"
                    error={problem.fields['mapping.amount']}
                  />
                  <SelectField
                    id="import-col-description"
                    label="Description column"
                    value={mapping.description}
                    onChange={(value) => {
                      touch();
                      setMapping((current) => ({ ...current, description: value }));
                    }}
                    options={columnOptions}
                    placeholder="Choose a column"
                    error={problem.fields['mapping.description']}
                  />
                  <div className={FIELD_CLASSES}>
                    <Label htmlFor="import-date-format">Date format</Label>
                    <select
                      id="import-date-format"
                      className={SELECT_CLASSES}
                      value={dateFormat}
                      onChange={(event) => {
                        touch();
                        setDateFormat(event.target.value as DateFormat);
                      }}
                      aria-invalid={problem.fields['dateFormat'] ? true : undefined}
                      aria-describedby={problem.fields['dateFormat'] ? 'import-date-format-error' : undefined}
                    >
                      {DATE_FORMATS.map((format) => (
                        <option key={format} value={format}>
                          {format}
                        </option>
                      ))}
                    </select>
                    {problem.fields['dateFormat'] ? (
                      <p id="import-date-format-error" className={ERROR_CLASSES}>
                        <span aria-hidden="true">⚠ </span>
                        {problem.fields['dateFormat']}
                      </p>
                    ) : null}
                  </div>
                  <SelectField
                    id="import-account"
                    label="Account"
                    value={accountId}
                    onChange={(value) => {
                      touch();
                      setAccountId(value);
                    }}
                    options={accountList.map((account) => ({ value: String(account.id), label: account.name }))}
                    placeholder="Choose an account"
                    error={problem.fields['accountId']}
                  />
                  <SelectField
                    id="import-expense-category"
                    label="Category for expenses (negative amounts)"
                    value={expenseId}
                    onChange={(value) => {
                      touch();
                      setExpenseId(value);
                    }}
                    options={categoryList
                      .filter((category) => category.kind === 'expense')
                      .map((category) => ({ value: String(category.id), label: category.name }))}
                    placeholder="None"
                    error={problem.fields['expenseCategoryId']}
                  />
                  <SelectField
                    id="import-income-category"
                    label="Category for income (positive amounts)"
                    value={incomeId}
                    onChange={(value) => {
                      touch();
                      setIncomeId(value);
                    }}
                    options={categoryList
                      .filter((category) => category.kind === 'income')
                      .map((category) => ({ value: String(category.id), label: category.name }))}
                    placeholder="None"
                    error={problem.fields['incomeCategoryId']}
                  />
                </div>
              </section>

              <section aria-labelledby="import-preview-title" className={CARD_CLASSES}>
                <h2
                  id="import-preview-title"
                  ref={previewHeading}
                  tabIndex={-1}
                  className="m-0 text-lg font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
                >
                  Preview
                </h2>
                {!mappingComplete ? (
                  <p className={HINT_CLASSES}>Choose the date, amount and description columns to see a preview.</p>
                ) : previewFailed ? (
                  <p className={HINT_CLASSES}>Fix the highlighted fields to see a preview.</p>
                ) : (
                  <>
                    <p role="status">
                      {shown.validCount} valid and {shown.invalidCount} invalid of {shown.rowCount} rows.
                    </p>
                    <PreviewTable preview={shown} />
                    <InvalidLines rows={shown.invalidRows} title="Invalid rows" />
                  </>
                )}
                <div className={ACTION_CLASSES}>
                  <Button type="button" disabled={!canImport} onClick={doCommit}>
                    Import
                  </Button>
                  {commit.isPending ? (
                    <span role="status" className={HINT_CLASSES}>
                      Importing…
                    </span>
                  ) : null}
                </div>
              </section>
            </>
          ) : null}
        </>
      )}
    </section>
  );
}
