import { useHealth } from './useHealth';

const STATES = {
  loading: { label: 'checking', icon: '…' },
  ok: { label: 'ok', icon: '✓' },
  unavailable: { label: 'unavailable', icon: '⚠' },
} as const;

/**
 * The API status dot for the shell footer. It is a status region with a text name
 * ("API status: checking | ok | unavailable"); the colour is never the only cue, because each
 * state also has its own icon (hidden from assistive tech, the name already says it).
 */
export function HealthDot() {
  const health = useHealth();
  const state = health.isSuccess ? 'ok' : health.isError ? 'unavailable' : 'loading';
  const { label, icon } = STATES[state];
  return (
    <span role="status" aria-label={`API status: ${label}`} className="health-dot" data-state={state}>
      <span aria-hidden="true" className="health-dot-icon">
        {icon}
      </span>
    </span>
  );
}
