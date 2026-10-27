import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ApiProblem, useLogIn, useLogOut } from './authApi';

/** Pages a user must never be sent back to after signing in. */
const AUTH_PATHS = ['/login', '/signup', '/logout'];

/**
 * Where to go after signing in: the `from` the route guard left in router state, but only when it
 * is a same-origin path (one leading slash, not `//host`, no backslash, no scheme) that is not an
 * auth page. Anything else, including a missing `from`, lands on `/`. Router state only: nothing
 * is read from the URL or from browser storage (SR-015, GR-013).
 */
export function safeTarget(state: unknown): string {
  const from = (state as { from?: { pathname?: unknown; search?: unknown } } | null | undefined)?.from;
  if (typeof from !== 'object' || from === null) return '/';
  const { pathname, search } = from;
  if (typeof pathname !== 'string' || !isPlainPath(pathname)) return '/';
  if (!pathname.startsWith('/') || pathname.startsWith('//')) return '/';
  if (AUTH_PATHS.includes(pathname.replace(/\/+$/, '') || '/')) return '/';
  if (search === undefined || search === '') return pathname;
  if (typeof search !== 'string' || !search.startsWith('?') || !isPlainPath(search)) return '/';
  return `${pathname}${search}`;
}

/** No backslash (browsers read `/\host` as `//host`) and no control character. */
function isPlainPath(value: string): boolean {
  for (const char of value) {
    if (char === '\\' || char.charCodeAt(0) < 32) return false;
  }
  return true;
}

export type FieldErrors = Partial<Record<'email' | 'password', string>>;

/** Layout uses the shell's CSS-variable tokens only; one column, fine down to 360 px. */
export const authStyles = {
  page: { maxWidth: '28rem', width: '100%', margin: '0 auto' } satisfies CSSProperties,
  form: { display: 'flex', flexDirection: 'column', gap: 'var(--space)' } satisfies CSSProperties,
  field: { display: 'flex', flexDirection: 'column', gap: '0.25rem' } satisfies CSSProperties,
  input: {
    font: 'inherit',
    color: 'var(--text)',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '0.625rem 0.75rem',
    minHeight: '2.75rem',
    width: '100%',
  } satisfies CSSProperties,
  hint: { margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' } satisfies CSSProperties,
  error: { margin: 0, color: 'var(--warn)', fontWeight: 600 } satisfies CSSProperties,
  button: {
    font: 'inherit',
    fontWeight: 600,
    color: 'var(--text)',
    background: 'var(--surface)',
    border: '2px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '0.625rem 1rem',
    minHeight: '2.75rem',
    cursor: 'pointer',
  } satisfies CSSProperties,
};

interface AuthFieldProps {
  name: 'email' | 'password';
  label: string;
  type: 'email' | 'password';
  autoComplete: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  inputRef: (element: HTMLInputElement | null) => void;
}

/** A labelled input; its error (text, never colour alone) is tied to it with aria-describedby. */
export function AuthField({ name, label, type, autoComplete, value, onChange, error, hint, inputRef }: AuthFieldProps) {
  const id = `auth-${name}`;
  const describedBy = [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined;
  return (
    <div style={authStyles.field}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        ref={inputRef}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        style={authStyles.input}
      />
      {hint ? (
        <p id={`${id}-hint`} style={authStyles.hint}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} style={authStyles.error}>
          <span aria-hidden="true">⚠ </span>
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Moves focus to the first field (in `order`) that has an error each time the error set is replaced. */
export function useFocusFirstError(errors: FieldErrors, order: readonly (keyof FieldErrors)[]) {
  const refs = useRef<Partial<Record<keyof FieldErrors, HTMLInputElement | null>>>({});
  useEffect(() => {
    const first = order.find((name) => errors[name]);
    if (first) refs.current[first]?.focus();
  }, [errors, order]);
  return (name: keyof FieldErrors) => (element: HTMLInputElement | null) => {
    refs.current[name] = element;
  };
}

export const LOGIN_FAILED_MESSAGE = 'Email or password is incorrect.';
const FIELD_ORDER = ['email', 'password'] as const;

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const logIn = useLogIn();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const alertRef = useRef<HTMLParagraphElement | null>(null);
  const register = useFocusFirstError(errors, FIELD_ORDER);

  useEffect(() => {
    if (formError) alertRef.current?.focus();
  }, [formError]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const next: FieldErrors = {};
    if (email.trim() === '') next.email = 'Enter your email address.';
    if (password === '') next.password = 'Enter your password.';
    setErrors(next);
    if (next.email || next.password) return;
    const target = safeTarget(location.state);
    // The promise form: the session turns authenticated first, which unmounts this page and would
    // drop the callbacks of `mutate`; the navigation to the remembered target must still happen.
    logIn.mutateAsync({ email: email.trim(), password }).then(
      () => navigate(target, { replace: true }),
      (problem: unknown) => {
        // One message for every refusal, so the page never says which half was wrong.
        setFormError(
          problem instanceof ApiProblem && problem.status !== 401 && problem.status !== 400
            ? 'Could not log in right now. Try again.'
            : LOGIN_FAILED_MESSAGE,
        );
      },
    );
  }

  return (
    <section style={authStyles.page}>
      <h1>Log in</h1>
      <form onSubmit={onSubmit} noValidate style={authStyles.form} aria-label="Log in">
        {formError ? (
          <p role="alert" tabIndex={-1} ref={alertRef} style={authStyles.error}>
            <span aria-hidden="true">⚠ </span>
            {formError}
          </p>
        ) : null}
        <AuthField
          name="email"
          label="Email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={setEmail}
          error={errors.email}
          inputRef={register('email')}
        />
        <AuthField
          name="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
          error={errors.password}
          inputRef={register('password')}
        />
        <button type="submit" disabled={logIn.isPending} style={authStyles.button}>
          {logIn.isPending ? 'Logging in...' : 'Log in'}
        </button>
      </form>
      <p>
        New here? <Link to="/signup">Create an account</Link>
      </p>
    </section>
  );
}

/** The log-out nav entry's route: ends the session (also when it already expired) and lands on /login. */
export function LogOutPage() {
  const navigate = useNavigate();
  const logOut = useLogOut();
  const started = useRef(false);
  const [failed, setFailed] = useState(false);
  const { mutateAsync } = logOut;

  const run = useCallback(() => {
    setFailed(false);
    // 401 (session already gone) counts as signed out in the kernel hook. The promise form still
    // resolves after this page unmounts because the session turned anonymous.
    mutateAsync().then(
      () => navigate('/login', { replace: true }),
      () => setFailed(true),
    );
  }, [mutateAsync, navigate]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    run();
  }, [run]);

  if (failed) {
    return (
      <section style={authStyles.page}>
        <p role="alert" style={authStyles.error}>
          <span aria-hidden="true">⚠ </span>
          Log out failed. Try again.
        </p>
        <button type="button" onClick={run} style={authStyles.button}>
          Try again
        </button>
      </section>
    );
  }

  return (
    <section style={authStyles.page}>
      <p role="status">Logging out...</p>
    </section>
  );
}
