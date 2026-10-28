import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import axe from 'axe-core';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthGate, safeTarget } from '../../kernel/AuthGate';
import { createAppQueryClient } from '../../kernel/queryClient';
import { buildRegistry, features, isPublic, type Feature } from '../../kernel/registry';
import { SESSION_KEY } from '../../kernel/session';
import { mockSession, TEST_USER } from '../../test/session';
import { LOGIN_FAILED_MESSAGE, LoginPage, LogOutPage } from './LoginPage';
import { SignUpPage } from './SignUpPage';
import { features as authFeatures } from './feature';

const here = dirname(fileURLToPath(import.meta.url));
const routerFuture = { v7_startTransition: true, v7_relativeSplatPath: true } as const;
const GOOD_PASSWORD = 'correct horse battery staple';

function json(status: number, body: unknown, type = 'application/json') {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': type } });
}
const problem = (status: number, detail: string, errors?: { field: string; message: string }[]) =>
  json(status, { type: 'about:blank', title: 'Problem', status, detail, errors }, 'application/problem+json');

/** Stubs fetch with one handler per `METHOD path`; an unhandled call fails the test loudly. */
function mockApi(handlers: Record<string, () => Response>) {
  const calls: { key: string; body: unknown }[] = [];
  const stub = vi.fn(async (url: string, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${url}`;
    calls.push({ key, body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined });
    const handler = handlers[key];
    if (!handler) throw new Error(`unexpected request ${key}`);
    return handler();
  });
  vi.stubGlobal('fetch', stub);
  return calls;
}

/** The pages alone, without the gate: the post-sign-in navigation belongs to the gate, not to them. */
function renderApp(entry: string | { pathname: string; state?: unknown }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entry]} future={routerFuture}>
        <Routes>
          <Route path="/" element={<p>home page</p>} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/logout" element={<LogOutPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

/** The JSON bodies a `mockSession` stub saw POSTed to `url`, in order. */
function postedBodies(stub: ReturnType<typeof mockSession>, url: string): unknown[] {
  return stub.mock.calls
    .filter(([input, init]) => input === url && init?.method === 'POST')
    .map(([, init]) => JSON.parse(String(init?.body)));
}

afterEach(() => vi.unstubAllGlobals());

describe('SignUpPage', () => {
  it('T-030 a valid submit calls signup with the credentials, then the gate lands on the dashboard', async () => {
    const stub = mockSession('anonymous', (url, init) =>
      url === '/api/auth/signup' && init?.method === 'POST' ? json(201, { id: 1, email: 'ana@example.com' }) : undefined,
    );
    renderGuarded('/signup');
    expect(await screen.findByRole('heading', { name: 'Sign up' })).toBeInTheDocument();
    fill('Email', ' ana@example.com ');
    fill('Password', GOOD_PASSWORD);
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }));
    expect(await screen.findByRole('heading', { name: 'Dashboard page' })).toBeInTheDocument();
    expect(where()).toBe('/');
    expect(postedBodies(stub, '/api/auth/signup')).toEqual([{ email: 'ana@example.com', password: GOOD_PASSWORD }]);
  });

  it('T-031 invalid input shows inline errors tied to the labelled inputs and focuses the first one', async () => {
    const calls = mockApi({});
    renderApp('/signup');
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }));
    const email = screen.getByLabelText('Email');
    const password = screen.getByLabelText('Password');
    await waitFor(() => expect(email).toHaveFocus());
    expect(email).toHaveAttribute('aria-invalid', 'true');
    expect(document.getElementById(email.getAttribute('aria-describedby') ?? '')).toHaveTextContent('Enter a valid email address.');
    expect(password).toHaveAccessibleDescription(/at least 15 characters/);

    fill('Email', 'ana@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }));
    await waitFor(() => expect(password).toHaveFocus());
    expect(email).not.toHaveAttribute('aria-invalid');
    expect(calls).toHaveLength(0);
  });

  it('T-031 a server 400 puts its field errors beside the fields and focuses the first', async () => {
    mockApi({
      'POST /api/auth/signup': () =>
        problem(400, 'Invalid request.', [
          { field: 'password', message: 'That password is too common.' },
          { field: 'email', message: 'Enter a valid email address.' },
        ]),
    });
    renderApp('/signup');
    fill('Email', 'ana@example.com');
    fill('Password', GOOD_PASSWORD);
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }));
    await waitFor(() => expect(screen.getByLabelText('Email')).toHaveFocus());
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription(/That password is too common\./);
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('Enter a valid email address.');
  });

  it('T-031 a server 409 shows the taken-email message on the email field', async () => {
    mockApi({ 'POST /api/auth/signup': () => problem(409, 'An account with this email already exists.') });
    renderApp('/signup');
    fill('Email', 'ana@example.com');
    fill('Password', GOOD_PASSWORD);
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }));
    await waitFor(() => expect(screen.getByLabelText('Email')).toHaveFocus());
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('An account with this email already exists.');
    expect(screen.queryByText('home page')).not.toBeInTheDocument();
  });

  it('T-031 an unexpected server failure shows one alert and keeps the typed values', async () => {
    mockApi({ 'POST /api/auth/signup': () => json(500, { detail: 'internal' }) });
    renderApp('/signup');
    fill('Email', 'ana@example.com');
    fill('Password', GOOD_PASSWORD);
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not sign up right now. Try again.');
    expect(screen.getByLabelText('Email')).toHaveValue('ana@example.com');
  });
});

describe('LoginPage', () => {
  it('T-032 wrong credentials show one generic error and stay on the page', async () => {
    const calls = mockApi({ 'POST /api/auth/login': () => problem(401, 'Email or password is incorrect.') });
    renderApp('/login');
    fill('Email', 'ana@example.com');
    fill('Password', 'not the password');
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(LOGIN_FAILED_MESSAGE);
    await waitFor(() => expect(alert).toHaveFocus());
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(calls).toHaveLength(1);
    expect(screen.queryByText('home page')).not.toBeInTheDocument();
  });

  it('T-032 correct credentials log in and the gate lands on the dashboard', async () => {
    const stub = mockSession('anonymous', (url, init) =>
      url === '/api/auth/login' && init?.method === 'POST' ? json(200, { id: 1, email: 'ana@example.com' }) : undefined,
    );
    renderGuarded('/login');
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    fill('Email', 'ana@example.com');
    fill('Password', GOOD_PASSWORD);
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByRole('heading', { name: 'Dashboard page' })).toBeInTheDocument();
    expect(where()).toBe('/');
    expect(postedBodies(stub, '/api/auth/login')).toEqual([{ email: 'ana@example.com', password: GOOD_PASSWORD }]);
  });

  it('T-032 empty fields are caught on the page without a request', async () => {
    const calls = mockApi({});
    renderApp('/login');
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
    await waitFor(() => expect(screen.getByLabelText('Email')).toHaveFocus());
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription('Enter your password.');
    expect(calls).toHaveLength(0);
  });
});

describe('log out', () => {
  it('T-033 the log-out entry calls logout and lands on the login page', async () => {
    const calls = mockApi({ 'POST /api/auth/logout': () => new Response(null, { status: 204 }) });
    renderApp('/logout');
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    expect(calls.map((call) => call.key)).toEqual(['POST /api/auth/logout']);
  });

  it('T-033 an already expired session (401) still lands on the login page', async () => {
    mockApi({ 'POST /api/auth/logout': () => problem(401, 'Authentication is required.') });
    renderApp('/logout');
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
  });
});

describe('accessibility and tokens', () => {
  it.each([
    ['sign-up', '/signup'],
    ['login', '/login'],
  ])('T-034 the %s page has no serious or critical axe violation and a keyboard-reachable tab order', async (_name, path) => {
    mockApi({});
    const { container } = renderApp(path);
    // jsdom has no layout engine, so colour contrast is checked visually by the verifier.
    const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([]);

    const controls = container.querySelectorAll<HTMLElement>('input, button, a[href]');
    expect(controls.length).toBeGreaterThanOrEqual(4);
    for (const control of controls) {
      expect(control.tabIndex).toBe(0);
      expect(control).not.toBeDisabled();
    }
    for (const input of container.querySelectorAll('input')) {
      expect(screen.getByLabelText(input.labels?.[0]?.textContent ?? '')).toBe(input);
    }
  });

  it('T-034 an error state is also free of serious or critical axe violations', async () => {
    mockApi({});
    const { container } = renderApp('/signup');
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }));
    await waitFor(() => expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true'));
    const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([]);
  });

  it('T-034 no hard-coded colour, no inline style and no browser storage in the feature', () => {
    const sources = ['LoginPage.tsx', 'SignUpPage.tsx', 'AuthField.tsx', 'authApi.ts', 'feature.ts'].map((file) =>
      readFileSync(resolve(here, file), 'utf8'),
    );
    const hardCodedColour = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/;
    // Assembled from parts so this file does not contain the literals static rule SR-014 forbids.
    const storage = new RegExp(`\\b(${['local', 'session'].join('|')})Storage\\b`);
    for (const text of sources) {
      expect(text).not.toMatch(hardCodedColour);
      expect(text).not.toMatch(/style=\{\{/);
      expect(text).not.toMatch(storage);
    }
  });
});

describe('registry', () => {
  it('T-021 the real registry lists /login, /signup and /logout from the auth features array, all public', () => {
    const byPath = new Map(features.map((entry) => [entry.path, entry]));
    for (const path of ['/login', '/signup', '/logout']) {
      const entry = byPath.get(path);
      expect(entry, path).toBeDefined();
      expect(isPublic(entry as Feature), path).toBe(true);
    }
    expect(authFeatures.map((entry) => entry.id)).toEqual(['auth-login', 'auth-signup', 'auth-logout']);
    expect(authFeatures.every(isPublic)).toBe(true);
    for (const entry of authFeatures) expect(features).toContain(entry);
  });
});

describe('safe return target', () => {
  it.each([
    ['//evil.example', ''],
    ['https://evil.example', ''],
    ['/\\evil.example', ''],
    ['javascript:alert(1)', ''],
    ['/login', ''],
    ['/signup', '?x=1'],
    ['/logout', ''],
    ['/logout/', ''],
    ['/budgets', 'https://evil.example'],
    ['/budgets', '\\evil'],
    [42, ''],
  ])('T-023 safeTarget refuses from %j + %j and falls back to /', (pathname, search) => {
    expect(safeTarget({ from: { pathname, search } })).toBe('/');
  });

  it('T-023 safeTarget refuses a missing, malformed or non-object from', () => {
    for (const state of [undefined, null, {}, { from: null }, { from: '/budgets' }, { from: { search: '?a=1' } }]) {
      expect(safeTarget(state)).toBe('/');
    }
  });

  it('T-022 safeTarget keeps a same-origin path with its query', () => {
    expect(safeTarget({ from: { pathname: '/budgets', search: '?month=2026-10' } })).toBe('/budgets?month=2026-10');
    expect(safeTarget({ from: { pathname: '/import', search: '' } })).toBe('/import');
    expect(safeTarget({ from: { pathname: '/', search: '' } })).toBe('/');
  });
});

/** The guarded app with the real auth features, the real query client and one protected stub page. */
function Where() {
  const location = useLocation();
  return <p data-testid="where">{`${location.pathname}${location.search}`}</p>;
}
function Dashboard() {
  return <h1>Dashboard page</h1>;
}
function Budgets() {
  return <h1>Budgets page</h1>;
}
const guarded = buildRegistry({
  '../features/auth/feature.ts': { features: authFeatures },
  '../features/dashboard/feature.ts': { default: { id: 'dashboard', path: '/', label: 'Dashboard', order: 0, component: Dashboard } },
  '../features/budgets/feature.ts': { default: { id: 'budgets', path: '/budgets', label: 'Budgets', order: 20, component: Budgets } },
});

type Entry = string | { pathname: string; search?: string; state?: unknown };

function renderGuarded(entry: Entry) {
  const client = createAppQueryClient();
  const view = render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entry]} future={routerFuture}>
        <AuthGate features={guarded} />
        <Where />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { client, ...view };
}

const fromBudgets = { from: { pathname: '/budgets', search: '?month=2026-10' } };
const userBody = () => json(200, { id: 1, email: 'ana@example.com' });
const where = () => screen.getByTestId('where').textContent;

/** Lets every pending microtask and zero-delay timer run, so a late second navigation would show. */
const flush = () => act(async () => new Promise<void>((done) => setTimeout(done, 25)));

describe('single owner of the post-sign-in navigation (Bug-001)', () => {
  it.each(['/login', '/signup'])(
    'T-022 the gate alone sends a signed-in visitor at %s with a remembered target to that target',
    async (path) => {
      mockSession('authenticated');
      renderGuarded({ pathname: path, state: fromBudgets });
      expect(await screen.findByRole('heading', { name: 'Budgets page' })).toBeInTheDocument();
      await flush();
      expect(where()).toBe('/budgets?month=2026-10');
    },
  );

  it.each(['/login', '/signup'])(
    'T-023 the gate alone sends a signed-in visitor at %s with an unsafe remembered target to /',
    async (path) => {
      mockSession('authenticated');
      renderGuarded({ pathname: path, state: { from: { pathname: '//evil.example', search: '' } } });
      expect(await screen.findByRole('heading', { name: 'Dashboard page' })).toBeInTheDocument();
      await flush();
      expect(where()).toBe('/');
    },
  );

  it.each([
    ['log-in', '/login', 'POST /api/auth/login', 'Log in'],
    ['sign-up', '/signup', 'POST /api/auth/signup', 'Sign up'],
  ])('T-022 the %s page does not navigate itself after success: the gate owns where the user lands', async (_name, path, key, button) => {
    const calls = mockApi({ [key]: () => json(200, { id: 1, email: 'ana@example.com' }) });
    renderApp({ pathname: path, state: fromBudgets });
    fill('Email', 'ana@example.com');
    fill('Password', GOOD_PASSWORD);
    fireEvent.click(screen.getByRole('button', { name: button }));
    await waitFor(() => expect(calls.map((call) => call.key)).toEqual([key]));
    await flush();
    // No gate here, so a page that navigated would leave its own route (to the target or to /).
    expect(screen.queryByText('home page')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: button })).toBeInTheDocument();
  });
});

describe('return to the target after sign-in', () => {
  it('T-022 a visitor sent from /budgets?month=2026-10 lands there after logging in', async () => {
    mockSession('anonymous', (url, init) => (url === '/api/auth/login' && init?.method === 'POST' ? userBody() : undefined));
    renderGuarded('/budgets?month=2026-10');
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    expect(where()).toBe('/login');
    fill('Email', 'ana@example.com');
    fill('Password', GOOD_PASSWORD);
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByRole('heading', { name: 'Budgets page' })).toBeInTheDocument();
    await flush();
    expect(where()).toBe('/budgets?month=2026-10');
    expect(screen.getByRole('heading', { name: 'Budgets page' })).toBeInTheDocument();
  });

  it('T-022 a visitor sent from /budgets?month=2026-10 lands there after signing up', async () => {
    mockSession('anonymous', (url, init) =>
      url === '/api/auth/signup' && init?.method === 'POST' ? json(201, { id: 2, email: 'bo@example.com' }) : undefined,
    );
    renderGuarded({ pathname: '/signup', state: fromBudgets });
    expect(await screen.findByRole('heading', { name: 'Sign up' })).toBeInTheDocument();
    fill('Email', 'bo@example.com');
    fill('Password', GOOD_PASSWORD);
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }));
    expect(await screen.findByRole('heading', { name: 'Budgets page' })).toBeInTheDocument();
    await flush();
    expect(where()).toBe('/budgets?month=2026-10');
    expect(screen.getByRole('heading', { name: 'Budgets page' })).toBeInTheDocument();
  });

  it('T-022 with no remembered target, login and sign-up land on /', async () => {
    mockSession('anonymous', (url, init) => {
      if (init?.method !== 'POST') return undefined;
      if (url === '/api/auth/login') return userBody();
      if (url === '/api/auth/signup') return json(201, { id: 3, email: 'cy@example.com' });
      return undefined;
    });
    const login = renderGuarded('/login');
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    fill('Email', 'ana@example.com');
    fill('Password', GOOD_PASSWORD);
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByRole('heading', { name: 'Dashboard page' })).toBeInTheDocument();
    expect(where()).toBe('/');
    login.unmount();

    renderGuarded('/signup');
    expect(await screen.findByRole('heading', { name: 'Sign up' })).toBeInTheDocument();
    fill('Email', 'cy@example.com');
    fill('Password', GOOD_PASSWORD);
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }));
    expect(await screen.findByRole('heading', { name: 'Dashboard page' })).toBeInTheDocument();
    expect(where()).toBe('/');
  });

  it.each(['//evil.example', 'https://evil.example', '/login', '/signup', '/logout'])(
    'T-023 a remembered target of %s is not followed: login lands on /',
    async (pathname) => {
      mockSession('anonymous', (url, init) => (url === '/api/auth/login' && init?.method === 'POST' ? userBody() : undefined));
      renderGuarded({ pathname: '/login', state: { from: { pathname, search: '' } } });
      expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
      fill('Email', 'ana@example.com');
      fill('Password', GOOD_PASSWORD);
      fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
      expect(await screen.findByRole('heading', { name: 'Dashboard page' })).toBeInTheDocument();
      await flush();
      expect(where()).toBe('/');
    },
  );

  it('T-026 a wrong password inside the guarded app stays a form error and the user stays anonymous', async () => {
    mockSession('anonymous', (url, init) =>
      url === '/api/auth/login' && init?.method === 'POST' ? problem(401, 'Email or password is incorrect.') : undefined,
    );
    const { client } = renderGuarded({ pathname: '/login', state: fromBudgets });
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    fill('Email', 'ana@example.com');
    fill('Password', 'not the password');
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(LOGIN_FAILED_MESSAGE);
    expect(where()).toBe('/login');
    expect(client.getQueryData(SESSION_KEY)).toBeNull();
  });
});

/** SPEC-010 Story-004: Log out lives in the top-bar user menu (button named by the email), not in a separate button. */
async function logOutFromMenu() {
  fireEvent.keyDown(await screen.findByRole('button', { name: TEST_USER.email }), { key: 'Enter' });
  fireEvent.click(await screen.findByRole('menuitem', { name: 'Log out' }));
}

describe('log out inside the guarded app', () => {
  it('T-024 the shell control posts logout, clears the cache, makes the session anonymous and lands on /login', async () => {
    const stub = mockSession('authenticated', (url, init) =>
      url === '/api/auth/logout' && init?.method === 'POST' ? new Response(null, { status: 204 }) : undefined,
    );
    const { client } = renderGuarded('/');
    expect(await screen.findByRole('heading', { name: 'Dashboard page' })).toBeInTheDocument();
    client.setQueryData(['budgets', 'month'], { secret: 'previous user data' });
    await logOutFromMenu();
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    expect(where()).toBe('/login');
    expect(client.getQueryData(SESSION_KEY)).toBeNull();
    expect(client.getQueryData(['budgets', 'month'])).toBeUndefined();
    expect(stub.mock.calls.filter(([url, init]) => url === '/api/auth/logout' && init?.method === 'POST')).toHaveLength(1);
  });

  it('T-024 opening /logout while signed in logs out and lands on /login', async () => {
    mockSession('authenticated', (url, init) =>
      url === '/api/auth/logout' && init?.method === 'POST' ? new Response(null, { status: 204 }) : undefined,
    );
    const { client } = renderGuarded('/logout');
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    expect(where()).toBe('/login');
    expect(client.getQueryData(SESSION_KEY)).toBeNull();
  });

  it('T-025 an expired session (401) still ends on /login from the control and from /logout', async () => {
    const expired = (url: string, init?: RequestInit) =>
      url === '/api/auth/logout' && init?.method === 'POST' ? problem(401, 'Authentication is required.') : undefined;

    mockSession('authenticated', expired);
    const control = renderGuarded('/');
    expect(await screen.findByRole('heading', { name: 'Dashboard page' })).toBeInTheDocument();
    await logOutFromMenu();
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    expect(where()).toBe('/login');
    control.unmount();

    mockSession('authenticated', expired);
    renderGuarded('/logout');
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    expect(where()).toBe('/login');
  });

  it('T-025 a server failure on /logout keeps the user signed in and offers a retry', async () => {
    let attempts = 0;
    mockSession('authenticated', (url, init) => {
      if (url !== '/api/auth/logout' || init?.method !== 'POST') return undefined;
      attempts += 1;
      return attempts === 1 ? json(500, { detail: 'internal' }) : new Response(null, { status: 204 });
    });
    renderGuarded('/logout');
    expect(await screen.findByRole('alert')).toHaveTextContent('Log out failed. Try again.');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    expect(attempts).toBe(2);
  });
});

describe('target and storage rules', () => {
  it('T-027 the target is read from router state and no auth source touches browser storage', () => {
    // The gate owns the post-sign-in move (Bug-001), so it is the one place that reads the target.
    const gate = readFileSync(resolve(here, '../../kernel/AuthGate.tsx'), 'utf8');
    expect(gate).toMatch(/location\.state/);
    expect(gate).not.toMatch(/URLSearchParams|document\.cookie|location\.hash/);
    const pages = ['LoginPage.tsx', 'SignUpPage.tsx'].map((file) => readFileSync(resolve(here, file), 'utf8')).join('\n');
    expect(pages).not.toMatch(/location\.state|URLSearchParams|document\.cookie|location\.hash/);
    // Assembled from parts so this file does not contain the literals static rule SR-014 forbids.
    const storage = new RegExp(`\\b(${['local', 'session'].join('|')})Storage\\b`);
    for (const file of ['LoginPage.tsx', 'SignUpPage.tsx', 'authApi.ts', 'feature.ts']) {
      expect(readFileSync(resolve(here, file), 'utf8'), file).not.toMatch(storage);
    }
  });
});
