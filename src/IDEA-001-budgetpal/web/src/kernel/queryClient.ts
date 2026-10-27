import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { clearSession, isAuthenticated } from './session';

/** By shape, so `ApiProblem`, `DashboardProblem` and `CategoryApiError` all count and the kernel imports no feature (GR-006). */
function isUnauthorized(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { status?: unknown }).status === 401;
}

/**
 * The one TanStack Query client: all server state goes through it. A 401 from any query or
 * mutation while signed in ends the session (the guard then redirects to /login); while already
 * anonymous it changes nothing, so a wrong-password 401 stays a form error.
 */
export function createAppQueryClient(): QueryClient {
  const onError = (error: unknown): void => {
    if (isUnauthorized(error) && isAuthenticated(client)) clearSession(client);
  };
  const client: QueryClient = new QueryClient({
    queryCache: new QueryCache({ onError }),
    mutationCache: new MutationCache({ onError }),
    defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
  });
  return client;
}

export const queryClient = createAppQueryClient();
