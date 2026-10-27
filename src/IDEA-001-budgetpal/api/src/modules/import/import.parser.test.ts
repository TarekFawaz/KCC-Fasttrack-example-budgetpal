import { describe, expect, it } from 'vitest';
import { dedupeKey, normaliseDescription } from './import.dedupe.js';
import { ImportError, MAX_DATA_ROWS, MAX_FILE_BYTES, parseCsv } from './import.parser.js';
import { parseAmountMinor, parseDate, suggestMapping, validateRow, type ColumnMapping } from './import.rows.js';
import {
  columnMappingSchema,
  commitRequestSchema,
  commitResponseSchema,
  importOpenApiRegistry,
  importRequestSchema,
  previewResponseSchema,
} from './import.schemas.js';

const bytes = (text: string): Uint8Array => new TextEncoder().encode(text);
const mapping: ColumnMapping = { date: 0, amount: 1, description: 2 };

describe('T-001 parseCsv reads RFC 4180 text (Enabler-001 AC-1)', () => {
  it('T-001 quoted commas and quotes, CRLF, header detected', () => {
    const parsed = parseCsv(bytes('Date,Amount,Description\r\n2026-03-01,-12.50,"Coffee, ""large"""\r\n2026-03-02,5,Tip\r\n'));
    expect(parsed.hasHeader).toBe(true);
    expect(parsed.headers).toEqual(['Date', 'Amount', 'Description']);
    expect(parsed.rows).toEqual([
      { line: 2, cells: ['2026-03-01', '-12.50', 'Coffee, "large"'] },
      { line: 3, cells: ['2026-03-02', '5', 'Tip'] },
    ]);
  });

  it('T-001 strips a BOM and handles an empty file', () => {
    const withBom = new Uint8Array([0xef, 0xbb, 0xbf, ...bytes('Date,Amount,Description\n2026-03-01,1,x\n')]);
    expect(parseCsv(withBom).headers[0]).toBe('Date');
    expect(parseCsv(bytes(''))).toEqual({ headers: [], hasHeader: false, rows: [] });
  });

  it('T-001 a file with no header row gets generated column names and keeps its first row', () => {
    const parsed = parseCsv(bytes('2026-03-01,-12.50,Coffee\n2026-03-02,5,Tip\n'));
    expect(parsed.hasHeader).toBe(false);
    expect(parsed.headers).toEqual(['Column 1', 'Column 2', 'Column 3']);
    expect(parsed.rows.map((row) => row.line)).toEqual([1, 2]);
  });

  it('T-001 reports the line a record starts on when a cell holds a line break', () => {
    const parsed = parseCsv(bytes('Date,Amount,Description\n2026-03-01,1,"a\nb"\n\n2026-03-02,2,c\n'));
    expect(parsed.rows.map((row) => row.line)).toEqual([2, 5]);
  });
});

describe('T-002 parseCsv enforces the caps (Enabler-001 AC-2)', () => {
  const expectImportError = (run: () => unknown, code: string): void => {
    try {
      run();
    } catch (error) {
      expect(error).toBeInstanceOf(ImportError);
      expect((error as ImportError).status).toBe(400);
      expect((error as ImportError).code).toBe(code);
      return;
    }
    throw new Error(`expected ImportError ${code}`);
  };

  it('T-002 more than 5000 data rows', () => {
    const rows = Array.from({ length: MAX_DATA_ROWS + 1 }, (_, i) => `2026-03-01,${i + 1},row ${i}`).join('\n');
    expectImportError(() => parseCsv(bytes(`Date,Amount,Description\n${rows}\n`)), 'too_many_rows');
  });

  it('T-002 exactly 5000 data rows is accepted', () => {
    const rows = Array.from({ length: MAX_DATA_ROWS }, (_, i) => `2026-03-01,${i + 1},row ${i}`).join('\n');
    expect(parseCsv(bytes(`Date,Amount,Description\n${rows}\n`)).rows).toHaveLength(MAX_DATA_ROWS);
  });

  it('T-002 more than 5 MB', () => {
    expectImportError(() => parseCsv(new Uint8Array(MAX_FILE_BYTES + 1)), 'file_too_large');
  });

  it('T-002 invalid UTF-8', () => {
    expectImportError(() => parseCsv(new Uint8Array([0x44, 0xff, 0xfe, 0x0a])), 'invalid_encoding');
  });

  it('T-002 malformed quoting never leaks file content in the message', () => {
    try {
      parseCsv(bytes('Date,Amount,Description\n2026-03-01,1,"secret payee\n'));
    } catch (error) {
      expect((error as ImportError).code).toBe('malformed_csv');
      expect((error as ImportError).message).not.toContain('secret');
      return;
    }
    throw new Error('expected malformed_csv');
  });
});

