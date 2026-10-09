import Decimal from "decimal.js";

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

/** Confirmed currency for converted ARR. */
export const CURRENCY_LABEL = "USD";

export function dec(value: Decimal.Value): Decimal {
  return new Decimal(value);
}

export const ZERO = new Decimal(0);
export const ONE = new Decimal(1);

export function formatMoney(value: Decimal.Value | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const amount = value instanceof Decimal ? value : new Decimal(value);
  const sign = amount.isNeg() ? "−" : "";
  const [whole, frac] = amount.abs().toFixed(2).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}$${grouped}.${frac}`;
}

export type RateStatus =
  | { status: "value"; value: string }
  | { status: "zero_denominator" }
  | { status: "excluded"; reason: "no_starting_arr" }
  | { status: "unavailable" };

export function formatRate(rate: RateStatus, mode: "ratio" | "change" = "ratio"): string {
  if (rate.status === "zero_denominator") return "Undefined (zero starting ARR)";
  if (rate.status === "excluded") return "Excluded (no starting ARR)";
  if (rate.status === "unavailable") return "Unavailable";
  const pct = new Decimal(rate.value).mul(100);
  const body = `${pct.toFixed(1)}%`;
  if (mode === "change" && !pct.isNeg()) return `+${body}`;
  return body;
}

export function moneyToString(value: Decimal): string {
  return value.toFixed(2);
}
