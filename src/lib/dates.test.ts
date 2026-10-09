import { describe, expect, it } from "vitest";
import { daysBetween, freshness, pace } from "@/lib/dates";

describe("period and freshness", () => {
  it("uses the documented year fraction for FY26 year to date", () => {
    expect(daysBetween("2026-01-01", "2026-09-17")).toBe(259);
    const result = pace("2026-01-01", "2026-09-17");
    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.fraction.toFixed(4)).toBe((259 / 365).toFixed(4));
    expect(result.grr.toFixed(3)).toBe("0.957");
    expect(result.nrrRatio.toFixed(3)).toBe("1.043");
  });

  it("marks a snapshot stale after the documented weekly refresh window", () => {
    expect(freshness("2026-09-17", "2026-09-24").stale).toBe(false);
    expect(freshness("2026-09-17", "2026-09-25").stale).toBe(true);
    expect(freshness("2026-09-17", "2026-10-09")).toMatchObject({ ageDays: 22, stale: true });
  });
});
