import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import { productLinesFromRows, rollupAccounts, rollupProducts } from "@/lib/retention";

function lines(
  rows: { accountId?: string; product: string; startingArr: string; endingArr: string }[],
) {
  return productLinesFromRows(
    rows.map((row) => ({
      accountId: row.accountId ?? "acct",
      product: row.product,
      startingArr: row.startingArr,
      endingArr: row.endingArr,
    })),
  );
}

function expectValue(rate: { status: string; value?: Decimal }, expected: string) {
  expect(rate.status).toBe("value");
  if (rate.status === "value" && rate.value) expect(rate.value.toFixed(6)).toBe(new Decimal(expected).toFixed(6));
}

describe("gross and net retention", () => {
  it("counts a fully churned starting product as zero ending ARR", () => {
    const product = lines([{ product: "Email & SMS", startingArr: "100.00", endingArr: "0" }]);
    expect(product[0].movement).toBe("churn");
    const rollup = rollupProducts(product);
    expect(rollup.retainedArr.toFixed(2)).toBe("0.00");
    expect(rollup.churnArr.toFixed(2)).toBe("100.00");
    expectValue(rollup.grossRetention, "0");
    expectValue(rollup.netArrChangeRate, "-1");
    expectValue(rollup.nrrRatio, "0");
    expect(rollup.inStartingCohort).toBe(true);
  });

  it("reduces gross retention on a partial downgrade and does not cap net below the loss", () => {
    const rollup = rollupProducts(lines([{ product: "Agenda & Video", startingArr: "100.10", endingArr: "40.05" }]));
    expect(lines([{ product: "Agenda & Video", startingArr: "100.10", endingArr: "40.05" }])[0].movement).toBe(
      "contraction",
    );
    expect(rollup.retainedArr.toFixed(2)).toBe("40.05");
    expect(rollup.contractionArr.toFixed(2)).toBe("60.05");
    expect(rollup.grossRetention.status === "value" && rollup.grossRetention.value.toFixed(6)).toBe(
      new Decimal("40.05").div("100.10").toFixed(6),
    );
    expectValue(rollup.netArrChangeRate, new Decimal("40.05").minus("100.10").div("100.10").toString());
  });

  it("caps gross retention at 100% when the same product expands", () => {
    const rollup = rollupProducts(lines([{ product: "Email & SMS", startingArr: "100", endingArr: "150" }]));
    expect(rollup.retainedArr.toFixed(2)).toBe("100.00");
    expect(rollup.expansionArr.toFixed(2)).toBe("50.00");
    expectValue(rollup.grossRetention, "1");
    expectValue(rollup.netArrChangeRate, "0.5");
    expectValue(rollup.nrrRatio, "1.5");
  });

  it("keeps a new midyear product out of gross retention and inside net retention", () => {
    const rollup = rollupProducts(
      lines([
        { product: "Email & SMS", startingArr: "100", endingArr: "100" },
        { product: "Public Records Request", startingArr: "0", endingArr: "25" },
      ]),
    );
    const added = rollupProducts(lines([{ product: "Public Records Request", startingArr: "0", endingArr: "25" }]));
    expect(added.inStartingCohort).toBe(false);
    expect(rollup.newProductArr.toFixed(2)).toBe("25.00");
    expectValue(rollup.grossRetention, "1");
    expectValue(rollup.netArrChangeRate, "0.25");
    expectValue(rollup.nrrRatio, "1.25");
  });

  it("excludes a new-logo account from book net retention", () => {
    const logo = rollupProducts(lines([{ accountId: "logo", product: "Email & SMS", startingArr: "0", endingArr: "80" }]));
    const existing = rollupProducts(
      lines([{ accountId: "existing", product: "Email & SMS", startingArr: "100", endingArr: "100" }]),
    );
    const book = rollupAccounts([logo, existing]);
    expect(logo.inStartingCohort).toBe(false);
    expect(book.startingArr.toFixed(2)).toBe("100.00");
    expect(book.endingArr.toFixed(2)).toBe("100.00");
    expectValue(book.netArrChangeRate, "0");
    expectValue(book.nrrRatio, "1");
  });

  it("does not match a product renewal across different product strings", () => {
    const rollup = rollupProducts(
      lines([
        { product: "Email & SMS", startingArr: "100", endingArr: "0" },
        { product: "Email and SMS", startingArr: "0", endingArr: "100" },
      ]),
    );
    expect(rollup.churnArr.toFixed(2)).toBe("100.00");
    expect(rollup.newProductArr.toFixed(2)).toBe("100.00");
    expectValue(rollup.grossRetention, "0");
    expectValue(rollup.netArrChangeRate, "0");
    expectValue(rollup.nrrRatio, "1");
  });

  it("sums duplicate product rows before applying the retention cap", () => {
    const rollup = rollupProducts(
      lines([
        { product: "Email & SMS", startingArr: "100", endingArr: "0" },
        { product: " Email & SMS ", startingArr: "0", endingArr: "100" },
      ]),
    );
    expectValue(rollup.grossRetention, "1");
    expectValue(rollup.nrrRatio, "1");
    expect(rollup.churnArr.toFixed(2)).toBe("0.00");
  });

  it("weights an XP book by starting ARR instead of averaging account rates", () => {
    const small = rollupProducts(lines([{ accountId: "a", product: "Email & SMS", startingArr: "100", endingArr: "0" }]));
    const large = rollupProducts(lines([{ accountId: "b", product: "Email & SMS", startingArr: "300", endingArr: "300" }]));
    const book = rollupAccounts([small, large]);
    expectValue(book.grossRetention, "0.75");
    expect(book.grossRetention.status === "value" && book.grossRetention.value.eq("0.5")).toBe(false);
  });

  it("returns an explicit empty rate when starting ARR is zero", () => {
    const rollup = rollupProducts(lines([{ product: "Email & SMS", startingArr: "0", endingArr: "0" }]));
    expect(rollup.inStartingCohort).toBe(false);
    expect(rollup.grossRetention.status).toBe("excluded");
    expect(rollup.netArrChangeRate.status).toBe("excluded");
    const book = rollupAccounts([rollup]);
    expect(book.grossRetention.status).toBe("zero_denominator");
    expect(book.netArrChangeRate.status).toBe("zero_denominator");
    expect(book.nrrRatio.status).toBe("zero_denominator");
  });
});
