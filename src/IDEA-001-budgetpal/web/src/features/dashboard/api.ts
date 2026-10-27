import { useQuery } from '@tanstack/react-query';

/** The dashboard routes of the api (SPEC-008); same origin, the session cookie rides along. */
export const SPENDING_URL = '/api/dashboard/spending';

export const DASHBOARD_KEY = ['dashboard'] as const;

export interface SpendingCategory {
  categoryId: number;
  name: string;
  amountMinor: number;
}

export interface Spending {
  month: string;
  currency: string;
  totalMinor: number;
  categories: SpendingCategory[];
}

/** A non-2xx answer, read from the RFC 9457 body when there is one. Carries no request data. */
export class DashboardProblem extends Error {
  readonly status: number;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = 'DashboardProblem';
    this.status = status;
  }
}

async function toProblem(response: Response): Promise<DashboardProblem> {
  let detail = `Request failed with status ${response.status}.`;
  try {
    const body = (await response.json()) as { detail?: unknown };
    if (typeof body.detail === 'string') detail = body.detail;
  } catch {
    // Not JSON (for example a proxy error page): the status-based detail above stands.
  }
  return new DashboardProblem(response.status, detail);
}

export async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    credentials: 'same-origin',
    headers: { accept: 'application/json, application/problem+json' },
  });
  if (!response.ok) throw await toProblem(response);
  return (await response.json()) as T;
}

export function spendingUrl(month: string): string {
  return `${SPENDING_URL}?${new URLSearchParams({ month }).toString()}`;
}

/** The signed-in user's expense total per category for one `YYYY-MM` month. */
export function useSpending(month: string, enabled = true) {
  return useQuery({
    queryKey: [...DASHBOARD_KEY, 'spending', month],
    queryFn: () => getJson<Spending>(spendingUrl(month)),
    enabled,
    retry: false,
  });
}
