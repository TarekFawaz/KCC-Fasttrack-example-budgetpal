import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import axe from 'axe-core';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Shell } from '../../kernel/Shell';
import { buildRegistry, features } from '../../kernel/registry';
import { LOGIN_FAILED_MESSAGE, LoginPage, LogOutPage } from './LoginPage';
import { SignUpPage } from './SignUpPage';
import feature, { logOutFeature, signUpFeature } from './feature';

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

function renderApp(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]} future={routerFuture}>
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

afterEach(() => vi.unstubAllGlobals());

describe('SignUpPage', () => {
  it('T-030 a valid submit calls signup with the credentials, then lands on the home page', async () => {
    const calls = mockApi({ 'POST /api/auth/signup': () => json(201, { id: 1, email: 'ana@example.com' }) });
    renderApp('/signup');
    fill('Email', ' ana@example.com ');
    fill('Password', GOOD_PASSWORD);
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }));
    expect(await screen.findByText('home page')).toBeInTheDocument();
    expect(calls).toEqual([{ key: 'POST /api/auth/signup', body: { email: 'ana@example.com', password: GOOD_PASSWORD } }]);
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

  it('T-032 correct credentials log in and land on the home page', async () => {
    const calls = mockApi({ 'POST /api/auth/login': () => json(200, { id: 1, email: 'ana@example.com' }) });
    renderApp('/login');
    fill('Email', 'ana@example.com');
    fill('Password', GOOD_PASSWORD);
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByText('home page')).toBeInTheDocument();
    expect(calls[0]).toEqual({ key: 'POST /api/auth/login', body: { email: 'ana@example.com', password: GOOD_PASSWORD } });
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

  it('T-034 styles use CSS variables only and the feature touches no browser storage', () => {
    const sources = ['LoginPage.tsx', 'SignUpPage.tsx', 'authApi.ts', 'feature.ts'].map((file) =>
      readFileSync(resolve(here, file), 'utf8'),
    );
    const hardCodedColour = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/;
    // Assembled from parts so this file does not contain the literals static rule SR-014 forbids.
    const storage = new RegExp(`\\b(${['local', 'session'].join('|')})Storage\\b`);
    for (const text of sources) {
      expect(text).not.toMatch(hardCodedColour);
      expect(text).not.toMatch(storage);
    }
    expect(sources.join('\n')).toContain('var(--');
  });
});

describe('registry', () => {
  it('T-035 the shared registry picks up feature.ts with no shared file changed', () => {
    const login = features.find((entry) => entry.id === 'auth-login');
    expect(login).toMatchObject({ path: '/login', label: 'Log in' });
    expect(login).toBe(feature);
  });

  it('T-035 the three auth features are valid, distinct registry entries on /login, /signup and /logout', () => {
    const registry = buildRegistry({
      '../features/auth/feature.ts': { default: feature },
      '../features/auth-signup/feature.ts': { default: signUpFeature },
      '../features/auth-logout/feature.ts': { default: logOutFeature },
    });
    expect(registry.map((entry) => [entry.path, entry.label])).toEqual([
      ['/login', 'Log in'],
      ['/signup', 'Sign up'],
      ['/logout', 'Log out'],
    ]);
  });

  it('T-035 inside the shell the log-out nav entry logs out and lands on the login page', async () => {
    const calls = mockApi({ 'POST /api/auth/logout': () => new Response(null, { status: 204 }) });
    const registry = buildRegistry({
      '../features/auth/feature.ts': { default: feature },
      '../features/auth-signup/feature.ts': { default: signUpFeature },
      '../features/auth-logout/feature.ts': { default: logOutFeature },
    });
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/signup']} future={routerFuture}>
          <Shell features={registry} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByRole('heading', { name: 'Sign up' })).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    fireEvent.click(within(nav).getByRole('link', { name: 'Log out' }));
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    expect(calls.map((call) => call.key)).toEqual(['POST /api/auth/logout']);
  });
});