describe('T-003 dates (Enabler-001 AC-3)', () => {
  it('T-003 ISO, DD/MM/YYYY and MM/DD/YYYY become YYYY-MM-DD', () => {
    expect(parseDate('2026-03-05', 'YYYY-MM-DD')).toBe('2026-03-05');
    expect(parseDate('05/03/2026', 'DD/MM/YYYY')).toBe('2026-03-05');
    expect(parseDate('03/05/2026', 'MM/DD/YYYY')).toBe('2026-03-05');
    expect(parseDate('5/3/2026', 'DD/MM/YYYY')).toBe('2026-03-05');
    expect(parseDate('29/02/2028', 'DD/MM/YYYY')).toBe('2028-02-29');
  });

  it('T-003 31/02 and a wrong format are invalid', () => {
    expect(parseDate('31/02/2026', 'DD/MM/YYYY')).toBeUndefined();
    expect(parseDate('29/02/2027', 'DD/MM/YYYY')).toBeUndefined();
    expect(parseDate('13/01/2026', 'MM/DD/YYYY')).toBeUndefined();
    expect(parseDate('2026-03-05', 'DD/MM/YYYY')).toBeUndefined();
    expect(parseDate('05/03/2026', 'YYYY-MM-DD')).toBeUndefined();
  });

  it('T-003 a row yields date, amount and description, or its 1-based line', () => {
    expect(validateRow(['05/03/2026', '-12.50', ' Coffee '], 7, mapping, 'DD/MM/YYYY')).toEqual({
      ok: true,
      line: 7,
      date: '2026-03-05',
      amountMinor: -1250,
      description: 'Coffee',
    });
    const bad = validateRow(['31/02/2026', '1', 'x'], 9, mapping, 'DD/MM/YYYY');
    expect(bad).toMatchObject({ ok: false, line: 9 });
  });
});

describe('T-004 amounts convert exactly (Enabler-001 AC-4)', () => {
  it.each([
    ['-12.50', -1250],
    ['12,5', 1250],
    ['1000', 100000],
    ['+0.07', 7],
    ['0,99', 99],
    ['19.99', 1999],
    ['1.1', 110],
    ['9999999999.99', 999_999_999_999],
  ])('T-004 %s -> %i', (text, expected) => {
    expect(parseAmountMinor(text)).toBe(expected);
  });

  it('T-004 values that float arithmetic would get wrong stay exact', () => {
    expect(parseAmountMinor('0.29')).toBe(29);
    expect(parseAmountMinor('1.15')).toBe(115);
    expect(parseAmountMinor('4.35')).toBe(435);
  });
});

describe('T-005 invalid amounts and descriptions (Enabler-001 AC-4)', () => {
  it.each(['1.234', 'abc', '1.234,56', '1,234.56', '', '12.', '.5', '1e3', '0', '0.00', '-0', '10000000000'])(
    'T-005 amount %j is invalid',
    (text) => {
      expect(parseAmountMinor(text)).toBeUndefined();
    },
  );

  it('T-005 empty or long description, missing column', () => {
    expect(validateRow(['2026-03-01', '1', '   '], 3, mapping, 'YYYY-MM-DD')).toMatchObject({ ok: false, line: 3 });
    expect(validateRow(['2026-03-01', '1', 'x'.repeat(201)], 4, mapping, 'YYYY-MM-DD')).toMatchObject({ ok: false });
    expect(validateRow(['2026-03-01', '1', 'x'.repeat(200)], 4, mapping, 'YYYY-MM-DD')).toMatchObject({ ok: true });
    expect(validateRow(['2026-03-01', '1'], 5, mapping, 'YYYY-MM-DD')).toMatchObject({ ok: false, line: 5 });
  });

  it('T-005 a formula in a description is kept as plain text', () => {
    expect(validateRow(['2026-03-01', '1', '=SUM(A1)'], 2, mapping, 'YYYY-MM-DD')).toMatchObject({
      ok: true,
      description: '=SUM(A1)',
    });
  });

  it('T-005 suggests a mapping from header names', () => {
    expect(suggestMapping(['Posted', 'Payee', 'Amount'])).toEqual({ date: 0, amount: 2, description: 1 });
    expect(suggestMapping(['a', 'b'])).toBeUndefined();
  });
});

