import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { AuthField, ERROR_TEXT_CLASSES, useFocusFirstError, type FieldErrors } from './AuthField';
import { ApiProblem, useLogIn, useLogOut } from './authApi';

/** Centred single-column page frame, fine down to 360 px. */
const PAGE_CLASSES = 'mx-auto flex w-full max-w-md flex-col gap-4';

export const LOGIN_FAILED_MESSAGE = 'Email or password is incorrect.';
const FIELD_ORDER = ['email', 'password'] as const;

export function LoginPage() {
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
    // On success `useLogIn` turns the session authenticated and the route guard (`AuthGate`) moves the
    // user to the remembered target or `/`: this page never navigates, so only one redirect decides.
    // The promise form keeps the failure handler alive after the page unmounts.
    logIn.mutateAsync({ email: email.trim(), password }).catch((problem: unknown) => {
      // One message for every refusal, so the page never says which half was wrong.
      setFormError(
        problem instanceof ApiProblem && problem.status !== 401 && problem.status !== 400
          ? 'Could not log in right now. Try again.'
          : LOGIN_FAILED_MESSAGE,
      );
    });
  }

  return (
    <section className={PAGE_CLASSES}>
      <Card>
        <CardHeader>
          <h1 className="text-2xl font-semibold leading-none tracking-tight">Log in</h1>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4" aria-label="Log in">
            {formError ? (
              <p role="alert" tabIndex={-1} ref={alertRef} className={ERROR_TEXT_CLASSES}>
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
            <Button type="submit" disabled={logIn.isPending}>
              {logIn.isPending ? 'Logging in...' : 'Log in'}
            </Button>
          </form>
          <p className="m-0 text-sm">
            New here?{' '}
            <Link to="/signup" className="font-medium text-primary underline underline-offset-4">
              Create an account
            </Link>
          </p>
        </CardContent>
      </Card>
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
      <section className={PAGE_CLASSES}>
        <p role="alert" className={ERROR_TEXT_CLASSES}>
          <span aria-hidden="true">⚠ </span>
          Log out failed. Try again.
        </p>
        <Button type="button" onClick={run} className="self-start">
          Try again
        </Button>
      </section>
    );
  }

  return (
    <section className={PAGE_CLASSES}>
      <p role="status">Logging out...</p>
    </section>
  );
}
