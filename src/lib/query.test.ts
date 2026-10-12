import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import type { AccountRecord, Book, OpportunityRecord, ProductArrRecord, RenewalRecord } from "@/lib/book";
import { buildDashboard, getAccountDetail } from "@/lib/query";

const TODAY = "2026-10-09";

function book(): Book {
  return {
    meta: {
      generated: "2026-09-17",
      periodLabel: "FY26 year to date",
      periodStart: "2026-01-01",
      periodEnd: "2026-09-17",
      sourceNote: "fixture",
      sources: {
        accounts: "fixture",
        product_arr: "fixture",
        opportunities: "fixture",
        renewals: "fixture",
      },
    },
    partners: [
      { xpId: "Current XP", name: "Current XP", team: true },
      { xpId: "Former XP", name: "Former XP", team: false },
    ],
    accounts: [],
    productArr: [],
    opportunities: [],
    renewals: [],
  };
}

function account(overrides: Partial<AccountRecord> & Pick<AccountRecord, "accountId" | "xpId">): AccountRecord {
  return {
    accountName: overrides.accountId,
    segment: "",
    tier: "",
    state: "",
    arr: new Decimal(0),
    categories: [],
    credits: new Decimal(0),
    openOpps: 0,
    openRiskEvents: 0,
    riskEvents: 0,
    isGxc: false,
    cecGrade: "",
    ...overrides,
  };
}

function product(
  overrides: Partial<ProductArrRecord> & Pick<ProductArrRecord, "accountId" | "product">,
): ProductArrRecord {
  return {
    xpId: "Current XP",
    arrStart: new Decimal(0),
    arrCurrent: new Decimal(0),
    ...overrides,
  };
}

function opportunity(
  overrides: Partial<OpportunityRecord> & Pick<OpportunityRecord, "opportunityId" | "accountId">,
): OpportunityRecord {
  return {
    xpId: "Current XP",
    salesProcess: "Upsell",
    stage: "Discovery",
    closeDate: "2026-08-01",
    arr: new Decimal(0),
    sourcedBy: "XP",
    catalogItems: [],
    type: "",
    ...overrides,
  };
}

function renewal(overrides: Partial<RenewalRecord> & Pick<RenewalRecord, "opportunityId" | "accountId">): RenewalRecord {
  return {
    accountName: overrides.accountId,
    xpId: "Current XP",
    closeDate: "2026-05-01",
    arrPriorTerm: new Decimal(0),
    arrNewTerm: new Decimal(0),
    expansionArr: new Decimal(0),
    outcome: "Renewed",
    sourcedBy: "XP",
    ...overrides,
  };
}

