import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useHealth } from './useHealth';

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

afterEach(() => vi.unstubAllGlobals());

describe('useHealth', () => {
  it('T-031 goes from loading to success when /api/health answers ok', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'ok', db: 'ok' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useHealth(), { wrapper });
    expect(result.current.isPending).toBe(true);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/health');
    expect(result.current.data).toEqual({ status: 'ok', db: 'ok' });
  });

  it('T-031 fails on a 503 and on a body that is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 503 })));
    const first = renderHook(() => useHealth(), { wrapper });
    await waitFor(() => expect(first.result.current.isError).toBe(true));

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'bad', db: 'ok' }), { status: 200 })));
    const second = renderHook(() => useHealth(), { wrapper });
    await waitFor(() => expect(second.result.current.isError).toBe(true));
  });

  it('T-031 fails when the network call rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network down')));
    const { result } = renderHook(() => useHealth(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useHealth strictness', () => {
  it('T-031 makes one attempt on failure (no retry) and rejects a body whose db is not ok', async () => {
    const failing = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'ok', db: 'down' }), { status: 200 }));
    vi.stubGlobal('fetch', failing);
    const { result } = renderHook(() => useHealth(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(failing).toHaveBeenCalledTimes(1);
  });
});
