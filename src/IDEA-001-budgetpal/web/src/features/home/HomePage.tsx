import { useHealth } from './useHealth';

/** Status is never colour-only: each state has an icon and text, announced in a status region. */
export function HomePage() {
  const health = useHealth();
  let icon: string | null = null;
  let text = 'Checking...';
  let state = 'loading';
  if (health.isSuccess) {
    icon = '✓';
    text = 'API: ok';
    state = 'ok';
  } else if (health.isError) {
    icon = '⚠';
    text = 'API: unavailable';
    state = 'error';
  }
  return (
    <section>
      <h1>BudgetPal</h1>
      <p role="status" data-state={state}>
        {icon ? (
          <span aria-hidden="true" className="status-icon">
            {icon}{' '}
          </span>
        ) : null}
        <span>{text}</span>
      </p>
    </section>
  );
}
