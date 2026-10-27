import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement, type ReactNode } from 'react';
import { QueryClientProvider, useMutation, useQuery, type QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { meCalls, mockSession, TEST_USER } from '../test/session';
import { createAppQueryClient, queryClient } from './queryClient';
import { SESSION_KEY, useSession, useSignOut } from './session';

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client }, children);
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  queryClient.clear();
});

describe('useSession', () => {
  it('T-006 is loading first, then authenticated with {id, email} on 200', async () => {
    mockSession('authenticated');
    const { result } = renderHook(() => useSession(), { wrapper: wrapperFor(createAppQueryClient()) });
    expect(result.current).toEqual({ status: 'loading' });
    await waitFor(() => expect(result.current.status).toBe('authenticated'));
    expect(result.current).toEqual({ status: 'authenticated', user: TEST_USER });
  });

  it('T-006 is anonymous on 401 (not an error) and requests it exactly once', async () => {
    const stub = mockSession('anonymous');
    const { result } = renderHook(() => useSession(), { wrapper: wrapperFor(createAppQueryClient()) });
    await waitFor(() => expect(result.current.status).toBe('anonymous'));
    await new Promise((resolveWait) => setTimeout(resolveWait, 50));
    expect(meCalls(stub)).toBe(1);
  });

  it('T-006 is error on 500 and on a network failure, and retry asks again', async () => {
    const stub = mockSession('failing');
    const first = renderHook(() => useSession(), { wrapper: wrapperFor(createAppQueryClient()) });
    await waitFor(() => expect(first.result.current.status).toBe('error'));
    expect(meCalls(stub)).toBe(1);
    act(() => {
      const state = first.result.current;
      if (state.status === 'error') state.retry();
    });
    await waitFor(() => expect(meCalls(stub)).toBe(2));

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network down')));
    const second = renderHook(() => useSession(), { wrapper: wrapperFor(createAppQueryClient()) });
    await waitFor(() => expect(second.result.current.status).toBe('error'));
  });
});

describe('useSignOut', () => {
  for (const status of [204, 401]) {
    it(`T-007 POSTs /api/auth/logout; on ${status} the session is anonymous and other queries are gone`, async () => {
      const stub = mockSession('authenticated', (url, init) =>
        url === '/api/auth/logout' && init?.method === 'POST' ? new Response(null, { status }) : undefined,
      );
      const client = createAppQueryClient();
      client.setQueryData(['transactions', 'list'], [{ id: 1 }]);
      const { result } = renderHook(() => ({ session: useSession(), signOut: useSignOut() }), {
        wrapper: wrapperFor(client),
      });
      await waitFor(() => expect(result.current.session.status).toBe('authenticated'));
      await act(async () => {
        await result.current.signOut.mutateAsync();
      });
      expect(stub.mock.calls.some(([url, init]) => url === '/api/auth/logout' && init?.method === 'POST')).toBe(true);
      await waitFor(() => expect(result.current.session.status).toBe('anonymous'));
      expect(client.getQueryData(['transactions', 'list'])).toBeUndefined();
      expect(client.getQueryData(SESSION_KEY)).toBeNull();
    });
  }

  it('T-007 a server failure on logout is an error and keeps the session', async () => {
    mockSession('authenticated', (url) => (url === '/api/auth/logout' ? new Response('{}', { status: 500 }) : undefined));
    const client = createAppQueryClient();
    const { result } = renderHook(() => ({ session: useSession(), signOut: useSignOut() }), {
      wrapper: wrapperFor(client),
    });
    await waitFor(() => expect(result.current.session.status).toBe('authenticated'));
    await act(async () => {
      await expect(result.current.signOut.mutateAsync()).rejects.toThrow(/status 500/);
    });
    expect(result.current.session.status).toBe('authenticated');
  });
});

/** Stand-ins for the error classes of SPEC-002/007/008, recognised by shape: the kernel imports none of them. */
class ApiProblem extends Error {
  readonly status = 401;
}
class DashboardProblem extends Error {
  readonly status = 401;
}
const categoryShape = Object.assign(new Error('Unauthorized'), { status: 401, name: 'CategoryApiError' });

async function authenticatedSetup() {
  mockSession('authenticated');
  const client = createAppQueryClient();
  client.setQueryData(['accounts', 'list'], [{ id: 7 }]);
  const view = renderHook(
    ({ failWith }: { failWith: unknown }) => ({
      session: useSession(),
      data: useQuery({
        queryKey: ['dashboard', 'summary'],
        queryFn: async () => {
          throw failWith;
        },
        retry: false,
        enabled: false,
      }),
      change: useMutation({
        mutationFn: async () => {
          throw failWith;
        },
      }),
    }),
    { wrapper: wrapperFor(client), initialProps: { failWith: undefined as unknown } },
  );
  await waitFor(() => expect(view.result.current.session.status).toBe('authenticated'));
  return { client, view };
}

