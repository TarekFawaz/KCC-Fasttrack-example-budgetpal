import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ApiProblem, useSignUp } from './authApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { AuthField, ERROR_TEXT_CLASSES, useFocusFirstError, type FieldErrors } from './AuthField';

export const MIN_PASSWORD_LENGTH = 15;
export const MAX_PASSWORD_LENGTH = 128;
const FIELD_ORDER = ['email', 'password'] as const;
const PASSWORD_HINT = `Use ${MIN_PASSWORD_LENGTH} to ${MAX_PASSWORD_LENGTH} characters. A few ordinary words with spaces works well.`;
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Mirrors the api's rules so most mistakes are caught before a request; the server stays the authority. */
export function validateSignUp(email: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!EMAIL_SHAPE.test(email.trim())) errors.email = 'Enter a valid email address.';
  if (password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  } else if (password.length > MAX_PASSWORD_LENGTH) {
    errors.password = `Password must be at most ${MAX_PASSWORD_LENGTH} characters.`;
  }
  return errors;
}

/** Maps a server 400 (`errors[]`) or 409 onto the fields; anything else becomes a form-level message. */
function fromProblem(problem: unknown): { fields: FieldErrors; form: string | null } {
  if (!(problem instanceof ApiProblem)) return { fields: {}, form: 'Could not sign up right now. Try again.' };
  if (problem.status === 409) return { fields: { email: problem.message }, form: null };
  if (problem.status === 400) {
    const fields: FieldErrors = {};
    for (const entry of problem.errors) {
      if ((entry.field === 'email' || entry.field === 'password') && !fields[entry.field]) {
        fields[entry.field] = entry.message;
      }
    }
    if (fields.email || fields.password) return { fields, form: null };
    return { fields: {}, form: problem.message };
  }
  return { fields: {}, form: 'Could not sign up right now. Try again.' };
}

export function SignUpPage() {
  const signUp = useSignUp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const register = useFocusFirstError(errors, FIELD_ORDER);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const next = validateSignUp(email, password);
    setErrors(next);
    if (next.email || next.password) return;
    // On success the session turns authenticated and `AuthGate` owns the move (see LoginPage).
    signUp.mutateAsync({ email: email.trim(), password }).catch((problem: unknown) => {
      const mapped = fromProblem(problem);
      setErrors(mapped.fields);
      setFormError(mapped.form);
    });
  }

  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-4">
      <Card>
        <CardHeader>
          <h1 className="text-2xl font-semibold leading-none tracking-tight">Sign up</h1>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4" aria-label="Sign up">
            {formError ? (
              <p role="alert" className={ERROR_TEXT_CLASSES}>
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
              autoComplete="new-password"
              value={password}
              onChange={setPassword}
              error={errors.password}
              hint={PASSWORD_HINT}
              inputRef={register('password')}
            />
            <Button type="submit" disabled={signUp.isPending}>
              {signUp.isPending ? 'Creating account...' : 'Sign up'}
            </Button>
          </form>
          <p className="m-0 text-sm">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-primary underline underline-offset-4">
              Log in
            </Link>
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
