import { useQuery } from '@tanstack/react-query';

export interface Health {
  status: 'ok';
  db: 'ok';
}

export async function fetchHealth(): Promise<Health> {
  const response = await fetch('/api/health', { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`health request failed with status ${response.status}`);
  const body = (await response.json()) as Partial<Health>;
  if (body.status !== 'ok' || body.db !== 'ok') throw new Error('health response is not ok');
  return { status: 'ok', db: 'ok' };
}

/** Server state for the status dot; one attempt per page load (no retry delay for a status check). */
export function useHealth() {
  return useQuery({ queryKey: ['health'], queryFn: fetchHealth, retry: false });
}