describe('the shared query client', () => {
  it('T-008 has retry 1, no focus refetch and both cache onError hooks', () => {
    const defaults = queryClient.getDefaultOptions().queries;
    expect(defaults?.retry).toBe(1);
    expect(defaults?.refetchOnWindowFocus).toBe(false);
    expect(queryClient.getQueryCache().config.onError).toBeTypeOf('function');
    expect(queryClient.getMutationCache().config.onError).toBeTypeOf('function');
  });

  for (const [name, error] of [
    ['ApiProblem', new ApiProblem('x')],
    ['DashboardProblem', new DashboardProblem('x')],
    ['CategoryApiError', categoryShape],
  ] as const) {
    it(`T-009 a 401 (${name} shape) from a query turns an authenticated session anonymous and clears other queries`, async () => {
      const { client, view } = await authenticatedSetup();
      view.rerender({ failWith: error });
      await act(async () => {
        await view.result.current.data.refetch();
      });
      await waitFor(() => expect(view.result.current.session.status).toBe('anonymous'));
      expect(client.getQueryData(['accounts', 'list'])).toBeUndefined();
    });

    it(`T-009 a 401 (${name} shape) from a mutation turns an authenticated session anonymous and clears other queries`, async () => {
      const { client, view } = await authenticatedSetup();
      view.rerender({ failWith: error });
      await act(async () => {
        await view.result.current.change.mutateAsync().catch(() => undefined);
      });
      await waitFor(() => expect(view.result.current.session.status).toBe('anonymous'));
      expect(client.getQueryData(['accounts', 'list'])).toBeUndefined();
    });
  }

  it('T-010 while already anonymous a 401 changes nothing', async () => {
    mockSession('anonymous');
    const client = createAppQueryClient();
    client.setQueryData(['kept'], 1);
    const view = renderHook(
      () => ({
        session: useSession(),
        change: useMutation({
          mutationFn: async () => {
            throw Object.assign(new Error('Wrong password'), { status: 401 });
          },
        }),
      }),
      { wrapper: wrapperFor(client) },
    );
    await waitFor(() => expect(view.result.current.session.status).toBe('anonymous'));
    await act(async () => {
      await view.result.current.change.mutateAsync().catch(() => undefined);
    });
    expect(view.result.current.session.status).toBe('anonymous');
    expect(client.getQueryData(['kept'])).toBe(1);
    await waitFor(() => expect(view.result.current.change.error).toBeInstanceOf(Error));
  });

  for (const status of [403, 500]) {
    it(`T-010 a ${status} leaves an authenticated session and cached data untouched`, async () => {
      const { client, view } = await authenticatedSetup();
      view.rerender({ failWith: Object.assign(new Error('nope'), { status }) });
      await act(async () => {
        await view.result.current.data.refetch();
        await view.result.current.change.mutateAsync().catch(() => undefined);
      });
      expect(view.result.current.session.status).toBe('authenticated');
      expect(client.getQueryData(['accounts', 'list'])).toEqual([{ id: 7 }]);
    });
  }

  it('T-011 main.tsx imports the shared client and creates none; the kernel holds one new QueryClient(', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const main = readFileSync(resolve(here, '..', 'main.tsx'), 'utf8');
    expect(main).toMatch(/from '\.\/kernel\/queryClient'/);
    expect(main).not.toMatch(/new\s+QueryClient\s*\(/);
    const kernelClient = readFileSync(resolve(here, 'queryClient.ts'), 'utf8');
    expect(kernelClient.match(/new\s+QueryClient\s*\(/g)).toHaveLength(1);
  });
});

describe('mockSession', () => {
  it('T-012 answers /api/auth/me with 200, 401 and 500 and 404s anything unmocked', async () => {
    mockSession('authenticated');
    expect((await fetch('/api/auth/me')).status).toBe(200);
    mockSession('anonymous');
    expect((await fetch('/api/auth/me')).status).toBe(401);
    mockSession('failing');
    expect((await fetch('/api/auth/me')).status).toBe(500);
    expect((await fetch('/api/other')).status).toBe(404);
    mockSession('anonymous', (url) => (url === '/api/other' ? new Response('{}', { status: 200 }) : undefined));
    expect((await fetch('/api/other')).status).toBe(200);
  });
});
