import { describe, expect, it } from "vitest";
import { salesforceRecordUrl } from "@/lib/salesforce";

describe("Salesforce record links", () => {
  it("links 18-character Account and Opportunity ids on the Granicus org", () => {
    expect(salesforceRecordUrl("Account", "001000000000001AAA")).toBe(
      "https://granicus.lightning.force.com/lightning/r/Account/001000000000001AAA/view",
    );
    expect(salesforceRecordUrl("Opportunity", "006000000000001AAA")).toBe(
      "https://granicus.lightning.force.com/lightning/r/Opportunity/006000000000001AAA/view",
    );
  });

  it("does not link sample ids or the wrong object prefix", () => {
    expect(salesforceRecordUrl("Opportunity", "SAM0000000001")).toBeNull();
    expect(salesforceRecordUrl("Opportunity", "001000000000001AAA")).toBeNull();
    expect(salesforceRecordUrl("Account", "006000000000001AAA")).toBeNull();
  });
});