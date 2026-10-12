export const SALESFORCE_BASE = "https://granicus.lightning.force.com";

const PREFIX = {
  Account: "001",
  Opportunity: "006",
} as const;

/** 15- or 18-character Salesforce id with the object key prefix. */
export function salesforceRecordUrl(objectApi: keyof typeof PREFIX, id: string): string | null {
  if (!/^[a-zA-Z0-9]{15}(?:[a-zA-Z0-9]{3})?$/.test(id)) return null;
  if (!id.startsWith(PREFIX[objectApi])) return null;
  return `${SALESFORCE_BASE}/lightning/r/${objectApi}/${id}/view`;
}
