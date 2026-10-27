export type BudgetStatus = 'ok' | 'warning' | 'over';

const assertMinor = (name: string, value: number): void => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative safe integer (minor units)`);
  }
};

/**
 * Status of a category's spending against its budget, in integer minor units.
 *
 * - `ok`      below 80%      (spent * 5 <  budget * 4)
 * - `warning` 80% to 100%    (spent <= budget), both ends included
 * - `over`    above 100%     (spent > budget)
 *
 * BigInt keeps `spent * 5` exact for any safe integer; the rounded display percent is never used here.
 */
export function budgetStatus(spentMinor: number, budgetMinor: number): BudgetStatus {
  assertMinor('spentMinor', spentMinor);
  assertMinor('budgetMinor', budgetMinor);
  const spent = BigInt(spentMinor);
  const budget = BigInt(budgetMinor);
  if (spent > budget) return 'over';
  if (spent * 5n >= budget * 4n) return 'warning';
  return 'ok';
}
