import Decimal from "decimal.js";
import { ONE, ZERO, dec } from "@/lib/money";

export type ProductSnapshot = {
  accountId: string;
  product: string;
  startingArr: Decimal;
  endingArr: Decimal;
};

export type Movement =
  | "churn"
  | "contraction"
  | "expansion"
  | "unchanged"
  | "new_product"
  | "none";

export type RateValue =
  | { status: "value"; value: Decimal }
  | { status: "zero_denominator" }
  | { status: "excluded"; reason: "no_starting_arr" };

export type ProductRetention = {
  accountId: string;
  product: string;
  startingArr: Decimal;
  endingArr: Decimal;
  retainedArr: Decimal;
  inStartingCohort: boolean;
  grossRetention: RateValue;
  movement: Movement;
};

export type CohortRollup = {
  startingArr: Decimal;
  endingArr: Decimal;
  retainedArr: Decimal;
  grossRetention: RateValue;
  netArrChangeRate: RateValue;
  nrrRatio: RateValue;
  inStartingCohort: boolean;
  churnArr: Decimal;
  contractionArr: Decimal;
  expansionArr: Decimal;
  newProductArr: Decimal;
};

/**
 * Sum duplicate rows for the same account and product before retention math.
 * Identity is the documented product column, trimmed. Different strings are different products.
 */
export function consolidateProducts(rows: ProductSnapshot[]): ProductSnapshot[] {
  const grouped = new Map<string, ProductSnapshot>();
  for (const row of rows) {
    const product = row.product.trim();
    const key = `${row.accountId}\0${product}`;
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, {
        accountId: row.accountId,
        product,
        startingArr: row.startingArr,
        endingArr: row.endingArr,
      });
    } else {
      existing.startingArr = existing.startingArr.plus(row.startingArr);
      existing.endingArr = existing.endingArr.plus(row.endingArr);
    }
  }
  return [...grouped.values()];
}

function movementOf(starting: Decimal, ending: Decimal, inCohort: boolean): Movement {
  if (!inCohort && ending.gt(0)) return "new_product";
  if (!inCohort) return "none";
  if (ending.lte(0)) return "churn";
  if (ending.lt(starting)) return "contraction";
  if (ending.gt(starting)) return "expansion";
  return "unchanged";
}

function grossRatio(retained: Decimal, starting: Decimal): RateValue {
  if (starting.lte(0)) return { status: "zero_denominator" };
  const raw = retained.div(starting);
  const capped = Decimal.min(ONE, Decimal.max(ZERO, raw));
  return { status: "value", value: capped };
}

function changeRatio(numerator: Decimal, denominator: Decimal): RateValue {
  if (denominator.lte(0)) return { status: "zero_denominator" };
  return { status: "value", value: numerator.div(denominator) };
}

export function retainProduct(line: ProductSnapshot): ProductRetention {
  const inStartingCohort = line.startingArr.gt(0);
  const endingForRetain = Decimal.max(line.endingArr, ZERO);
  const retainedArr = inStartingCohort
    ? Decimal.min(line.startingArr, endingForRetain)
    : ZERO;
  return {
    accountId: line.accountId,
    product: line.product,
    startingArr: line.startingArr,
    endingArr: line.endingArr,
    retainedArr,
    inStartingCohort,
    grossRetention: inStartingCohort
      ? grossRatio(retainedArr, line.startingArr)
      : { status: "excluded", reason: "no_starting_arr" },
    movement: movementOf(line.startingArr, line.endingArr, inStartingCohort),
  };
}

export function rollupProducts(lines: ProductRetention[]): CohortRollup {
  let startingArr = ZERO;
  let endingArr = ZERO;
  let retainedArr = ZERO;
  let churnArr = ZERO;
  let contractionArr = ZERO;
  let expansionArr = ZERO;
  let newProductArr = ZERO;

  for (const line of lines) {
    startingArr = startingArr.plus(line.startingArr);
    endingArr = endingArr.plus(line.endingArr);
    if (line.inStartingCohort) retainedArr = retainedArr.plus(line.retainedArr);
    if (line.movement === "churn") churnArr = churnArr.plus(line.startingArr);
    if (line.movement === "contraction") {
      contractionArr = contractionArr.plus(line.startingArr.minus(Decimal.max(line.endingArr, ZERO)));
    }
    if (line.movement === "expansion") {
      expansionArr = expansionArr.plus(line.endingArr.minus(line.startingArr));
    }
    if (line.movement === "new_product") newProductArr = newProductArr.plus(line.endingArr);
  }

  if (startingArr.lte(0)) {
    const excluded: RateValue = { status: "excluded", reason: "no_starting_arr" };
    return {
      startingArr,
      endingArr,
      retainedArr,
      grossRetention: excluded,
      netArrChangeRate: excluded,
      nrrRatio: excluded,
      inStartingCohort: false,
      churnArr,
      contractionArr,
      expansionArr,
      newProductArr,
    };
  }

  return {
    startingArr,
    endingArr,
    retainedArr,
    grossRetention: grossRatio(retainedArr, startingArr),
    netArrChangeRate: changeRatio(endingArr.minus(startingArr), startingArr),
    nrrRatio: changeRatio(endingArr, startingArr),
    inStartingCohort: true,
    churnArr,
    contractionArr,
    expansionArr,
    newProductArr,
  };
}

/**
 * Book-level rates from account rollups. New-logo accounts (no starting ARR) are omitted.
 * Gross and net use summed dollars, not an average of account rates.
 */
export function rollupAccounts(accounts: CohortRollup[]): CohortRollup {
  const cohort = accounts.filter((account) => account.inStartingCohort);
  let startingArr = ZERO;
  let endingArr = ZERO;
  let retainedArr = ZERO;
  let churnArr = ZERO;
  let contractionArr = ZERO;
  let expansionArr = ZERO;
  let newProductArr = ZERO;
  for (const account of cohort) {
    startingArr = startingArr.plus(account.startingArr);
    endingArr = endingArr.plus(account.endingArr);
    retainedArr = retainedArr.plus(account.retainedArr);
    churnArr = churnArr.plus(account.churnArr);
    contractionArr = contractionArr.plus(account.contractionArr);
    expansionArr = expansionArr.plus(account.expansionArr);
    newProductArr = newProductArr.plus(account.newProductArr);
  }
  if (startingArr.lte(0)) {
    const excluded: RateValue = { status: "zero_denominator" };
    return {
      startingArr,
      endingArr,
      retainedArr,
      grossRetention: excluded,
      netArrChangeRate: excluded,
      nrrRatio: excluded,
      inStartingCohort: false,
      churnArr,
      contractionArr,
      expansionArr,
      newProductArr,
    };
  }
  return {
    startingArr,
    endingArr,
    retainedArr,
    grossRetention: grossRatio(retainedArr, startingArr),
    netArrChangeRate: changeRatio(endingArr.minus(startingArr), startingArr),
    nrrRatio: changeRatio(endingArr, startingArr),
    inStartingCohort: true,
    churnArr,
    contractionArr,
    expansionArr,
    newProductArr,
  };
}

export function productLinesFromRows(
  rows: { accountId: string; product: string; startingArr: Decimal.Value; endingArr: Decimal.Value }[],
): ProductRetention[] {
  return consolidateProducts(
    rows.map((row) => ({
      accountId: row.accountId,
      product: row.product,
      startingArr: dec(row.startingArr),
      endingArr: dec(row.endingArr),
    })),
  ).map(retainProduct);
}
