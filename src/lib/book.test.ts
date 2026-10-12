import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import { loadBook, parseBook } from "@/lib/book";
import { buildDashboard, getAccountDetail, getOpportunityDetail } from "@/lib/query";
import { ZERO } from "@/lib/money";

describe("shipped book dataset", () => {
  it("rejects a product row without the documented ARR columns", () => {
    expect(() =>
      parseBook({
        meta: {
          generated: "2026-09-17",
          period_label: "FY26 year to date",
          period_start: "2026-01-01",
          period_end: "2026-09-17",
          sources: {},
        },
        partners: [],
        accounts: [],
        product_arr: [{ account_id: "001", product: "Email & SMS", arr_current: 1 }],
        opportunities: [],
        renewals: [],
      }),
    ).toThrow(/arr_start/);
  });

  it("keeps blocked metrics blocked and matches an independent cohort total", () => {
    const loaded = loadBook();
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const { book } = loaded;
    const model = buildDashboard(book, { kind: "all" }, "2026-10-09");

    expect(book.accounts).toHaveLength(492);
    expect(book.partners).toHaveLength(26);
    expect(model.accountTrust).toBe("production");
    expect(model.retentionTrust).toBe("sample");
    expect(model.pipelineTrust).toBe("sample");
    expect(model.assignedAccounts).toBe(492);
    expect(model.productOnlyAccounts).toBe(7);
    expect(model.accounts.filter((account) => !account.hasProductArr)).toHaveLength(87);
    expect(model.bookHealth.available).toBe(false);
    expect(model.accountHealth.available).toBe(false);
    expect(model.newBusinessPipeline.available).toBe(false);
    expect(model.renewalPipeline.available).toBe(false);
    expect(model.typeColumnPresent).toBe(false);
    expect(model.bookHealth.available).toBe(false);
    const accountDetail = getAccountDetail(book, book.accounts[0].accountId);
    expect(accountDetail?.salesforceUrl?.startsWith("https://granicus.lightning.force.com/lightning/r/Account/")).toBe(true);
    const opportunityDetail = getOpportunityDetail(book, book.opportunities[0].opportunityId);
    expect(opportunityDetail?.type).toBe("");
    expect(opportunityDetail?.salesforceUrl).toBeNull();
    expect(book.accounts.some((account) => account.cecGrade === "A")).toBe(true);
    expect(model.freshness).toMatchObject({ asOf: "2026-09-17", stale: true });

    const owners = new Map(book.accounts.map((account) => [account.accountId, account.xpId]));
    const names = new Map<string, Map<string, { start: Decimal; end: Decimal }>>();
    for (const row of book.productArr) {
      const products = names.get(row.accountId) ?? new Map();
      const key = row.product.trim();
      const current = products.get(key) ?? { start: ZERO, end: ZERO };
      current.start = current.start.plus(row.arrStart);
      current.end = current.end.plus(row.arrCurrent);
      products.set(key, current);
      names.set(row.accountId, products);
    }

    let starting = ZERO;
    let ending = ZERO;
    let retained = ZERO;
    for (const [accountId, products] of names) {
      let boy = ZERO;
      let eoy = ZERO;
      let kept = ZERO;
      for (const product of products.values()) {
        boy = boy.plus(product.start);
        eoy = eoy.plus(product.end);
        if (product.start.gt(0)) kept = kept.plus(Decimal.min(product.start, Decimal.max(product.end, ZERO)));
      }
      if (boy.gt(0)) {
        starting = starting.plus(boy);
        ending = ending.plus(eoy);
        retained = retained.plus(kept);
      }
      const resolved = model.accounts.find((account) => account.accountId === accountId);
      expect(resolved?.hasProductArr).toBe(true);
      if (owners.has(accountId)) expect(resolved?.ownerSource).toBe("account");
    }

    expect(model.cohort?.startingArr.eq(starting)).toBe(true);
    expect(model.cohort?.endingArr.eq(ending)).toBe(true);
    expect(model.cohort?.retainedArr.eq(retained)).toBe(true);
    expect(model.gross.status).toBe("value");
    if (model.gross.status === "value") expect(model.gross.value.lte(1)).toBe(true);

    for (const account of model.accounts) {
      const gross = account.rollup?.grossRetention;
      if (gross?.status === "value") expect(gross.value.lte(1)).toBe(true);
      if (!account.hasProductArr) expect(account.rollup).toBeNull();
    }

    const seen = new Set<string>();
    let open = ZERO;
    let openCount = 0;
    let closed = 0;
    for (const row of book.opportunities) {
      if (seen.has(row.opportunityId)) continue;
      seen.add(row.opportunityId);
      const stage = row.stage.trim().toLowerCase();
      if (stage === "discovery" || stage === "proposal" || stage === "negotiation") {
        open = open.plus(row.arr);
        openCount += 1;
      } else if (stage === "closed won") {
        closed += 1;
      }
    }
    expect(model.openPipelineArr.eq(open)).toBe(true);
    expect(model.openPipelineCount).toBe(openCount);
    expect(model.closedExcludedCount).toBe(closed);

    const accountOpen = model.accounts.reduce((sum, account) => sum.plus(account.openPipelineArr), ZERO);
    expect(accountOpen.eq(model.openPipelineArr)).toBe(true);

  });
});
