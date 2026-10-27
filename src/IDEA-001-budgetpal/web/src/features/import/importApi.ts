import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

/** The import routes of the api (SPEC-006); same origin, the session cookie rides along. */
export const PREVIEW_URL = '/api/import/preview';
export const COMMIT_URL = '/api/import/commit';
export const ACCOUNTS_URL = '/api/accounts';
export const CATEGORIES_URL = '/api/categories';

/** Upload limits the api enforces (D-14); shown on the empty state. */
export const MAX_FILE_MB = 5;
export const MAX_ROWS = 5000;

export const DATE_FORMATS = ['YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY'] as const;
export type DateFormat = (typeof DATE_FORMATS)[number];

/** Zero-based column index of each field, as the api's `ImportColumnMapping`. */
export interface ColumnMapping {
  date: number;
  amount: number;
  description: number;
}

export interface InvalidRow {
  line: number;
  reason: string;
}

export interface PreviewRow {
  line: number;
  date: string;
  /** Signed integer minor units: negative is money out. */
  amountMinor: number;
  description: string;
}

/** Mirrors the api's `ImportPreviewResponse`. */
export interface PreviewResponse {
  headers: string[];
  hasHeader: boolean;
  suggestedMapping: ColumnMapping | null;
  rowCount: number;
  validCount: number;
  invalidCount: number;
  validRows: PreviewRow[];
  invalidRows: InvalidRow[];
}

/** Mirrors the api's `ImportCommitResponse`. */
export interface CommitResponse {
  imported: number;
  skipped: number;
  invalid: number;
  invalidRows: InvalidRow[];
}

export interface AccountOption {
  id: number;
  name: string;
}

export type CategoryKind = 'expense' | 'income';

export interface CategoryOption {
  id: number;
  name: string;
  kind: CategoryKind;
}

/** What identifies one import request: the file and the form values that go with it. */
export interface ImportParams {
  file: File;
  accountId: number;
  mapping?: ColumnMapping;
  dateFormat?: DateFormat;
  expenseCategoryId?: number;
  incomeCategoryId?: number;
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

async function send(url: string, init: RequestInit = { method: 'GET' }): Promise<Response> {
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...init,
    headers: { accept: 'application/json, application/problem+json', ...init.headers },
  });
  if (!response.ok) throw await toProblem(response);
  return response;
}

/** The multipart body of a preview or commit; the browser sets the content type and boundary. */
export function buildForm(params: ImportParams): FormData {
  const form = new FormData();
  form.set('accountId', String(params.accountId));
  if (params.mapping) form.set('mapping', JSON.stringify(params.mapping));
  if (params.dateFormat) form.set('dateFormat', params.dateFormat);
  if (params.expenseCategoryId !== undefined) form.set('expenseCategoryId', String(params.expenseCategoryId));
  if (params.incomeCategoryId !== undefined) form.set('incomeCategoryId', String(params.incomeCategoryId));
  form.set('file', params.file, params.file.name);
  return form;
}

export async function previewImport(params: ImportParams): Promise<PreviewResponse> {
  const response = await send(PREVIEW_URL, { method: 'POST', body: buildForm(params) });
  return (await response.json()) as PreviewResponse;
}

export async function commitImport(params: ImportParams): Promise<CommitResponse> {
  const response = await send(COMMIT_URL, { method: 'POST', body: buildForm(params) });
  return (await response.json()) as CommitResponse;
}

export const IMPORT_KEY = ['import'] as const;

/**
 * The preview for the current form values. Changing any value is a new key, so the page asks again;
 * the previous answer stays on screen meanwhile so the controls do not jump. `version` counts chosen files.
 */
export function usePreview(params: ImportParams | null, version: number) {
  return useQuery({
    queryKey: [...IMPORT_KEY, 'preview', version, params?.accountId, params?.mapping, params?.dateFormat, params?.expenseCategoryId, params?.incomeCategoryId],
    queryFn: () => previewImport(params as ImportParams),
    enabled: params !== null,
    retry: false,
    gcTime: 0,
    placeholderData: keepPreviousData,
  });
}

/** Writes the rows, then refreshes every transactions query so the list shows them. */
export function useCommit() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (params: ImportParams) => commitImport(params),
    onSuccess: () => client.invalidateQueries({ queryKey: ['transactions'] }),
  });
}

export function useAccounts() {
  return useQuery({
    queryKey: [...IMPORT_KEY, 'accounts'],
    queryFn: async () => {
      const rows = (await (await send(ACCOUNTS_URL)).json()) as AccountOption[];
      return rows.map(({ id, name }) => ({ id, name }));
    },
    retry: false,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: [...IMPORT_KEY, 'categories'],
    queryFn: async () => {
      const rows = (await (await send(CATEGORIES_URL)).json()) as CategoryOption[];
      return rows.map(({ id, name, kind }) => ({ id, name, kind }));
    },
    retry: false,
  });
}
