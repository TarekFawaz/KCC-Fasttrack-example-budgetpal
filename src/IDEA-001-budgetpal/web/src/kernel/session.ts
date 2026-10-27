import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

/** The one cache key of "who is signed in". `null` data means anonymous (HTTP 401 is not an error here). */
export const SESSION_KEY = ['auth', 'me'] as const;

const AUTH_BASE = '/api/auth';

export interface SessionUser {
  id: number;
  email: string;
}

export type SessionState =
  | { status: 'loading' }
  | { status: 'authenticated'; user: SessionUser }
  | { status: 'anonymous' }
  | { status: 'error'; error: Error; retry: () => void };

/** Reads the cookie session. 401 resolves to `null` (anonymous); any other failure throws. */
async function fetchSession(): Promise<SessionUser | null> {
  const response = await fetch(`${AUTH_BASE}/me`, {
    credentials: 'same-origin',
    headers: { accept: 'application/json' },
  });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error(`Session check failed with status ${response.status}.`);
  return (await response.json()) as SessionUser;
}

/** Makes the session anonymous and drops every other cached server answer, so nothing of the user is left. */
export function clearSession(client: QueryClient): void {
  client.removeQueries({ predicate: (query) => query.queryKey[0] !== SESSION_KEY[0] || query.queryKey[1] !== SESSION_KEY[1] });
  client.setQueryData(SESSION_KEY, null);
}

/** True when the cached session holds a signed-in user (not loading, not anonymous). */
export function isAuthenticated(client: QueryClient): boolean {
  const data = client.getQueryData<SessionUser | null>(SESSION_KEY);
  return data !== undefined && data !== null;
}

export function useSession(): SessionState {
  const query = useQuery({
    queryKey: SESSION_KEY,
    queryFn: fetchSession,
    retry: false,
    staleTime: 30_000,
  });
  if (query.isError) {
    return {
      status: 'error',
      error: query.error,
      retry: () => {
        void query.refetch();
      },
    };
  }
  if (query.data === undefined) return { status: 'loading' };
  if (query.data === null) return { status: 'anonymous' };
  return { status: 'authenticated', user: query.data };
}

async function postLogout(): Promise<void> {
  const response = await fetch(`${AUTH_BASE}/logout`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { accept: 'application/json' },
  });
  // 401 means the session was already gone: the user is signed out either way.
  if (!response.ok && response.status !== 401) {
    throw new Error(`Log out failed with status ${response.status}.`);
  }
}

/** Ends the session; on success or on 401 the session is anonymous and the other cached queries are gone. */
export function useSignOut() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: postLogout,
    onSuccess: () => clearSession(client),
  });
}
