import { readFileSync } from "node:fs";
import path from "node:path";
import Decimal from "decimal.js";

export class BookValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BookValidationError";
  }
}

export type SourceTrust = "production" | "sample" | "missing";

export type BookMeta = {
  generated: string;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  sourceNote: string;
  sources: Record<string, string>;
};

export type Partner = {
  xpId: string;
  name: string;
  team: boolean;
};

export type AccountRecord = {
  accountId: string;
  accountName: string;
  xpId: string;
  segment: string;
  tier: string;
  state: string;
  arr: Decimal;
  categories: string[];
  credits: Decimal;
  openOpps: number;
  openRiskEvents: number;
  riskEvents: number;
  isGxc: boolean;
  cecGrade: string;
};

export type ProductArrRecord = {
  accountId: string;
  xpId: string;
  product: string;
  arrStart: Decimal;
  arrCurrent: Decimal;
};

export type OpportunityRecord = {
  opportunityId: string;
  accountId: string;
  xpId: string;
  salesProcess: string;
  stage: string;
  closeDate: string;
  arr: Decimal;
  sourcedBy: string;
  catalogItems: string[];
};

export type RenewalRecord = {
  opportunityId: string;
  accountId: string;
  accountName: string;
  xpId: string;
  closeDate: string;
  arrPriorTerm: Decimal;
  arrNewTerm: Decimal;
  expansionArr: Decimal;
  outcome: string;
  sourcedBy: string;
};

