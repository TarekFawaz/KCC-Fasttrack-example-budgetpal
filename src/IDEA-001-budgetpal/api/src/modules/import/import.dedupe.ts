import { createHash } from 'node:crypto';

/** Trim, collapse inner whitespace runs to one space, lowercase. */
export const normaliseDescription = (description: string): string =>
  description.normalize('NFC').trim().replace(/\s+/gu, ' ').toLowerCase();

export interface DedupeParts {
  userId: number;
  accountId: number;
  /** `YYYY-MM-DD` */
  date: string;
  /** Signed minor units, so a refund and a purchase of the same size are different rows. */
  amountMinor: number;
  description: string;
}

/** sha256 hex over `user_id|account_id|date|amount_minor|normalised description` (D-14). */
export function dedupeKey(parts: DedupeParts): string {
  const text = [parts.userId, parts.accountId, parts.date, parts.amountMinor, normaliseDescription(parts.description)].join('|');
  return createHash('sha256').update(text, 'utf8').digest('hex');
}
