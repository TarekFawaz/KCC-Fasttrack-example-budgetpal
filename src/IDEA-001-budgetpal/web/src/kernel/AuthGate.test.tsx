import { QueryClientProvider, useQuery, type QueryClient } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import axe from 'axe-core';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { meCalls, mockSession, TEST_USER, type FetchHandler } from '../test/session';
import { AuthGate } from './AuthGate';
import { createAppQueryClient } from './queryClient';
import { buildRegistry } from './registry';
import { SESSION_KEY } from './session';

const routerFuture = { v7_startTransition: true, v7_relativeSplatPath: true } as const;

function LoginPage() {
  return <h1>Login page</h1>;
}
function SignUpPage() {
  return <h1>Sign up page</h1>;
}
function LogOutPage() {
  return <h1>Logging out page</h1>;
}
function Dashboard() {
  return <h1>Dashboard page</h1>;
}

/** A protected page whose data call can return 401, like the real feature pages do (an error object with `status`). */
function Budgets() {
  const data = useQuery({
    queryKey: ['budgets', 'data'],
    retry: false,
    queryFn: async () => {
      const response = await fetch('/api/budgets');
      if (!response.ok) throw Object.assign(new Error('Budgets failed'), { status: response.status });
      return (await response.json()) as { secret: string };
    },
  });
  return (
    <section>
      <h1>Budgets page</h1>
      {data.data ? <p>{data.data.secret}</p> : null}
      {data.isError ? <p>budget load failed</p> : null}
      <button type="button" onClick={() => void data.refetch()}>
        Reload budgets
      </button>
    </section>
  );
}

const registry = buildRegistry({
  '../features/auth/feature.ts': {
    features: [
      { id: 'auth-login', path: '/login', label: 'Log in', order: 90, component: LoginPage, public: true },
      { id: 'auth-signup', path: '/signup', label: 'Sign up', order: 91, component: SignUpPage, public: true },
      { id: 'auth-logout', path: '/logout', label: 'Log out', order: 99, component: LogOutPage, public: true },
    ],
  },
  '../features/dashboard/feature.ts': {
    default: { id: 'dashboard', path: '/', label: 'Dashboard', order: 0, component: Dashboard },
  },
  '../features/budgets/feature.ts': {
    default: { id: 'budgets', path: '/budgets', label: 'Budgets', order: 20, component: Budgets },
  },
});

/** Shows where the router is, and what `from` it carries, so redirects can be asserted. */
function LocationProbe() {
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string; search: string } } | null)?.from;
  return (
    <p data-testid="location">
      {location.pathname}
      {location.search}|{from ? `${from.pathname}${from.search}` : 'no-from'}
    </p>
  );
}

function renderGate(path: string, client: QueryClient = createAppQueryClient()) {
  const view = render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]} future={routerFuture}>
        <AuthGate features={registry} />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { client, ...view };
}

const locationText = () => screen.getByTestId('location').textContent;

