/**
 * Money helpers (D-13, GR-007): amounts are integer minor units. Decimal text is converted by string
 * math, never through a float, so `1234.50` is exactly `123450`.
 */

/** Largest absolute opening balance in minor units; the api rejects anything beyond it (10^12). */
export const MAX_MINOR = 1_000_000_000_000;

/**
 * The install currency (one ISO 4217 code per install, D-13). The web build reads `VITE_CURRENCY`;
 * `USD` is the same default the api uses for `CURRENCY`.
 */
export function installCurrency(): string {
  const configured = (import.meta.env.VITE_CURRENCY as string | undefined)?.trim().toUpperCase();
  return configured && /^[A-Z]{3}$/.test(configured) ? configured : 'USD';
}

/** Number of minor-unit digits of a currency (2 for USD, 0 for JPY, 3 for KWD), from `Intl`. */
export function minorDigits(currency: string = installCurrency()): number {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
}

/**
 * Parses decimal text (`1234.50`, `-20`, `0.1`, `.5`) into integer minor units. Returns `null` for text that
 * is not a plain decimal, has more fraction digits than the currency allows (`1.234` for 2 digits) or is
 * beyond the supported range. Blank text is not a number (`null`); the caller decides what blank means.
 */
export function toMinorUnits(text: string, digits: number = minorDigits()): number | null {
  const match = /^([+-])?(\d*)(?:\.(\d*))?$/.exec(text.trim());
  if (!match) return null;
  const [, sign, whole = '', fraction = ''] = match;
  if (whole === '' && fraction === '') return null;
  if (fraction.length > digits) return null;
  const magnitude = Number(`${whole === '' ? '0' : whole}${fraction.padEnd(digits, '0')}`);
  if (!Number.isSafeInteger(magnitude) || magnitude > MAX_MINOR) return null;
  return sign === '-' && magnitude !== 0 ? -magnitude : magnitude;
}

/** Integer minor units to plain decimal text (`123450` -> `1234.50`), for an input value or for `Intl`. */
export function fromMinorUnits(minor: number, digits: number = minorDigits()): string {
  const negative = minor < 0;
  const padded = String(Math.abs(minor)).padStart(digits + 1, '0');
  const whole = padded.slice(0, padded.length - digits);
  const fraction = padded.slice(padded.length - digits);
  return `${negative ? '-' : ''}${whole}${digits > 0 ? `.${fraction}` : ''}`;
}

/** Display text in the install currency (`Intl`), formatted from the exact decimal string. */
export function formatMoney(minor: number, currency: string = installCurrency()): string {
  const digits = minorDigits(currency);
  // Intl.NumberFormat v3 formats a decimal string exactly; the cast only satisfies the older lib typing.
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(
    fromMinorUnits(minor, digits) as unknown as number,
  );
}
