import { useMutation, useQueryClient } from '@tanstack/react-query';
import { SESSION_KEY, useSession, useSignOut } from '../../kernel/session';

/** The auth routes of the api (SPEC-002 Story-001/002); same origin, the session cookie rides along. */
export const AUTH_BASE = '/api/auth';

export interface AuthUser {
  id: number;
  email: string;
}

export interface Credentials {
  email: string;
  password: string;
}

export interface FieldProblem {
  field: string;
  message: string;
}

/** A non-2xx answer, read from the RFC 9457 body when there is one. Carries no request data. */
export class ApiProblem extends Error {
  readonly status: number;
  readonly errors: FieldProblem[];

  constructor(status: number, detail: string, errors: FieldProblem[] = []) {
    super(detail);
    this.name = 'ApiProblem';
    this.status = status;
    this.errors = errors;
  }
}

async function toProblem(response: Response): Promise<ApiProblem> {
  let detail = `Request failed with status ${response.status}.`;
  let errors: FieldProblem[] = [];
  try {
    const body = (await response.json()) as { detail?: unknown; errors?: unknown };
    if (typeof body.detail === 'string') detail = body.detail;
    if (Array.isArray(body.errors)) {
      errors = body.errors.filter(
        (entry): entry is FieldProblem =>
          typeof entry === 'object' &&
          entry !== null &&
          typeof (entry as FieldProblem).field === 'string' &&
          typeof (entry as FieldProblem).message === 'string',
      );
    }
  } catch {
    // Not JSON (for example a proxy error page): the status-based detail above stands.
  }
  return new ApiProblem(response.status, detail, errors);
}

async function send(path: string, init: RequestInit): Promise<Response> {
  const response = await fetch(`${AUTH_BASE}${path}`, {
    credentials: 'same-origin',
    ...init,
    headers: { accept: 'application/json, application/problem+json', ...init.headers },
  });
  if (!response.ok) throw await toProblem(response);
  return response;
}

function jsonBody(credentials: Credentials): RequestInit {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(credentials),
  };
}

export async function signUp(credentials: Credentials): Promise<AuthUser> {
  return (await (await send('/signup', jsonBody(credentials))).json()) as AuthUser;
}

export async function logIn(credentials: Credentials): Promise<AuthUser> {
  return (await (await send('/login', jsonBody(credentials))).json()) as AuthUser;
}

/** The session cache key and reader live in the kernel: one source of "who is signed in". */
export const ME_KEY = SESSION_KEY;
export const useMe = useSession;

export function useSignUp() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: signUp,
    onSuccess: (user) => client.setQueryData(ME_KEY, user),
  });
}

export function useLogIn() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: logIn,
    onSuccess: (user) => client.setQueryData(ME_KEY, user),
  });
}

/** Ends the session and drops every cached server answer; the kernel owns it and treats 401 as signed out. */
export const useLogOut = useSignOut;
