import type { SubProject } from './types';

/** Summe der jeweils günstigsten Position über alle Vergleichsgruppen eines Bereichs. */
export function cheapestTotalForSubProject(sp: SubProject): number {
  let total = 0;
  for (const group of sp.groups) {
    const totals = Object.entries(group.assignments)
      .map(([offerId, rowId]) => sp.offers.find((o) => o.id === offerId)?.rows.find((r) => r.id === rowId)?.totalPrice)
      .filter((v): v is number => v != null);
    if (totals.length) total += Math.min(...totals);
  }
  return total;
}
