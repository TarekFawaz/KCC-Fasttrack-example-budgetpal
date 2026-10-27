import { parse } from 'csv-parse/sync';

/** Upload caps (D-14). */
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_DATA_ROWS = 5000;

export type ImportErrorCode = 'file_too_large' | 'too_many_rows' | 'invalid_encoding' | 'malformed_csv';

/**
 * A rejected upload. Always maps to HTTP 400 problem+json; the message is safe to send to the client
 * and never contains file content (GR-008).
 */
export class ImportError extends Error {
  readonly status = 400;
  readonly code: ImportErrorCode;
  constructor(code: ImportErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ImportError';
    this.code = code;
  }
}

/** One data row with the 1-based line of the file on which the record starts. */
export interface CsvRow {
  line: number;
  cells: string[];
}

export interface ParsedCsv {
  /** Header names; `Column 1..n` when the file has no header row. */
  headers: string[];
  hasHeader: boolean;
  rows: CsvRow[];
}

// A first row is a header unless one of its cells looks like data: a number or a date.
const LOOKS_LIKE_DATA = /^[+-]?\d+([.,]\d+)?$|^\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}$/;

const detectHeader = (first: string[]): boolean =>
  first.length > 0 && first.every((cell) => !LOOKS_LIKE_DATA.test(cell.trim()));

function decodeUtf8(bytes: Uint8Array): string {
  try {
    // `fatal` throws on any invalid sequence; the BOM is stripped by default (`ignoreBOM: false`).
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes);
  } catch (cause) {
    throw new ImportError('invalid_encoding', 'The file is not valid UTF-8.', { cause });
  }
}

/**
 * Parses RFC 4180 text from an in-memory upload. Caps are enforced before and after parsing:
 * 5 MB, 5000 data rows, strict UTF-8. Rows keep their own column count; the row validator reports
 * a row with too few columns by line, so a ragged row is not a file-level error.
 */
export function parseCsv(input: Uint8Array): ParsedCsv {
  if (input.byteLength > MAX_FILE_BYTES) {
    throw new ImportError('file_too_large', 'The file is larger than 5 MB.');
  }
  let text = decodeUtf8(input);
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // BOM that survived a double-encoded file

  let records: Array<{ record: string[]; info: { lines: number } }>;
  try {
    records = parse(text, {
      info: true,
      skip_empty_lines: true,
      relax_column_count: true,
      bom: true,
    }) as typeof records;
  } catch (cause) {
    throw new ImportError('malformed_csv', 'The file is not well-formed CSV.', { cause });
  }

  const [first, ...rest] = records;
  if (first === undefined) return { headers: [], hasHeader: false, rows: [] };

  const hasHeader = detectHeader(first.record);
  const dataRecords = hasHeader ? rest : records;
  if (dataRecords.length > MAX_DATA_ROWS) {
    throw new ImportError('too_many_rows', 'The file has more than 5000 rows.');
  }

  const width = Math.max(...records.map((entry) => entry.record.length));
  const headers = hasHeader ? first.record : Array.from({ length: width }, (_, index) => `Column ${index + 1}`);

  const rows = dataRecords.map(({ record, info }) => {
    // csv-parse reports the line on which the record ends; quoted line breaks move it down.
    const embeddedBreaks = record.reduce((sum, cell) => sum + (cell.match(/\n/g)?.length ?? 0), 0);
    return { line: info.lines - embeddedBreaks, cells: record };
  });
  return { headers, hasHeader, rows };
}