async function blocking(container: HTMLElement) {
  const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
  return results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.help}`);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AuthGate states', () => {
  it('T-013 shows only a neutral loading status while the session is pending, with no redirect', async () => {
    let release: (response: Response) => void = () => undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>((resolve) => (release = resolve))),
    );
    renderGate('/budgets?month=2026-10');
    expect(screen.getByRole('status')).toHaveTextContent('Loading...');
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(locationText()).toBe('/budgets?month=2026-10|no-from');
    release(new Response(null, { status: 401 }));
    await waitFor(() => expect(locationText()).toBe('/login|/budgets?month=2026-10'));
  });

  it('T-014 shows an alert with Retry on a non-401 failure, no nav, no redirect; Retry asks again', async () => {
    const stub = mockSession('failing');
    renderGate('/budgets');
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(locationText()).toBe('/budgets|no-from');
    expect(meCalls(stub)).toBe(1);
    fireEvent.click(within(alert).getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(meCalls(stub)).toBe(2));
    expect(locationText()).toBe('/budgets|no-from');
  });

  it('T-014 also treats a network failure as the error state', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network down')));
    renderGate('/');
    expect(await screen.findByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(locationText()).toBe('/|no-from');
  });

  it('T-020 has no serious or critical axe violation in the loading and error states', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => undefined)),
    );
    const loading = renderGate('/');
    expect(await blocking(loading.container)).toEqual([]);
    loading.unmount();

    mockSession('failing');
    const failed = renderGate('/');
    await screen.findByRole('alert');
    expect(await blocking(failed.container)).toEqual([]);
  });
});

describe('AuthGate anonymous visitor', () => {
  it('T-015 renders /login and /signup bare, without header, nav or footer', async () => {
    mockSession('anonymous');
    const login = renderGate('/login');
    expect(await screen.findByRole('heading', { name: 'Login page' })).toBeInTheDocument();
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
    expect(locationText()).toBe('/login|no-from');
    login.unmount();

    renderGate('/signup');
    expect(await screen.findByRole('heading', { name: 'Sign up page' })).toBeInTheDocument();
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
    expect(locationText()).toBe('/signup|no-from');
  });

  it('T-015 redirects every other URL (also an unknown one and /logout) to /login keeping path and query as from', async () => {
    mockSession('anonymous');
    const budgets = renderGate('/budgets?month=2026-10');
    await waitFor(() => expect(locationText()).toBe('/login|/budgets?month=2026-10'));
    expect(screen.getByRole('heading', { name: 'Login page' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    budgets.unmount();

    const unknown = renderGate('/no/such/page');
    await waitFor(() => expect(locationText()).toBe('/login|/no/such/page'));
    unknown.unmount();

    renderGate('/logout');
    await waitFor(() => expect(locationText()).toBe('/login|/logout'));
  });
});

describe('AuthGate signed-in user', () => {
  it('T-016 redirects /login and /signup to / but still renders /logout', async () => {
    mockSession('authenticated');
    const login = renderGate('/login');
    await waitFor(() => expect(locationText()).toBe('/|no-from'));
    expect(screen.getByRole('heading', { name: 'Dashboard page' })).toBeInTheDocument();
    login.unmount();

    const signup = renderGate('/signup');
    await waitFor(() => expect(locationText()).toBe('/|no-from'));
    signup.unmount();

    renderGate('/logout');
    expect(await screen.findByRole('heading', { name: 'Logging out page' })).toBeInTheDocument();
    expect(locationText()).toBe('/logout|no-from');
  });

  it('SPEC-010 T-041 shows the banner, the nav of non-public features in registry order, the routes and no separate log-out control', async () => {
    mockSession('authenticated');
    renderGate('/budgets');
    const nav = await screen.findByRole('navigation', { name: 'Main' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual(['Dashboard', 'Budgets']);
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/', '/budgets']);
    expect(within(nav).queryByText(/log in|sign up|log out/i)).not.toBeInTheDocument();
    // The SPEC-009 log-out button is gone: Log out only exists inside the user menu, which starts closed.
    expect(screen.queryByRole('button', { name: 'Log out' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Log out' })).not.toBeInTheDocument();
    expect(within(screen.getByRole('banner')).getByRole('button', { name: TEST_USER.email })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Budgets page' })).toBeInTheDocument();
  });

  it('T-017 shows "Page not found" inside the shell for an unknown URL', async () => {
    mockSession('authenticated');
    renderGate('/dashboard');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
  });

  async function openUserMenu() {
    const trigger = await screen.findByRole('button', { name: TEST_USER.email });
    fireEvent.keyDown(trigger, { key: 'Enter' });
    return screen.findByRole('menu');
  }

  it('SPEC-010 T-040 the user menu button is named by the email and the menu shows the email and Log out', async () => {
    mockSession('authenticated');
    renderGate('/budgets');
    const menu = await openUserMenu();
    expect(within(menu).getByText(TEST_USER.email)).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: 'Log out' })).toBeInTheDocument();
  });

  it('SPEC-010 T-040 Escape closes the menu and the arrow keys move between items', async () => {
    mockSession('authenticated');
    renderGate('/budgets');
    const menu = await openUserMenu();
    const item = within(menu).getByRole('menuitem', { name: 'Log out' });
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    await waitFor(() => expect(item).toHaveFocus());
    fireEvent.keyDown(menu, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: TEST_USER.email })).toBeInTheDocument();
  });

  it('SPEC-010 T-040 Enter on Log out ends the session and lands on /login without a remembered target', async () => {
    const stub = mockSession('authenticated', (url, init) =>
      url === '/api/auth/logout' && init?.method === 'POST' ? new Response(null, { status: 204 }) : undefined,
    );
    const { client } = renderGate('/budgets');
    const menu = await openUserMenu();
    const item = within(menu).getByRole('menuitem', { name: 'Log out' });
    item.focus();
    fireEvent.keyDown(item, { key: 'Enter' });
    await waitFor(() => expect(locationText()).toBe('/login|no-from'));
    expect(screen.getByRole('heading', { name: 'Login page' })).toBeInTheDocument();
    expect(client.getQueryData(SESSION_KEY)).toBeNull();
    expect(stub.mock.calls.some(([url, init]) => url === '/api/auth/logout' && init?.method === 'POST')).toBe(true);
  });

  it('SPEC-010 T-040 a failed log-out keeps the user signed in and says so', async () => {
    mockSession('authenticated', (url) => (url === '/api/auth/logout' ? new Response(null, { status: 500 }) : undefined));
    const { client } = renderGate('/budgets');
    const menu = await openUserMenu();
    const item = within(menu).getByRole('menuitem', { name: 'Log out' });
    item.focus();
    fireEvent.keyDown(item, { key: 'Enter' });
    expect(await screen.findByRole('alert')).toHaveTextContent('Log out failed');
    expect(client.getQueryData(SESSION_KEY)).toEqual(TEST_USER);
    expect(locationText()).toBe('/budgets|no-from');
  });

  it('SPEC-010 T-041 the API status dot sits in the sidebar footer, not in the top bar', async () => {
    mockSession('authenticated', (url) => (url === '/api/health' ? new Response('{}', { status: 200 }) : undefined));
    renderGate('/');
    const dot = await screen.findByRole('status', { name: /API status/ });
    expect(dot.closest('[data-sidebar="footer"]')).not.toBeNull();
    expect(within(screen.getByRole('banner')).queryByRole('status')).not.toBeInTheDocument();
  });

  it('SPEC-010 T-041 the guard states render no sidebar, banner or user menu', async () => {
    mockSession('failing');
    renderGate('/');
    await screen.findByRole('alert');
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: TEST_USER.email })).not.toBeInTheDocument();
    expect(document.querySelector('[data-sidebar]')).toBeNull();
  });
});

describe('AuthGate with the API as the authority', () => {
  const dataHandler =
    (state: { status: number }): FetchHandler =>
    (url) =>
      url === '/api/budgets'
        ? state.status === 200
          ? new Response(JSON.stringify({ secret: 'user one secret' }), { status: 200, headers: { 'content-type': 'application/json' } })
          : new Response(JSON.stringify({ status: state.status }), { status: state.status })
        : undefined;

  it('T-018 a 401 on a protected page makes the session anonymous, drops cached data and lands on /login with from', async () => {
    const answer = { status: 200 };
    mockSession('authenticated', dataHandler(answer));
    const { client } = renderGate('/budgets?month=2026-10');
    expect(await screen.findByText('user one secret')).toBeInTheDocument();
    expect(client.getQueryData(['budgets', 'data'])).toBeDefined();

    answer.status = 401;
    fireEvent.click(screen.getByRole('button', { name: 'Reload budgets' }));

    await waitFor(() => expect(locationText()).toBe('/login|/budgets?month=2026-10'));
    expect(screen.getByRole('heading', { name: 'Login page' })).toBeInTheDocument();
    expect(screen.queryByText('user one secret')).not.toBeInTheDocument();
    expect(client.getQueryData(['budgets', 'data'])).toBeUndefined();
    expect(client.getQueryData(SESSION_KEY)).toBeNull();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('T-019 a protected page rendered with the guard bypassed still gets 401 from its data call, and that ends the session', async () => {
    mockSession('anonymous', dataHandler({ status: 401 }));
    const client = createAppQueryClient();
    // A stale tab: the cache still believes the user is signed in while the API says otherwise.
    client.setQueryData(SESSION_KEY, TEST_USER);
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter future={routerFuture}>
          <Budgets />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('budget load failed')).toBeInTheDocument();
    expect(screen.queryByText('user one secret')).not.toBeInTheDocument();
    await waitFor(() => expect(client.getQueryData(SESSION_KEY)).toBeNull());
  });

  it('T-019 a 403 from a protected page keeps the session', async () => {
    mockSession('authenticated', dataHandler({ status: 403 }));
    const { client } = renderGate('/budgets');
    expect(await screen.findByText('budget load failed')).toBeInTheDocument();
    expect(client.getQueryData(SESSION_KEY)).toEqual(TEST_USER);
    expect(locationText()).toBe('/budgets|no-from');
  });
});
