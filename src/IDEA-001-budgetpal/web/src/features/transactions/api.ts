import { useQuery } from '@tanstack/react-query';

/** The transactions routes of the api (SPEC-005 Story-001..003); same origin, the session cookie rides along. */
export const TRANSACTIONS_URL = '/api/transactions';
export const ACCOUNTS_URL = '/api/accounts';
export const CATEGORIES_URL = '/api/categories';

/** Every transactions query key starts with this one, so a mutation can refresh them all at once. */
export const TRANSACTIONS_KEY = ['transactions'] as const;
export const ACCOUNT_OPTIONS_KEY = ['transactions', 'account-options'] as const;
export const CATEGORY_OPTIONS_KEY = ['transactions', 'category-options'] as const;

export const PAGE_SIZE = 50;

export type CategoryKind = 'expense' | 'income';

/** One stored transaction; `amountMinor` is a positive integer, the direction comes from the category kind. */
export interface Transaction {
  id: number;
  accountId: number;
  categoryId: number;
  occurredOn: string;
  amountMinor: number;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionPage {
  items: Transaction[];
  total: number;
  limit: number;
  offset: number;
}

/** The part of an account the filter and the form need. */
export interface AccountOption {
  id: number;
  name: string;
}

/** The part of a category the filter and the form need. */
export interface CategoryOption {
  id: number;
  name: string;
  kind: CategoryKind;
}

export interface TransactionFilters {
  /** `YYYY-MM`, or empty for every month. */
  month: string;
  /** Account id as text, or empty for every account. */
  accountId: string;
  /** Category id as text, or empty for every category. */
  categoryId: string;
  limit: number;
  offset: number;
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

export async function send(url: string, init: RequestInit = { method: 'GET' }): Promise<Response> {
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...init,
    headers: { accept: 'application/json, application/problem+json', ...init.headers },
  });
  if (!response.ok) throw await toProblem(response);
  return response;
}

/** The query string of a list request; empty filters are left out so the api applies no filter. */
export function listQueryString(filters: TransactionFilters): string {
  const params = new URLSearchParams();
  if (filters.month) params.set('month', filters.month);
  if (filters.accountId) params.set('accountId', filters.accountId);
  if (filters.categoryId) params.set('categoryId', filters.categoryId);
  params.set('limit', String(filters.limit));
  params.set('offset', String(filters.offset));
  return params.toString();
}

export async function fetchTransactions(filters: TransactionFilters): Promise<TransactionPage> {
  const response = await send(`${TRANSACTIONS_URL}?${listQueryString(filters)}`);
  return (await response.json()) as TransactionPage;
}

export async function fetchAccountOptions(): Promise<AccountOption[]> {
  const rows = (await (await send(ACCOUNTS_URL)).json()) as AccountOption[];
  return rows.map(({ id, name }) => ({ id, name }));
}

export async function fetchCategoryOptions(): Promise<CategoryOption[]> {
  const rows = (await (await send(CATEGORIES_URL)).json()) as CategoryOption[];
  return rows.map(({ id, name, kind }) => ({ id, name, kind }));
}

/** One page of the signed-in user's transactions, newest first, for the given filters. */
export function useTransactions(filters: TransactionFilters) {
  return useQuery({
    queryKey: [...TRANSACTIONS_KEY, 'list', filters],
    queryFn: () => fetchTransactions(filters),
    retry: false,
  });
}

/** The user's accounts, for the filter select and the form (read through the accounts list endpoint). */
export function useAccountOptions() {
  return useQuery({ queryKey: ACCOUNT_OPTIONS_KEY, queryFn: fetchAccountOptions, retry: false });
}

/** The user's categories, for the filter select and the form (read through the categories list endpoint). */
export function useCategoryOptions() {
  return useQuery({ queryKey: CATEGORY_OPTIONS_KEY, queryFn: fetchCategoryOptions, retry: false });
}
