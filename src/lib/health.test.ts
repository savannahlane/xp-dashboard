import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import { arrWeightedHealth } from "@/lib/health";

describe("ARR-weighted book health", () => {
  it("weights scores by current ARR instead of averaging them", () => {
    const result = arrWeightedHealth([
      { score: new Decimal(100), arr: new Decimal(100) },
      { score: new Decimal(0), arr: new Decimal(300) },
    ]);
    expect(result.available).toBe(true);
    if (result.available) expect(result.score.toFixed(2)).toBe("25.00");
  });

  it("leaves missing scores out of the average", () => {
    const result = arrWeightedHealth([
      { score: null, arr: new Decimal(500) },
      { score: new Decimal(80), arr: new Decimal(100) },
    ]);
    expect(result.available).toBe(true);
    if (result.available) {
      expect(result.score.toFixed(2)).toBe("80.00");
      expect(result.accounts).toBe(1);
    }
  });

  it("stays unavailable when every score is missing", () => {
    const result = arrWeightedHealth([{ score: null, arr: new Decimal(500) }]);
    expect(result.available).toBe(false);
  });
});
