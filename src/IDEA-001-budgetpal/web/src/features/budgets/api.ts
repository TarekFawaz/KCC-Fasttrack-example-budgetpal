import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

/**
 * The budgets routes of the api (SPEC-007 Story-001, Story-002); same origin, the session cookie rides
 * along. The api registers them without the `/api` prefix, the proxy strips it (SPEC-001).
 */
export const BUDGETS_URL = '/api/budgets';
export const CATEGORIES_URL = '/api/categories';

/** Every budgets query key starts with this one, so a mutation can refresh them all at once. */
export const BUDGETS_KEY = ['budgets'] as const;
export const CATEGORY_OPTIONS_KEY = ['budgets', 'category-options'] as const;

export type BudgetStatus = 'ok' | 'warning' | 'over';

/** One budgeted category in a month; both amounts are integer minor units. */
export interface BudgetItem {
  categoryId: number;
  categoryName: string;
  budgetMinor: number;
  spentMinor: number;
  /** Display only; the status was decided on integers by the api. */
  percent: number;
  status: BudgetStatus;
}

/** An expense category with spending in the month and no budget. */
export interface UnbudgetedItem {
  categoryId: number;
  categoryName: string;
  spentMinor: number;
}

export interface MonthProgress {
  month: string;
  items: BudgetItem[];
  unbudgeted: UnbudgetedItem[];
}

/** The part of a category the form needs. */
export interface CategoryOption {
  id: number;
  name: string;
}

export interface FieldProblem {
  field: string;
  message: string;
}

/** A non-2xx answer, read from the RFC 9457 body when there is one. Carries no request data. */
export class ApiProblem extends Error {
  readonly status: number;
  readonly errors: FieldProblem[];

  constructor(status: number, detail: string, errors: FieldProblem[] = []) {
    super(detail);
    this.name = 'ApiProblem';
    this.status = status;
    this.errors = errors;
  }
}

async function toProblem(response: Response): Promise<ApiProblem> {
  let detail = `Request failed with status ${response.status}.`;
  let errors: FieldProblem[] = [];
  try {
    const body = (await response.json()) as { detail?: unknown; errors?: unknown };
    if (typeof body.detail === 'string') detail = body.detail;
    if (Array.isArray(body.errors)) {
      errors = body.errors.filter(
        (entry): entry is FieldProblem =>
          typeof entry === 'object' &&
          entry !== null &&
          typeof (entry as FieldProblem).field === 'string' &&
          typeof (entry as FieldProblem).message === 'string',
      );
    }
  } catch {
    // Not JSON (for example a proxy error page): the status-based detail above stands.
  }
  return new ApiProblem(response.status, detail, errors);
}

async function send(url: string, init: RequestInit = { method: 'GET' }): Promise<Response> {
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...init,
    headers: { accept: 'application/json, application/problem+json', ...init.headers },
  });
  if (!response.ok) throw await toProblem(response);
  return response;
}

/** `YYYY-MM` of today in the user's time zone; the month picker starts here. */
export function currentMonth(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** True for a `YYYY-MM` the api accepts (month 01-12). */
export function isMonth(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export async function fetchProgress(month: string): Promise<MonthProgress> {
  const response = await send(`${BUDGETS_URL}?${new URLSearchParams({ month }).toString()}`);
  return (await response.json()) as MonthProgress;
}

/** The user's expense categories (read through the categories list endpoint); income ones cannot be budgeted. */
export async function fetchExpenseCategories(): Promise<CategoryOption[]> {
  const rows = (await (await send(CATEGORIES_URL)).json()) as Array<CategoryOption & { kind?: string }>;
  return rows.filter((row) => row.kind === 'expense').map(({ id, name }) => ({ id, name }));
}

export interface SetBudgetInput {
  month: string;
  categoryId: number;
  /** Positive integer minor units (never a float). */
  amountMinor: number;
}

export async function putBudget({ month, categoryId, amountMinor }: SetBudgetInput): Promise<void> {
  await send(`${BUDGETS_URL}/${month}/${categoryId}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ amountMinor }),
  });
}

export async function deleteBudget(month: string, categoryId: number): Promise<void> {
  await send(`${BUDGETS_URL}/${month}/${categoryId}`, { method: 'DELETE' });
}

/** The signed-in user's budgets and spending for one month; waits for a valid `YYYY-MM`. */
export function useBudgets(month: string) {
  return useQuery({
    queryKey: [...BUDGETS_KEY, 'list', month],
    queryFn: () => fetchProgress(month),
    enabled: isMonth(month),
    retry: false,
  });
}

export function useExpenseCategories() {
  return useQuery({ queryKey: CATEGORY_OPTIONS_KEY, queryFn: fetchExpenseCategories, retry: false });
}

/** After any change the month lists are fetched again, so the page shows what the api stored. */
export function useSetBudget() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: putBudget,
    onSuccess: () => client.invalidateQueries({ queryKey: BUDGETS_KEY }),
  });
}

export function useRemoveBudget() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ month, categoryId }: { month: string; categoryId: number }) => deleteBudget(month, categoryId),
    onSuccess: () => client.invalidateQueries({ queryKey: BUDGETS_KEY }),
  });
}