export type Book = {
  meta: BookMeta;
  partners: Partner[];
  accounts: AccountRecord[];
  productArr: ProductArrRecord[];
  opportunities: OpportunityRecord[];
  renewals: RenewalRecord[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown, pathLabel: string): Record<string, unknown> {
  if (!isRecord(value)) throw new BookValidationError(`${pathLabel} is not an object`);
  return value;
}

function requireString(row: Record<string, unknown>, key: string, pathLabel: string): string {
  const value = row[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new BookValidationError(`${pathLabel} is missing ${key}`);
  }
  return value;
}

function optionalString(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  throw new BookValidationError(`${key} is not text`);
}

function moneyField(row: Record<string, unknown>, key: string, pathLabel: string): Decimal {
  const value = row[key];
  if (typeof value === "number" && Number.isFinite(value)) return new Decimal(value);
  if (typeof value === "string" && value.trim() !== "") {
    try {
      return new Decimal(value);
    } catch {
      throw new BookValidationError(`${pathLabel}.${key} is not a number`);
    }
  }
  throw new BookValidationError(`${pathLabel}.${key} is not a number`);
}

function intField(row: Record<string, unknown>, key: string, pathLabel: string): number {
  const value = row[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return Number(value);
  }
  throw new BookValidationError(`${pathLabel}.${key} is not a number`);
}

function stringList(value: unknown, pathLabel: string): string[] {
  if (Array.isArray(value)) {
    return value.map((item, index) => {
      if (typeof item !== "string") throw new BookValidationError(`${pathLabel}[${index}] is not text`);
      return item;
    });
  }
  if (typeof value === "string") {
    return value
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (value === null || value === undefined || value === "") return [];
  throw new BookValidationError(`${pathLabel} is not a list`);
}

function truthy(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  return /^(true|yes|y|1)$/i.test(String(value ?? "").trim());
}

export function classifySource(label: string | undefined, rowCount: number): SourceTrust {
  if (!label || rowCount === 0) return "missing";
  if (label.trim().toLowerCase() === "sample") return "sample";
  return "production";
}

export function parseBook(input: unknown): Book {
  const root = requireRecord(input, "dataset");
  const metaRow = requireRecord(root.meta, "meta");
  const sources = requireRecord(metaRow.sources ?? {}, "meta.sources");
  const sourceMap: Record<string, string> = {};
  for (const [key, value] of Object.entries(sources)) {
    if (typeof value !== "string") throw new BookValidationError(`meta.sources.${key} is not text`);
    sourceMap[key] = value;
  }

  const meta: BookMeta = {
    generated: requireString(metaRow, "generated", "meta"),
    periodLabel: requireString(metaRow, "period_label", "meta"),
    periodStart: requireString(metaRow, "period_start", "meta"),
    periodEnd: requireString(metaRow, "period_end", "meta"),
    sourceNote: optionalString(metaRow, "source_note"),
    sources: sourceMap,
  };

  const partners = readArray(root.partners, "partners").map((row, index) => {
    const record = requireRecord(row, `partners[${index}]`);
    return {
      xpId: requireString(record, "xp_id", `partners[${index}]`),
      name: requireString(record, "name", `partners[${index}]`),
      team: truthy(record.team),
    };
  });

  const accounts = readArray(root.accounts, "accounts").map((row, index) => {
    const record = requireRecord(row, `accounts[${index}]`);
    const pathLabel = `accounts[${index}]`;
    return {
      accountId: requireString(record, "account_id", pathLabel),
      accountName: optionalString(record, "account_name"),
      xpId: requireString(record, "xp_id", pathLabel),
      segment: optionalString(record, "segment"),
      tier: optionalString(record, "tier"),
      state: optionalString(record, "state"),
      arr: moneyField(record, "arr", pathLabel),
      categories: stringList(record.categories, `${pathLabel}.categories`),
      credits: moneyField(record, "credits", pathLabel),
      openOpps: intField(record, "open_opps", pathLabel),
      openRiskEvents: intField(record, "open_risk_events", pathLabel),
      riskEvents: intField(record, "risk_events", pathLabel),
      isGxc: truthy(record.is_gxc),
      cecGrade: optionalString(record, "cec_grade"),
    };
  });

  const productArr = readArray(root.product_arr, "product_arr").map((row, index) => {
    const record = requireRecord(row, `product_arr[${index}]`);
    const pathLabel = `product_arr[${index}]`;
    return {
      accountId: requireString(record, "account_id", pathLabel),
      xpId: optionalString(record, "xp_id"),
      product: requireString(record, "product", pathLabel),
      arrStart: moneyField(record, "arr_start", pathLabel),
      arrCurrent: moneyField(record, "arr_current", pathLabel),
    };
  });

  const opportunities = readArray(root.opportunities, "opportunities").map((row, index) => {
    const record = requireRecord(row, `opportunities[${index}]`);
    const pathLabel = `opportunities[${index}]`;
    return {
      opportunityId: requireString(record, "opportunity_id", pathLabel),
      accountId: requireString(record, "account_id", pathLabel),
      xpId: optionalString(record, "xp_id"),
      salesProcess: optionalString(record, "sales_process"),
      stage: optionalString(record, "stage"),
      closeDate: optionalString(record, "close_date"),
      arr: moneyField(record, "arr", pathLabel),
      sourcedBy: optionalString(record, "sourced_by"),
      catalogItems: stringList(record.catalog_items, `${pathLabel}.catalog_items`),
    };
  });

  const renewals = readArray(root.renewals, "renewals").map((row, index) => {
    const record = requireRecord(row, `renewals[${index}]`);
    const pathLabel = `renewals[${index}]`;
    return {
      opportunityId: requireString(record, "opportunity_id", pathLabel),
      accountId: requireString(record, "account_id", pathLabel),
      accountName: optionalString(record, "account_name"),
      xpId: optionalString(record, "xp_id"),
      closeDate: optionalString(record, "close_date"),
      arrPriorTerm: moneyField(record, "arr_prior_term", pathLabel),
      arrNewTerm: moneyField(record, "arr_new_term", pathLabel),
      expansionArr: moneyField(record, "expansion_arr", pathLabel),
      outcome: optionalString(record, "outcome"),
      sourcedBy: optionalString(record, "sourced_by"),
    };
  });

  return { meta, partners, accounts, productArr, opportunities, renewals };
}

function readArray(value: unknown, pathLabel: string): unknown[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new BookValidationError(`${pathLabel} is not a list`);
  return value;
}

export function defaultBookPath(): string {
  return process.env.BOOK_DATA_PATH ?? path.join(process.cwd(), "data", "book-of-business.json");
}

export function loadBook(filePath?: string): { ok: true; book: Book } | { ok: false; error: string } {
  try {
    const override = filePath ?? process.env.BOOK_DATA_PATH;
    const text = override
      ? readFileSync(/*turbopackIgnore: true*/ override, "utf8")
      : readFileSync(path.join(process.cwd(), "data", "book-of-business.json"), "utf8");
    return { ok: true, book: parseBook(JSON.parse(text) as unknown) };
  } catch (error) {
    if (error instanceof BookValidationError) return { ok: false, error: error.message };
    return { ok: false, error: "The book dataset could not be read." };
  }
}
