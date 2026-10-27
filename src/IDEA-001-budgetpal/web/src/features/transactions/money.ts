/**
 * Money input helpers (D-13, GR-007): amounts are integer minor units. Decimal text is converted by
 * string math, never through a float, so `12.50` is exactly `1250`.
 */

/** Largest amount in minor units; the api rejects anything beyond it. */
export const MAX_AMOUNT_MINOR = 999_999_999_999;

function installCurrency(): string {
  const configured = (import.meta.env.VITE_CURRENCY as string | undefined)?.trim().toUpperCase();
  return configured && /^[A-Z]{3}$/.test(configured) ? configured : 'USD';
}

/** Number of minor-unit digits of the install currency (2 for USD, 0 for JPY), from `Intl`. */
export function minorDigits(currency: string = installCurrency()): number {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
}

/**
 * Parses positive decimal text (`12.50`, `12`, `0.05`, `.5`) into integer minor units. Returns `null` for
 * anything else: blank, signs, letters, more fraction digits than the currency has, zero or too large.
 */
export function parseAmount(text: string, digits: number = minorDigits()): number | null {
  const match = /^(\d*)(?:\.(\d*))?$/.exec(text.trim());
  if (!match) return null;
  const [, whole = '', fraction = ''] = match;
  if (whole === '' && fraction === '') return null;
  if (fraction.length > digits) return null;
  const magnitude = Number(`${whole === '' ? '0' : whole}${fraction.padEnd(digits, '0')}`);
  if (!Number.isSafeInteger(magnitude) || magnitude < 1 || magnitude > MAX_AMOUNT_MINOR) return null;
  return magnitude;
}

/** Integer minor units to plain decimal text for an input value (`1250` -> `12.50`). */
export function formatForInput(minor: number, digits: number = minorDigits()): string {
  const padded = String(Math.abs(minor)).padStart(digits + 1, '0');
  const whole = padded.slice(0, padded.length - digits);
  const fraction = padded.slice(padded.length - digits);
  return `${minor < 0 ? '-' : ''}${whole}${digits > 0 ? `.${fraction}` : ''}`;
}
