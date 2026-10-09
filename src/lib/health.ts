import { BLOCKERS, type Blocker } from "@/lib/blockers";

export type BlockedMetric = {
  available: false;
  blocker: Blocker;
};

/** No stored score and no documented formula. Never derives one. */
export function accountHealth(): BlockedMetric {
  return { available: false, blocker: BLOCKERS.accountHealth };
}

/** No stored XP rollup and no approved average. */
export function bookHealth(): BlockedMetric {
  return { available: false, blocker: BLOCKERS.bookHealth };
}
