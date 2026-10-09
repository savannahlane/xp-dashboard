import Decimal from "decimal.js";
import { BLOCKERS, type Blocker } from "@/lib/blockers";
import { ZERO } from "@/lib/money";

export type BlockedMetric = {
  available: false;
  blocker: Blocker;
};

export type BookHealth =
  | BlockedMetric
  | { available: true; score: Decimal; weightArr: Decimal; accounts: number };

/** No stored score and no documented formula. Never derives one. */
export function accountHealth(): BlockedMetric {
  return { available: false, blocker: BLOCKERS.accountHealth };
}

/**
 * Approved book-health rollup: ARR-weighted average of stored account health scores.
 * Weight is current Account Team ARR. Missing scores are left out of both sums.
 * A missing score is not treated as zero, and cec_grade is not converted into a score.
 */
export function arrWeightedHealth(
  rows: { score: Decimal | null; arr: Decimal }[],
): BookHealth {
  let weighted = ZERO;
  let weightArr = ZERO;
  let accounts = 0;
  for (const row of rows) {
    if (row.score === null || row.arr.lte(0)) continue;
    weighted = weighted.plus(row.score.mul(row.arr));
    weightArr = weightArr.plus(row.arr);
    accounts += 1;
  }
  if (accounts === 0 || weightArr.lte(0)) return { available: false, blocker: BLOCKERS.bookHealth };
  return { available: true, score: weighted.div(weightArr), weightArr, accounts };
}
