import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { DATE_FORMATS } from './import.rows.js';

extendZodWithOpenApi(z);

const columnIndex = z.number().int().min(0).max(999);
const id = z.number().int().positive();

/** Zero-based column indexes of the three mapped fields. */
export const columnMappingSchema = z
  .object({ date: columnIndex, amount: columnIndex, description: columnIndex })
  .strict()
  .openapi('ImportColumnMapping');

export const dateFormatSchema = z.enum(DATE_FORMATS).openapi('ImportDateFormat');

/**
 * Fields that accompany the uploaded `file` on both routes (the route parses the multipart text fields,
 * `mapping` arrives as JSON, then validates with this schema). Without `mapping` the preview only
 * returns headers and a suggested mapping.
 *
 * Assumption A-1 (plan R-2): amounts are signed in the file, SPEC-005 stores them positive with the
 * direction taken from the category kind, so a negative row needs `expenseCategoryId` and a positive
 * row needs `incomeCategoryId`; a row without its category is reported invalid.
 */
export const importRequestSchema = z
  .object({
    accountId: id,
    mapping: columnMappingSchema.optional(),
    dateFormat: dateFormatSchema.optional(),
    expenseCategoryId: id.optional(),
    incomeCategoryId: id.optional(),
  })
  .strict()
  .openapi('ImportRequest');

/** Commit requires the full set; the shared base is reused so preview and commit cannot drift. */
export const commitRequestSchema = importRequestSchema
  .required({ mapping: true, dateFormat: true })
  .openapi('ImportCommitRequest');

const invalidRowSchema = z.object({ line: z.number().int().min(1), reason: z.string() }).openapi('ImportInvalidRow');

const previewRowSchema = z
  .object({
    line: z.number().int().min(1),
    date: z.string(),
    amountMinor: z.number().int(),
    description: z.string(),
  })
  .openapi('ImportPreviewRow');

export const previewResponseSchema = z
  .object({
    headers: z.array(z.string()),
    hasHeader: z.boolean(),
    suggestedMapping: columnMappingSchema.nullable(),
    rowCount: z.number().int().min(0),
    validCount: z.number().int().min(0),
    invalidCount: z.number().int().min(0),
    validRows: z.array(previewRowSchema).max(20),
    invalidRows: z.array(invalidRowSchema),
  })
  .strict()
  .openapi('ImportPreviewResponse');

export const commitResponseSchema = z
  .object({
    imported: z.number().int().min(0),
    skipped: z.number().int().min(0),
    invalid: z.number().int().min(0),
    invalidRows: z.array(invalidRowSchema),
  })
  .strict()
  .openapi('ImportCommitResponse');

export type ColumnMappingInput = z.infer<typeof columnMappingSchema>;
export type ImportRequest = z.infer<typeof importRequestSchema>;
export type CommitRequest = z.infer<typeof commitRequestSchema>;
export type PreviewResponse = z.infer<typeof previewResponseSchema>;
export type CommitResponse = z.infer<typeof commitResponseSchema>;

/** Registry the OpenAPI document (and the T-007 test) reads the import contract from. */
export const importOpenApiRegistry = new OpenAPIRegistry();
importOpenApiRegistry.register('ImportColumnMapping', columnMappingSchema);
importOpenApiRegistry.register('ImportDateFormat', dateFormatSchema);
importOpenApiRegistry.register('ImportRequest', importRequestSchema);
importOpenApiRegistry.register('ImportCommitRequest', commitRequestSchema);
importOpenApiRegistry.register('ImportPreviewResponse', previewResponseSchema);
importOpenApiRegistry.register('ImportCommitResponse', commitResponseSchema);
