import { vi } from 'vitest';

export type SessionKind = 'authenticated' | 'anonymous' | 'failing';

export const TEST_USER = { id: 1, email: 'ada@example.com' } as const;

export type FetchHandler = (url: string, init?: RequestInit) => Response | Promise<Response> | undefined;

/**
 * Stubs `fetch` so `GET /api/auth/me` answers 200 (authenticated), 401 (anonymous) or 500 (failing).
 * Every other call goes to `others`; one it does not answer fails with a 404 so a test never
 * silently reaches the network. Call `vi.unstubAllGlobals()` in `afterEach`.
 */
export function mockSession(kind: SessionKind, others?: FetchHandler) {
  const stub = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.pathname + input.search : input.url;
    if (url === '/api/auth/me') {
      if (kind === 'authenticated') {
        return new Response(JSON.stringify(TEST_USER), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      const status = kind === 'anonymous' ? 401 : 500;
      return new Response(JSON.stringify({ title: status === 401 ? 'Unauthorized' : 'Server error', status }), {
        status,
        headers: { 'content-type': 'application/problem+json' },
      });
    }
    const answered = await others?.(url, init);
    return (
      answered ??
      new Response(JSON.stringify({ title: 'Not mocked', status: 404 }), {
        status: 404,
        headers: { 'content-type': 'application/problem+json' },
      })
    );
  });
  vi.stubGlobal('fetch', stub);
  return stub;
}

/** Number of `GET /api/auth/me` calls the stub has seen. */
export function meCalls(stub: ReturnType<typeof mockSession>): number {
  return stub.mock.calls.filter(([input]) => (typeof input === 'string' ? input : '') === '/api/auth/me').length;
}