describe("assignment, pipeline, and blocked metrics", () => {
  it("attributes retention to the current Account Team owner after an XP reassignment", () => {
    const data = book();
    data.accounts.push(account({ accountId: "A", xpId: "Current XP", arr: new Decimal("999") }));
    data.productArr.push(
      product({
        accountId: "A",
        xpId: "Former XP",
        product: "Email & SMS",
        arrStart: new Decimal("100"),
        arrCurrent: new Decimal("80"),
      }),
    );
    const current = buildDashboard(data, { kind: "custom", xpIds: ["Current XP"] }, TODAY);
    const former = buildDashboard(data, { kind: "custom", xpIds: ["Former XP"] }, TODAY);
    expect(current.cohortAccounts).toBe(1);
    expect(current.gross.status).toBe("value");
    if (current.gross.status === "value") expect(current.gross.value.toFixed(2)).toBe("0.80");
    expect(current.accounts[0].rollup?.startingArr.toFixed(2)).toBe("100.00");
    expect(former.cohortAccounts).toBe(0);
    expect(former.assignedAccounts).toBe(0);
  });

  it("does not reconstruct starting ARR from current account ARR", () => {
    const data = book();
    data.accounts.push(
      account({ accountId: "A", xpId: "Current XP", arr: new Decimal("500"), cecGrade: "A" }),
      account({ accountId: "B", xpId: "Current XP", arr: new Decimal("1") }),
    );
    data.productArr.push(
      product({
        accountId: "B",
        product: "Email & SMS",
        arrStart: new Decimal("40"),
        arrCurrent: new Decimal("40"),
      }),
    );
    const model = buildDashboard(data, { kind: "all" }, TODAY);
    const untouched = model.accounts.find((row) => row.accountId === "A");
    expect(untouched?.hasProductArr).toBe(false);
    expect(untouched?.rollup).toBeNull();
    expect(model.cohort?.startingArr.toFixed(2)).toBe("40.00");
    expect(model.currentBookArr.toFixed(2)).toBe("501.00");
    expect(model.accountHealth.available).toBe(false);
    expect(model.bookHealth.available).toBe(false);
    expect(model.accountHealth.blocker.id).toBe("account_health");
  });

  it("leaves retention unavailable when the product ARR feed is missing", () => {
    const data = book();
    data.meta.sources.product_arr = "";
    data.accounts.push(account({ accountId: "A", xpId: "Current XP", arr: new Decimal("500") }));
    data.productArr.push(
      product({ accountId: "A", product: "Email & SMS", arrStart: new Decimal("100"), arrCurrent: new Decimal("90") }),
    );
    const model = buildDashboard(data, { kind: "all" }, TODAY);
    expect(model.retentionTrust).toBe("missing");
    expect(model.gross.status).toBe("unavailable");
    expect(model.cohort).toBeNull();
  });

  it("excludes closed and unrecognized stages and does not classify opportunity type", () => {
    const data = book();
    data.accounts.push(account({ accountId: "A", xpId: "Current XP", arr: new Decimal("100") }));
    data.opportunities.push(
      opportunity({ opportunityId: "open-nb", accountId: "A", salesProcess: "New Program", stage: "Proposal", arr: new Decimal("40") }),
      opportunity({ opportunityId: "open-up", accountId: "A", salesProcess: "Upsell", stage: "Negotiation", arr: new Decimal("10") }),
      opportunity({ opportunityId: "won", accountId: "A", salesProcess: "Cross-Sell", stage: "Closed Won", arr: new Decimal("999") }),
      opportunity({ opportunityId: "lost", accountId: "A", salesProcess: "Win-Back", stage: "Closed Lost", arr: new Decimal("300") }),
    );
    data.renewals.push(
      renewal({ opportunityId: "ren", accountId: "A", expansionArr: new Decimal("5000"), outcome: "Renewed" }),
    );
    const model = buildDashboard(data, { kind: "all" }, TODAY);
    expect(model.openPipelineArr.toFixed(2)).toBe("50.00");
    expect(model.openPipelineCount).toBe(2);
    expect(model.closedExcludedCount).toBe(1);
    expect(model.unrecognizedStageCount).toBe(1);
    expect(model.newBusinessPipeline.available).toBe(false);
    expect(model.renewalPipeline.available).toBe(false);
    expect(model.accounts[0].openPipelineArr.toFixed(2)).toBe("50.00");
    expect(model.bookHealth.available).toBe(false);
  });

  it("splits open pipeline by Opportunity Type and leaves sales process unclassified", () => {
    const data = book();
    data.accounts.push(account({ accountId: "A", xpId: "Current XP", arr: new Decimal("100") }));
    data.opportunities.push(
      opportunity({ opportunityId: "nb", accountId: "A", type: "New Business", salesProcess: "Upsell", stage: "Proposal", arr: new Decimal("40") }),
      opportunity({ opportunityId: "ren", accountId: "A", type: "Existing Business", stage: "Negotiation", arr: new Decimal("25") }),
      opportunity({ opportunityId: "closed-ren", accountId: "A", type: "Existing Business", stage: "Closed Won", arr: new Decimal("999") }),
      opportunity({ opportunityId: "untyped", accountId: "A", type: "", salesProcess: "New Program", stage: "Discovery", arr: new Decimal("7") }),
    );
    data.renewals.push(renewal({ opportunityId: "closed-feed", accountId: "A", expansionArr: new Decimal("5000") }));
    const model = buildDashboard(data, { kind: "all" }, TODAY);
    expect(model.openPipelineArr.toFixed(2)).toBe("72.00");
    expect(model.newBusinessPipeline.available).toBe(true);
    expect(model.renewalPipeline.available).toBe(true);
    if (model.newBusinessPipeline.available) {
      expect(model.newBusinessPipeline.arr.toFixed(2)).toBe("40.00");
      expect(model.newBusinessPipeline.unclassifiedOpen).toBe(1);
    }
    if (model.renewalPipeline.available) expect(model.renewalPipeline.arr.toFixed(2)).toBe("25.00");
    expect(model.accounts[0].newBusinessArr.toFixed(2)).toBe("40.00");
    expect(model.accounts[0].renewalArr.toFixed(2)).toBe("25.00");
  });

  it("does not multiply opportunity ARR by product rows or duplicate opportunity ids", () => {
    const data = book();
    data.accounts.push(account({ accountId: "A", xpId: "Current XP" }));
    data.productArr.push(
      product({ accountId: "A", product: "Email & SMS", arrStart: new Decimal("80"), arrCurrent: new Decimal("80") }),
      product({ accountId: "A", product: "Agenda & Video", arrStart: new Decimal("20"), arrCurrent: new Decimal("20") }),
      product({ accountId: "A", product: "Forms & Workflows", arrStart: new Decimal("10"), arrCurrent: new Decimal("10") }),
    );
    data.opportunities.push(
      opportunity({ opportunityId: "dup", accountId: "A", stage: "Discovery", arr: new Decimal("10") }),
      opportunity({ opportunityId: "dup", accountId: "A", stage: "Discovery", arr: new Decimal("10") }),
    );
    const model = buildDashboard(data, { kind: "all" }, TODAY);
    expect(model.openPipelineArr.toFixed(2)).toBe("10.00");
    expect(model.openPipelineCount).toBe(1);
    expect(model.duplicateOpportunitiesCollapsed).toBe(1);
    const detail = getAccountDetail(data, "A");
    expect(detail?.opportunities).toHaveLength(1);
    expect(detail?.openPipelineArr.toFixed(2)).toBe("10.00");
    expect(detail?.lines).toHaveLength(3);
  });

  it("drops conflicting duplicate opportunity rows instead of summing them", () => {
    const data = book();
    data.accounts.push(account({ accountId: "A", xpId: "Current XP" }));
    data.opportunities.push(
      opportunity({ opportunityId: "dup", accountId: "A", stage: "Discovery", arr: new Decimal("10") }),
      opportunity({ opportunityId: "dup", accountId: "A", stage: "Discovery", arr: new Decimal("25") }),
    );
    const model = buildDashboard(data, { kind: "all" }, TODAY);
    expect(model.openPipelineArr.toFixed(2)).toBe("0.00");
    expect(model.conflictingOpportunitiesExcluded).toBe(1);
  });
});
