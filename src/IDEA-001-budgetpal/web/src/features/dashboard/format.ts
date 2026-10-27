/**
 * Display helpers of the dashboard (D-13, GR-007): amounts are integer minor units and are formatted from
 * the exact decimal text through `Intl`, never through a float. Shares are integer math (per mille).
 */

/** Number of minor-unit digits of a currency (2 for USD, 0 for JPY, 3 for KWD), from `Intl`. */
function minorDigits(currency: string): number {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
}

/** Money text in the response `currency`, formatted from the exact decimal string. */
export function formatMoney(minor: number, currency: string): string {
  const digits = minorDigits(currency);
  const padded = String(Math.abs(minor)).padStart(digits + 1, '0');
  const whole = padded.slice(0, padded.length - digits);
  const fraction = padded.slice(padded.length - digits);
  const decimal = `${minor < 0 ? '-' : ''}${whole}${digits > 0 ? `.${fraction}` : ''}`;
  // Intl.NumberFormat v3 formats a decimal string exactly; the cast only satisfies the older lib typing.
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(decimal as unknown as number);
}

/**
 * Shares in tenths of a percent (`1000` is 100.0%) for each amount, by the largest-remainder method so the
 * shares of a non-zero total add up to exactly 1000. A zero total gives all zeros (no division by zero).
 */
export function sharePermille(amounts: readonly number[], total: number): number[] {
  if (total <= 0) return amounts.map(() => 0);
  const base = amounts.map((amount) => Math.floor((amount * 1000) / total));
  let missing = 1000 - base.reduce((sum, value) => sum + value, 0);
  const order = amounts
    .map((amount, index) => ({ index, remainder: (amount * 1000) % total }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (const { index } of order) {
    if (missing <= 0) break;
    base[index] = (base[index] ?? 0) + 1;
    missing -= 1;
  }
  return base;
}

/** Tenths of a percent as text (`333` -> `33.3%`), built from integers. */
export function formatPermille(permille: number): string {
  return `${Math.floor(permille / 10)}.${permille % 10}%`;
}

/** `YYYY-MM` of a date in local time (the month picker default). */
export function currentMonth(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
