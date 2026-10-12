import Decimal from "decimal.js";
import { ZERO } from "@/lib/money";

/**
 * Stage values verified in the shipped opportunities feed and the existing engine.
 * Anything else is unrecognized and stays out of the open total.
 */
export const VERIFIED_OPEN_STAGES = ["discovery", "proposal", "negotiation"] as const;
export const VERIFIED_CLOSED_STAGES = ["closed won"] as const;

export type StageClass = "open" | "closed" | "unrecognized";

export function classifyStage(stage: string): StageClass {
  const normalized = stage.trim().toLowerCase();
  if ((VERIFIED_CLOSED_STAGES as readonly string[]).includes(normalized)) return "closed";
  if ((VERIFIED_OPEN_STAGES as readonly string[]).includes(normalized)) return "open";
  return "unrecognized";
}

export type OpportunityTypeClass = "new_business" | "existing_business" | "unrecognized" | "missing";

/** Opportunity.Type. Existing Business is the renewal population. */
export function classifyOpportunityType(value: string | null | undefined): OpportunityTypeClass {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return "missing";
  if (normalized === "new business") return "new_business";
  if (normalized === "existing business") return "existing_business";
  return "unrecognized";
}

export type PipelineOpportunity = {
  opportunityId: string;
  accountId: string;
  stage: string;
  arr: Decimal;
  type: string;
};

export type PipelineRollup = {
  /** Unsplit open pipeline. Measure is opportunities.arr, unweighted. */
  openArr: Decimal;
  openCount: number;
  closedExcludedCount: number;
  unrecognizedCount: number;
  duplicatesCollapsed: number;
  conflictsExcluded: number;
};

type Grouped = PipelineOpportunity & { stageClass: StageClass };

export type OpenTypeSplit = {
  typeColumnPresent: boolean;
  newBusinessArr: Decimal;
  newBusinessCount: number;
  renewalArr: Decimal;
  renewalCount: number;
  unclassifiedOpen: number;
};

/** Open pipeline split by Opportunity.Type. Closed rows and renewal expansion are not inputs. */
export function splitOpenByType(rows: Grouped[]): OpenTypeSplit {
  const typeColumnPresent = rows.some((row) => classifyOpportunityType(row.type) !== "missing");
  let newBusinessArr = ZERO;
  let newBusinessCount = 0;
  let renewalArr = ZERO;
  let renewalCount = 0;
  let unclassifiedOpen = 0;
  if (!typeColumnPresent) {
    return { typeColumnPresent, newBusinessArr, newBusinessCount, renewalArr, renewalCount, unclassifiedOpen };
  }
  for (const row of rows) {
    if (row.stageClass !== "open") continue;
    const kind = classifyOpportunityType(row.type);
    if (kind === "new_business") {
      newBusinessArr = newBusinessArr.plus(row.arr);
      newBusinessCount += 1;
    } else if (kind === "existing_business") {
      renewalArr = renewalArr.plus(row.arr);
      renewalCount += 1;
    } else {
      unclassifiedOpen += 1;
    }
  }
  return { typeColumnPresent, newBusinessArr, newBusinessCount, renewalArr, renewalCount, unclassifiedOpen };
}

/**
 * One row per opportunity id. Conflicting duplicates are excluded rather than summed.
 * Renewal expansion is not an input to this function.
 */
export function rollupOpenPipeline(rows: PipelineOpportunity[]): PipelineRollup {
  const groups = new Map<string, PipelineOpportunity[]>();
  for (const row of rows) {
    const list = groups.get(row.opportunityId) ?? [];
    list.push(row);
    groups.set(row.opportunityId, list);
  }

  let openArr = ZERO;
  let openCount = 0;
  let closedExcludedCount = 0;
  let unrecognizedCount = 0;
  let duplicatesCollapsed = 0;
  let conflictsExcluded = 0;

  for (const list of groups.values()) {
    if (list.length > 1) duplicatesCollapsed += list.length - 1;
    const first = list[0];
    const consistent = list.every(
      (row) =>
        row.arr.eq(first.arr) &&
        row.stage === first.stage &&
        row.accountId === first.accountId &&
        row.type === first.type,
    );
    if (!consistent) {
      conflictsExcluded += 1;
      continue;
    }
    const stageClass = classifyStage(first.stage);
    if (stageClass === "open") {
      openArr = openArr.plus(first.arr);
      openCount += 1;
    } else if (stageClass === "closed") {
      closedExcludedCount += 1;
    } else {
      unrecognizedCount += 1;
    }
  }

  return {
    openArr,
    openCount,
    closedExcludedCount,
    unrecognizedCount,
    duplicatesCollapsed,
    conflictsExcluded,
  };
}

export function dedupedOpportunities<T extends Grouped>(rows: T[]): { kept: T[]; collapsed: number; conflicts: number } {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const list = groups.get(row.opportunityId) ?? [];
    list.push(row);
    groups.set(row.opportunityId, list);
  }
  const kept: T[] = [];
  let collapsed = 0;
  let conflicts = 0;
  for (const list of groups.values()) {
    if (list.length > 1) collapsed += list.length - 1;
    const first = list[0];
    const consistent = list.every(
      (row) =>
        row.arr.eq(first.arr) &&
        row.stage === first.stage &&
        row.accountId === first.accountId &&
        row.stageClass === first.stageClass &&
        row.type === first.type,
    );
    if (!consistent) {
      conflicts += 1;
      continue;
    }
    kept.push(first);
  }
  return { kept, collapsed, conflicts };
}
