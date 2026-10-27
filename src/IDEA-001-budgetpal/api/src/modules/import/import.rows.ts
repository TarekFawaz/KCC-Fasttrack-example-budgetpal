/**
 * Pure row validation: column mapping, date format and amount to integer minor units.
 * No floating point anywhere: amounts are converted by string arithmetic (GR-007, D-13).
 */

export const DATE_FORMATS = ['YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY'] as const;
export type DateFormat = (typeof DATE_FORMATS)[number];

/** Largest amount in minor units, the same bound SPEC-005 applies (10^12 - 1). */
export const MAX_AMOUNT_MINOR = 999_999_999_999;
export const MAX_DESCRIPTION_LENGTH = 200;

/** Zero-based column index of each field. */
export interface ColumnMapping {
  date: number;
  amount: number;
  description: number;
}

export interface ValidRow {
  line: number;
  date: string;
  /** Signed: negative for money out. Stored as the absolute value; the sign picks the category kind. */
  amountMinor: number;
  description: string;
}

export interface InvalidRow {
  line: number;
  reason: string;
}

export type RowResult = ({ ok: true } & ValidRow) | ({ ok: false } & InvalidRow);

const pad2 = (value: number): string => String(value).padStart(2, '0');

function toIsoDate(year: number, month: number, day: number): string | undefined {
  const date = new Date(Date.UTC(year, month - 1, day));
  const real =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return real ? `${String(year).padStart(4, '0')}-${pad2(month)}-${pad2(day)}` : undefined;
}

/** Converts `text` in `format` to `YYYY-MM-DD`, or `undefined` when it does not match or is not a real date. */
export function parseDate(text: string, format: DateFormat): string | undefined {
  const value = text.trim();
  if (format === 'YYYY-MM-DD') {
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? toIsoDate(Number(m[1]), Number(m[2]), Number(m[3])) : undefined;
  }
  const m = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return undefined;
  const [first, second, year] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return format === 'DD/MM/YYYY' ? toIsoDate(year, second, first) : toIsoDate(year, first, second);
}

// Optional sign, digits, at most one `.` or `,` and one or two decimals. Thousands separators are not guessed.
const AMOUNT = /^([+-])?(\d{1,10})(?:[.,](\d{1,2}))?$/;

/**
 * Converts an amount to signed integer minor units: `-12.50` -> -1250, `12,5` -> 1250, `1000` -> 100000.
 * Returns `undefined` for more than 2 decimals, non-numeric text, zero or a value above the SPEC-005 bound.
 */
export function parseAmountMinor(text: string): number | undefined {
  const m = text.trim().match(AMOUNT);
  if (!m) return undefined;
  const whole = Number(m[2]);
  const fraction = Number((m[3] ?? '').padEnd(2, '0'));
  const minor = whole * 100 + fraction; // integer arithmetic on safe integers
  if (minor === 0 || minor > MAX_AMOUNT_MINOR) return undefined;
  return m[1] === '-' ? -minor : minor;
}

/** Validates one record. `line` is the 1-based file line reported on failure. */
export function validateRow(
  cells: readonly string[],
  line: number,
  mapping: ColumnMapping,
  dateFormat: DateFormat,
): RowResult {
  const need = Math.max(mapping.date, mapping.amount, mapping.description);
  if (cells.length <= need) return { ok: false, line, reason: 'Row has too few columns' };

  const date = parseDate(cells[mapping.date] ?? '', dateFormat);
  if (date === undefined) return { ok: false, line, reason: `Date is not a real date in ${dateFormat} format` };

  const amountMinor = parseAmountMinor(cells[mapping.amount] ?? '');
  if (amountMinor === undefined) {
    return { ok: false, line, reason: 'Amount must be a non-zero number with at most 2 decimals' };
  }

  const description = (cells[mapping.description] ?? '').trim();
  if (description.length === 0) return { ok: false, line, reason: 'Description is empty' };
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    return { ok: false, line, reason: `Description is longer than ${MAX_DESCRIPTION_LENGTH} characters` };
  }
  return { ok: true, line, date, amountMinor, description };
}

const HEADER_HINTS: Record<keyof ColumnMapping, RegExp> = {
  date: /^(date|posted|posting date|transaction date|booking date|value date)$/i,
  amount: /^(amount|sum|value|debit\/credit|total)$/i,
  description: /^(description|memo|details|payee|narrative|reference|note|name)$/i,
};

/** Suggests a mapping from header names; `undefined` when any of the three fields has no match. */
export function suggestMapping(headers: readonly string[]): ColumnMapping | undefined {
  const find = (field: keyof ColumnMapping): number =>
    headers.findIndex((header) => HEADER_HINTS[field].test(header.trim()));
  const mapping = { date: find('date'), amount: find('amount'), description: find('description') };
  return mapping.date >= 0 && mapping.amount >= 0 && mapping.description >= 0 ? mapping : undefined;
}
