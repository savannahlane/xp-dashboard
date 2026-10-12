import Decimal from "decimal.js";
import { ONE, ZERO } from "@/lib/money";

/** Annual targets from CFG.targets. Pace applies to these ratios, not to net ARR change. */
export const ANNUAL_GRR_TARGET = new Decimal("0.94");
export const ANNUAL_NRR_RATIO_TARGET = new Decimal("1.06");

/** The Account Team README describes a weekly refresh. Older than this is stale. */
export const WEEKLY_REFRESH_DAYS = 7;

export function utcDayNumber(iso: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

export function daysBetween(start: string, end: string): number | null {
  const a = utcDayNumber(start);
  const b = utcDayNumber(end);
  if (a === null || b === null) return null;
  return b - a;
}

export type Freshness = {
  asOf: string;
  ageDays: number | null;
  stale: boolean;
};

export function freshness(generated: string, today: string): Freshness {
  const ageDays = daysBetween(generated, today);
  return {
    asOf: generated,
    ageDays,
    stale: ageDays !== null && ageDays > WEEKLY_REFRESH_DAYS,
  };
}

export type Pace = {
  fraction: Decimal;
  grr: Decimal;
  nrrRatio: Decimal;
};

/**
 * YTD pace from the existing dashboard.
 * fraction = days in the measurement window / 365
 * NRR pace = 1 + (annual NRR target − 1) × fraction
 * GRR pace = 1 − (1 − annual GRR target) × fraction
 */
export function pace(periodStart: string, periodEnd: string): Pace | null {
  const days = daysBetween(periodStart, periodEnd);
  if (days === null || days < 0) return null;
  const fraction = Decimal.min(ONE, Decimal.max(ZERO, new Decimal(days).div(365)));
  return {
    fraction,
    nrrRatio: ONE.plus(ANNUAL_NRR_RATIO_TARGET.minus(ONE).mul(fraction)),
    grr: ONE.minus(ONE.minus(ANNUAL_GRR_TARGET).mul(fraction)),
  };
}

/** Green at or above pace, amber within one point, red below. Matches `vsPace`. */
export function paceBand(value: Decimal, target: Decimal): "pos" | "warn" | "neg" {
  if (value.gte(target)) return "pos";
  if (value.lt(target.minus("0.01"))) return "neg";
  return "warn";
}
