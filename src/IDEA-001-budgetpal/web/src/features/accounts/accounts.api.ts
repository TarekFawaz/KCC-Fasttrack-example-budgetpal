import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

/** The accounts routes of the api (SPEC-004 Story-001/002); same origin, the session cookie rides along. */
export const ACCOUNTS_URL = '/api/accounts';
export const ACCOUNTS_KEY = ['accounts'] as const;

export const ACCOUNT_TYPES = ['checking', 'savings', 'credit_card', 'cash', 'other'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  checking: 'Checking',
  savings: 'Savings',
  credit_card: 'Credit card',
  cash: 'Cash',
  other: 'Other',
};

export interface Account {
  id: number;
  name: string;
  type: AccountType;
  openingBalanceMinor: number;
  createdAt: number;
  updatedAt: number;
}

/** What the form sends: the balance is already integer minor units. */
export interface AccountInput {
  name: string;
  type: AccountType;
  openingBalanceMinor: number;
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

async function send(path: string, init: RequestInit): Promise<Response> {
  const response = await fetch(`${ACCOUNTS_URL}${path}`, {
    credentials: 'same-origin',
    ...init,
    headers: { accept: 'application/json, application/problem+json', ...init.headers },
  });
  if (!response.ok) throw await toProblem(response);
  return response;
}

export async function fetchAccounts(): Promise<Account[]> {
  return (await (await send('', { method: 'GET' })).json()) as Account[];
}

export async function createAccount(input: AccountInput): Promise<Account> {
  const response = await send('', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  return (await response.json()) as Account;
}

/** The signed-in user's accounts, ordered by name by the api. */
export function useAccounts() {
  return useQuery({ queryKey: ACCOUNTS_KEY, queryFn: fetchAccounts, retry: false });
}

/** Creates an account and refreshes the list. */
export function useCreateAccount() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: createAccount,
    onSuccess: () => client.invalidateQueries({ queryKey: ACCOUNTS_KEY }),
  });
}
