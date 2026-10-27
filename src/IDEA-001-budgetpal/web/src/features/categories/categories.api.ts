import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

/** The categories routes of the api (SPEC-003 Story-001/002); same origin, the session cookie rides along. */
export const CATEGORIES_URL = '/api/categories';
export const CATEGORIES_KEY = ['categories'] as const;

export type CategoryKind = 'expense' | 'income';

export interface Category {
  id: number;
  name: string;
  kind: CategoryKind;
  createdAt: string;
}

export interface NewCategory {
  name: string;
  kind: CategoryKind;
}

export interface FieldProblem {
  field: string;
  message: string;
}

/** A non-2xx answer, read from the RFC 9457 body when there is one. Carries no request data. */
export class CategoryApiError extends Error {
  readonly status: number;
  readonly errors: FieldProblem[];

  constructor(status: number, detail: string, errors: FieldProblem[] = []) {
    super(detail);
    this.name = 'CategoryApiError';
    this.status = status;
    this.errors = errors;
  }
}

async function toProblem(response: Response): Promise<CategoryApiError> {
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
  return new CategoryApiError(response.status, detail, errors);
}

async function send(path: string, init: RequestInit): Promise<Response> {
  const response = await fetch(`${CATEGORIES_URL}${path}`, {
    credentials: 'same-origin',
    ...init,
    headers: { accept: 'application/json, application/problem+json', ...init.headers },
  });
  if (!response.ok) throw await toProblem(response);
  return response;
}

export async function fetchCategories(): Promise<Category[]> {
  return (await (await send('', { method: 'GET' })).json()) as Category[];
}

export async function createCategory(input: NewCategory): Promise<Category> {
  const response = await send('', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  return (await response.json()) as Category;
}

export async function updateCategory(id: number, input: Partial<NewCategory>): Promise<Category> {
  const response = await send(`/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  return (await response.json()) as Category;
}

export async function deleteCategory(id: number): Promise<void> {
  await send(`/${id}`, { method: 'DELETE' });
}

/** The signed-in user's categories, ordered by name by the api. */
export function useCategories() {
  return useQuery({ queryKey: CATEGORIES_KEY, queryFn: fetchCategories, retry: false });
}

/** Creates a category and refreshes the list; a refused create leaves the cached list untouched. */
export function useCreateCategory() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: createCategory,
    onSuccess: () => client.invalidateQueries({ queryKey: CATEGORIES_KEY }),
  });
}

/** Renames or re-kinds a category and refreshes the list; a refused update leaves the cached list untouched. */
export function useUpdateCategory() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: number } & NewCategory) => updateCategory(id, input),
    onSuccess: () => client.invalidateQueries({ queryKey: CATEGORIES_KEY }),
  });
}

/** Deletes a category and refreshes the list; a 409 (in use) leaves the cached list untouched. */
export function useDeleteCategory() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteCategory(id),
    onSuccess: () => client.invalidateQueries({ queryKey: CATEGORIES_KEY }),
  });
}
