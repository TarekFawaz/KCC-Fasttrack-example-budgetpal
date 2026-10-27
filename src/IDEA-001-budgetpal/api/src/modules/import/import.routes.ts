import multipart from '@fastify/multipart';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { sendProblem, type Problem } from '../../kernel/errors.js';
import { requireUser } from '../../kernel/require-user.js';
import { buildProblem, validationProblem, type FieldError } from '../../kernel/problem.js';
import { MAX_FILE_BYTES } from './import.parser.js';
import { importRequestSchema, previewResponseSchema, type ImportRequest } from './import.schemas.js';
import * as service from './import.service.js';

export const IMPORT_PATH = '/api/import';
export const PREVIEW_PATH = `${IMPORT_PATH}/preview`;

/** RFC 9457 body, documented under the media type it is returned with. */
const problemSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string(),
  instance: z.string().optional(),
  errors: z.array(z.object({ field: z.string(), message: z.string() })).optional(),
});

export const problemContent = (description: string) => ({
  description,
  content: { 'application/problem+json': { schema: problemSchema } },
});

const pathOf = (url: string): string => url.split('?')[0] ?? url;

/** Multipart caps: one file of at most 5 MB, a handful of short text fields. Nothing is saved to disk. */
export const MULTIPART_LIMITS = {
  fileSize: MAX_FILE_BYTES,
  files: 1,
  fields: 8,
  fieldSize: 4096,
  parts: 10,
} as const;

export async function registerMultipart(app: FastifyInstance): Promise<void> {
  await app.register(multipart, { limits: MULTIPART_LIMITS });
}

const ID_FIELDS = ['accountId', 'expenseCategoryId', 'incomeCategoryId'] as const;

const multipartMessage = (code: string | undefined): string => {
  switch (code) {
    case 'FST_REQ_FILE_TOO_LARGE':
      return 'The file is larger than 5 MB.';
    case 'FST_FILES_LIMIT':
      return 'Upload one file.';
    case 'FST_FIELDS_LIMIT':
    case 'FST_PARTS_LIMIT':
      return 'The form has too many fields.';
    default:
      return 'The multipart body is malformed.';
  }
};

/** Everything an import route reads from the multipart body: the file bytes and the validated fields. */
export interface ReadForm {
  bytes: Uint8Array;
  request: ImportRequest;
}

/**
 * Reads the multipart body into memory (never to disk) and validates the text fields with the strict
 * request schema. Any failure becomes a 400 problem with field errors; no stack or file text is in it.
 * Preview uses the default schema (mapping optional); commit passes `commitRequestSchema`, which requires it.
 */
export async function readForm(
  request: FastifyRequest,
  schema: z.ZodType<ImportRequest> = importRequestSchema,
): Promise<{ ok: true; value: ReadForm } | { ok: false; problem: Problem }> {
  const instance = pathOf(request.url);
  const bad = (detail: string, errors: FieldError[]) => ({
    ok: false as const,
    problem: buildProblem(400, detail, { instance, errors }),
  });

  if (!request.isMultipart()) {
    return bad('The request must be multipart/form-data.', [{ field: 'file', message: 'Send the CSV as a file part.' }]);
  }

  let bytes: Uint8Array | undefined;
  const fields: Record<string, unknown> = {};
  try {
    for await (const part of request.parts()) {
      if (part.type === 'file') {
        if (part.fieldname !== 'file' || bytes !== undefined) {
          return bad('The request did not pass validation.', [
            { field: part.fieldname, message: 'Only one file part named "file" is accepted.' },
          ]);
        }
        bytes = await part.toBuffer();
      } else if (typeof part.value === 'string') {
        fields[part.fieldname] = part.value;
      }
    }
  } catch (error) {
    // Reading the body touches no database: whatever fails here (a limit, a truncated or garbled
    // body) is the client's request. Only the plugin's own server-side faults (5xx) propagate.
    const code = (error as { code?: string }).code;
    const status = (error as { statusCode?: number }).statusCode;
    if (status !== undefined && status >= 500) throw error;
    const message = multipartMessage(code);
    return bad(message, [{ field: 'file', message }]);
  }

  const raw: Record<string, unknown> = {};
  const jsonErrors: FieldError[] = [];
  for (const [name, value] of Object.entries(fields)) {
    if (value === '') continue; // an empty form control means "not chosen"
    if ((ID_FIELDS as readonly string[]).includes(name) && typeof value === 'string' && /^\d{1,15}$/.test(value)) {
      raw[name] = Number(value);
    } else if (name === 'mapping' && typeof value === 'string') {
      try {
        raw[name] = JSON.parse(value) as unknown;
      } catch {
        jsonErrors.push({ field: 'mapping', message: 'The mapping must be JSON.' });
      }
    } else {
      raw[name] = value;
    }
  }

  const parsed = schema.safeParse(raw);
  const errors: FieldError[] = [...jsonErrors];
  if (!parsed.success) {
    errors.push(...validationProblem(parsed.error.issues, instance).errors!);
  }
  if (bytes === undefined) errors.push({ field: 'file', message: 'Choose a CSV file.' });
  if (errors.length > 0 || !parsed.success || bytes === undefined) {
    return bad('The request did not pass validation.', errors);
  }
  return { ok: true, value: { bytes, request: parsed.data } };
}

/**
 * `POST /api/import/preview`. The session guard runs in `onRequest`, before the body is read, so a
 * request without a session is a 401 whatever it holds (GR-002). The handler logs counts only: file
 * text, descriptions and amounts never reach the log (GR-008).
 */
export function registerPreviewRoute(app: FastifyInstance): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.post(
    PREVIEW_PATH,
    {
      onRequest: requireUser,
      schema: {
        summary: 'Preview a CSV import without saving anything',
        description:
          'multipart/form-data: `file` (CSV, at most 5 MB and 5000 rows, UTF-8), `accountId`, and optionally ' +
          '`mapping` (JSON column indexes), `dateFormat`, `expenseCategoryId`, `incomeCategoryId`.',
        tags: ['import'],
        consumes: ['multipart/form-data'],
        response: {
          200: previewResponseSchema,
          400: problemContent('The file exceeds a cap, the mapping is wrong or the multipart body is malformed'),
          401: problemContent('There is no valid session'),
          404: problemContent('The account is not one of the user\'s'),
        },
      },
    },
    async (request, reply) => {
      const userId = (request.user as { id: number }).id;
      const form = await readForm(request);
      if (!form.ok) return sendProblem(reply, form.problem);
      const outcome = service.preview(app.db, userId, form.value.bytes, form.value.request, pathOf(request.url));
      if (!outcome.ok) return sendProblem(reply, outcome.problem);
      request.log.info(
        {
          event: 'import.previewed',
          rows: outcome.value.rowCount,
          valid: outcome.value.validCount,
          invalid: outcome.value.invalidCount,
        },
        'import previewed',
      );
      return outcome.value;
    },
  );
}
