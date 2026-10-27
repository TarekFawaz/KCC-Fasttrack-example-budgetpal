import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiProblem, useSignUp } from './authApi';
import { AuthField, authStyles, useFocusFirstError, type FieldErrors } from './LoginPage';

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
  const navigate = useNavigate();
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
    signUp.mutate(
      { email: email.trim(), password },
      {
        onSuccess: () => navigate('/', { replace: true }),
        onError: (problem) => {
          const mapped = fromProblem(problem);
          setErrors(mapped.fields);
          setFormError(mapped.form);
        },
      },
    );
  }

  return (
    <section style={authStyles.page}>
      <h1>Sign up</h1>
      <form onSubmit={onSubmit} noValidate style={authStyles.form} aria-label="Sign up">
        {formError ? (
          <p role="alert" style={authStyles.error}>
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
        <button type="submit" disabled={signUp.isPending} style={authStyles.button}>
          {signUp.isPending ? 'Creating account...' : 'Sign up'}
        </button>
      </form>
      <p>
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </section>
  );
}