describe('T-006 dedupe key (Enabler-001 AC-5)', () => {
  const base = { userId: 1, accountId: 2, date: '2026-03-01', amountMinor: -1250, description: 'Coffee Shop' };

  it('T-006 equal for case and whitespace variants, 64 hex characters', () => {
    const key = dedupeKey(base);
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(dedupeKey({ ...base, description: '  coffee   SHOP ' })).toBe(key);
    expect(normaliseDescription('  A \t B\n')).toBe('a b');
  });

  it('T-006 differs when user, account, date, amount or description changes', () => {
    const key = dedupeKey(base);
    for (const change of [
      { userId: 2 },
      { accountId: 3 },
      { date: '2026-03-02' },
      { amountMinor: 1250 },
      { description: 'Coffee Shops' },
    ]) {
      expect(dedupeKey({ ...base, ...change })).not.toBe(key);
    }
  });

  it('T-006 field boundaries cannot be shifted to forge a match', () => {
    expect(dedupeKey({ ...base, userId: 1, accountId: 23 })).not.toBe(dedupeKey({ ...base, userId: 12, accountId: 3 }));
  });
});

describe('T-007 contract schemas (Enabler-001 AC-6)', () => {
  it('T-007 request schemas reject extra fields', () => {
    expect(importRequestSchema.safeParse({ accountId: 1, extra: true }).success).toBe(false);
    expect(columnMappingSchema.safeParse({ date: 0, amount: 1, description: 2, x: 3 }).success).toBe(false);
    expect(importRequestSchema.safeParse({ accountId: 1 }).success).toBe(true);
    expect(importRequestSchema.safeParse({ accountId: 0 }).success).toBe(false);
    expect(importRequestSchema.safeParse({ accountId: 1, mapping: { date: -1, amount: 1, description: 2 } }).success).toBe(
      false,
    );
    expect(importRequestSchema.safeParse({ accountId: 1, dateFormat: 'YYYY/DD/MM' }).success).toBe(false);
  });

  it('T-007 commit needs mapping and date format', () => {
    expect(commitRequestSchema.safeParse({ accountId: 1 }).success).toBe(false);
    expect(
      commitRequestSchema.safeParse({ accountId: 1, mapping, dateFormat: 'YYYY-MM-DD', expenseCategoryId: 4 }).success,
    ).toBe(true);
  });

  it('T-007 response schemas parse samples and reject extra keys', () => {
    const preview = {
      headers: ['Date', 'Amount', 'Description'],
      hasHeader: true,
      suggestedMapping: mapping,
      rowCount: 2,
      validCount: 1,
      invalidCount: 1,
      validRows: [{ line: 2, date: '2026-03-01', amountMinor: -1250, description: 'Coffee' }],
      invalidRows: [{ line: 3, reason: 'Description is empty' }],
    };
    expect(previewResponseSchema.parse(preview)).toEqual(preview);
    expect(previewResponseSchema.safeParse({ ...preview, extra: 1 }).success).toBe(false);
    const commit = { imported: 1, skipped: 2, invalid: 1, invalidRows: [{ line: 3, reason: 'x' }] };
    expect(commitResponseSchema.parse(commit)).toEqual(commit);
    expect(commitResponseSchema.safeParse({ imported: 1.5, skipped: 0, invalid: 0, invalidRows: [] }).success).toBe(
      false,
    );
  });

  it('T-007 the schemas are registered for OpenAPI', () => {
    type Named = { _def: { openapi?: { _internal?: { refId?: string } } } };
    const names = importOpenApiRegistry.definitions.map((definition) =>
      definition.type === 'schema' ? (definition.schema as unknown as Named)._def.openapi?._internal?.refId : undefined,
    );
    expect(names).toEqual(
      expect.arrayContaining(['ImportRequest', 'ImportCommitRequest', 'ImportPreviewResponse', 'ImportCommitResponse']),
    );
  });
});
