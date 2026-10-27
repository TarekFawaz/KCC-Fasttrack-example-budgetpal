import type Database from 'better-sqlite3';
import type { Problem } from '../../kernel/errors.js';
import { buildProblem, type FieldError } from '../../kernel/problem.js';
import { ImportError, parseCsv, type ParsedCsv } from './import.parser.js';
import { suggestMapping, validateRow, type ColumnMapping, type InvalidRow, type ValidRow } from './import.rows.js';
import * as repository from './import.repository.js';
import type { ImportRequest, PreviewResponse } from './import.schemas.js';

/** Either the value, or the problem+json body the route must send. */
export type Outcome<T> = { ok: true; value: T } | { ok: false; problem: Problem };

/** Rows shown in a preview: the first 20 valid ones (AC-1). */
export const PREVIEW_ROW_LIMIT = 20;

/** A valid row plus the category the amount's sign selects (assumption A-1); commit reuses it. */
export interface PreparedRow extends ValidRow {
  categoryId: number;
}

export interface Analysis {
  parsed: ParsedCsv;
  /** Present only when the request carried a mapping. */
  rows?: { valid: PreparedRow[]; invalid: InvalidRow[] };
}

const fail = (instance: string, detail: string, errors?: FieldError[]): { ok: false; problem: Problem } => ({
  ok: false,
  problem: buildProblem(400, detail, { instance, ...(errors ? { errors } : {}) }),
});

/**
 * Checks the account (404 when it is not the caller's, the same answer as an unknown id), then the optional
 * categories, then parses `bytes` and validates every row when a mapping is present. Shared by preview and
 * commit so both read the file with the same code. Nothing is written and the bytes stay in memory.
 */
export function analyse(
  db: Database.Database,
  userId: number,
  bytes: Uint8Array,
  request: ImportRequest,
  instance: string,
): Outcome<Analysis> {
  if (!repository.accountBelongsToUser(db, userId, request.accountId)) {
    return { ok: false, problem: buildProblem(404, 'No account with this id.', { instance }) };
  }

  const categoryErrors: FieldError[] = [];
  if (
    request.expenseCategoryId !== undefined &&
    !repository.categoryHasKind(db, userId, request.expenseCategoryId, 'expense')
  ) {
    categoryErrors.push({ field: 'expenseCategoryId', message: 'Choose one of your expense categories.' });
  }
  if (
    request.incomeCategoryId !== undefined &&
    !repository.categoryHasKind(db, userId, request.incomeCategoryId, 'income')
  ) {
    categoryErrors.push({ field: 'incomeCategoryId', message: 'Choose one of your income categories.' });
  }
  if (categoryErrors.length > 0) return fail(instance, 'The category does not exist.', categoryErrors);

  let parsed: ParsedCsv;
  try {
    parsed = parseCsv(bytes);
  } catch (error) {
    if (error instanceof ImportError) return fail(instance, error.message, [{ field: 'file', message: error.message }]);
    throw error;
  }

  const { mapping, dateFormat } = request;
  if (mapping === undefined) return { ok: true, value: { parsed } };

  if (dateFormat === undefined) {
    return fail(instance, 'The request did not pass validation.', [
      { field: 'dateFormat', message: 'Choose the date format of the file.' },
    ]);
  }
  const missing = (Object.keys(mapping) as Array<keyof ColumnMapping>)
    .filter((field) => mapping[field] >= parsed.headers.length)
    .map((field) => ({ field: `mapping.${field}`, message: 'The file has no such column.' }));
  if (missing.length > 0) return fail(instance, 'The mapping names a column the file does not have.', missing);

  const valid: PreparedRow[] = [];
  const invalid: InvalidRow[] = [];
  for (const { line, cells } of parsed.rows) {
    const result = validateRow(cells, line, mapping, dateFormat);
    if (!result.ok) {
      invalid.push({ line: result.line, reason: result.reason });
      continue;
    }
    const categoryId = result.amountMinor < 0 ? request.expenseCategoryId : request.incomeCategoryId;
    if (categoryId === undefined) {
      invalid.push({
        line,
        reason: result.amountMinor < 0 ? 'No expense category chosen' : 'No income category chosen',
      });
      continue;
    }
    valid.push({
      line: result.line,
      date: result.date,
      amountMinor: result.amountMinor,
      description: result.description,
      categoryId,
    });
  }
  return { ok: true, value: { parsed, rows: { valid, invalid } } };
}

/** Preview use case: headers, suggested mapping and, with a mapping, the validation summary. Writes nothing. */
export function preview(
  db: Database.Database,
  userId: number,
  bytes: Uint8Array,
  request: ImportRequest,
  instance: string,
): Outcome<PreviewResponse> {
  const analysis = analyse(db, userId, bytes, request, instance);
  if (!analysis.ok) return analysis;
  const { parsed, rows } = analysis.value;
  return {
    ok: true,
    value: {
      headers: parsed.headers,
      hasHeader: parsed.hasHeader,
      suggestedMapping: suggestMapping(parsed.headers) ?? null,
      rowCount: parsed.rows.length,
      validCount: rows?.valid.length ?? 0,
      invalidCount: rows?.invalid.length ?? 0,
      validRows: (rows?.valid ?? [])
        .slice(0, PREVIEW_ROW_LIMIT)
        .map(({ line, date, amountMinor, description }) => ({ line, date, amountMinor, description })),
      invalidRows: rows?.invalid ?? [],
    },
  };
}
