import Decimal from "decimal.js";
import { BLOCKERS } from "@/lib/blockers";
import {
  classifySource,
  type AccountRecord,
  type Book,
  type OpportunityRecord,
  type ProductArrRecord,
  type SourceTrust,
} from "@/lib/book";
import { freshness, pace, type Freshness, type Pace } from "@/lib/dates";
import { accountHealth, bookHealth, type BlockedMetric } from "@/lib/health";
import { normalizeKey } from "@/lib/keys";
import { ZERO } from "@/lib/money";
import { classifyStage, dedupedOpportunities, rollupOpenPipeline, type StageClass } from "@/lib/pipeline";
import {
  productLinesFromRows,
  rollupAccounts,
  rollupProducts,
  type CohortRollup,
  type ProductRetention,
} from "@/lib/retention";

export type DashboardFilter =
  | { kind: "all" }
  | { kind: "team" }
  | { kind: "custom"; xpIds: string[] };

export type OwnerSource = "account" | "product_fallback" | "opportunity_fallback" | "unresolved";

export type ResolvedAccount = {
  accountId: string;
  accountName: string;
  xpKey: string;
  xpId: string;
  xpName: string;
  ownerSource: OwnerSource;
  onAccountReport: boolean;
  report: AccountRecord | null;
  lines: ProductRetention[];
  rollup: CohortRollup | null;
  hasProductArr: boolean;
};

export type OpportunityView = {
  opportunityId: string;
  accountId: string;
  accountName: string;
  salesProcess: string;
  stage: string;
  closeDate: string;
  arr: Decimal;
  sourcedBy: string;
  xpOnRow: string;
  stageClass: StageClass;
  includedInOpenPipeline: boolean;
  catalogItems: string[];
};

export type DashboardModel = {
  freshness: Freshness;
  period: { label: string; start: string; end: string };
  pace: Pace | null;
  filter: DashboardFilter;
  partners: { xpId: string; name: string; team: boolean; key: string }[];
  selectedPartners: { xpId: string; name: string; team: boolean; key: string }[];
  retentionTrust: SourceTrust;
  pipelineTrust: SourceTrust;
  renewalTrust: SourceTrust;
  accountTrust: SourceTrust;
  gross: CohortRollup["grossRetention"] | { status: "unavailable" };
  netArrChangeRate: CohortRollup["netArrChangeRate"] | { status: "unavailable" };
  nrrRatio: CohortRollup["nrrRatio"] | { status: "unavailable" };
  cohort: CohortRollup | null;
  currentBookArr: Decimal;
  assignedAccounts: number;
  cohortAccounts: number;
  productOnlyAccounts: number;
  openPipelineArr: Decimal;
  openPipelineCount: number;
  closedExcludedCount: number;
  unrecognizedStageCount: number;
  duplicateOpportunitiesCollapsed: number;
  conflictingOpportunitiesExcluded: number;
  bookHealth: BlockedMetric;
  accountHealth: BlockedMetric;
  newBusinessPipeline: BlockedMetric;
  renewalPipeline: BlockedMetric;
  accounts: DashboardAccount[];
  emptyReason: "no_selection" | "no_accounts" | null;
};

export type DashboardAccount = ResolvedAccount & {
  openPipelineArr: Decimal;
  openPipelineCount: number;
};

export type AccountDetail = ResolvedAccount & {
  retentionTrust: SourceTrust;
  pipelineTrust: SourceTrust;
  opportunities: OpportunityView[];
  openPipelineArr: Decimal;
  openPipelineCount: number;
  health: BlockedMetric;
  contracts: BlockedMetric;
  newBusinessPipeline: BlockedMetric;
  renewalPipeline: BlockedMetric;
  assignment: BlockedMetric;
  productIdentity: BlockedMetric;
};

export type OpportunityDetail = OpportunityView & {
  pipelineTrust: SourceTrust;
  recordGaps: BlockedMetric;
  newBusinessPipeline: BlockedMetric;
  renewalPipeline: BlockedMetric;
  valueUsedInTotals: "arr";
};

type PartnerRef = { xpId: string; name: string; team: boolean; key: string };

function partnerIndex(book: Book): Map<string, PartnerRef> {
  const map = new Map<string, PartnerRef>();
  for (const partner of book.partners) {
    map.set(normalizeKey(partner.xpId), {
      xpId: partner.xpId,
      name: partner.name,
      team: partner.team,
      key: normalizeKey(partner.xpId),
    });
  }
  return map;
}

function displayXp(key: string, rawId: string, partners: Map<string, PartnerRef>): { xpId: string; xpName: string } {
  const partner = partners.get(key);
  if (partner) return { xpId: partner.xpId, xpName: partner.name };
  return { xpId: rawId, xpName: rawId || "Unassigned" };
}

export function filterFromSearch(params: {
  scope?: string | string[];
  xp?: string | string[];
}): DashboardFilter {
  const scope = Array.isArray(params.scope) ? params.scope[0] : params.scope;
  const xp = params.xp === undefined ? [] : Array.isArray(params.xp) ? params.xp : [params.xp];
  if (scope === "team") return { kind: "team" };
  if (scope === "custom") return { kind: "custom", xpIds: xp.filter(Boolean) };
  return { kind: "all" };
}

function selectedKeys(filter: DashboardFilter, partners: Map<string, PartnerRef>): Set<string> | "all" {
  if (filter.kind === "all") return "all";
  if (filter.kind === "team") {
    return new Set(
      [...partners.values()].filter((partner) => partner.team).map((partner) => partner.key),
    );
  }
  return new Set(filter.xpIds.map((id) => normalizeKey(id)));
}

type Owner = { key: string; rawId: string; source: OwnerSource };

function buildAccounts(book: Book): { accounts: Map<string, ResolvedAccount>; owners: Map<string, Owner> } {
  const partners = partnerIndex(book);
  const reports = new Map(book.accounts.map((account) => [account.accountId, account]));
  const names = new Map<string, string>();
  for (const account of book.accounts) {
    if (account.accountName) names.set(account.accountId, account.accountName);
  }
  for (const renewal of book.renewals) {
    if (!names.has(renewal.accountId) && renewal.accountName) names.set(renewal.accountId, renewal.accountName);
  }

  const productByAccount = new Map<string, ProductArrRecord[]>();
  for (const row of book.productArr) {
    const list = productByAccount.get(row.accountId) ?? [];
    list.push(row);
    productByAccount.set(row.accountId, list);
  }

  const ids = new Set<string>([...reports.keys(), ...productByAccount.keys()]);
  const owners = new Map<string, Owner>();
  const accounts = new Map<string, ResolvedAccount>();

  for (const accountId of ids) {
    const report = reports.get(accountId) ?? null;
    const productRows = productByAccount.get(accountId) ?? [];
    let owner: Owner;
    if (report?.xpId.trim()) {
      owner = { key: normalizeKey(report.xpId), rawId: report.xpId, source: "account" };
    } else {
      const fallbacks = [...new Set(productRows.map((row) => normalizeKey(row.xpId)).filter(Boolean))];
      if (fallbacks.length === 1) {
        const raw = productRows.find((row) => normalizeKey(row.xpId) === fallbacks[0])?.xpId ?? fallbacks[0];
        owner = { key: fallbacks[0], rawId: raw, source: "product_fallback" };
      } else {
        owner = { key: "", rawId: "", source: "unresolved" };
      }
    }
    owners.set(accountId, owner);
    const shown = displayXp(owner.key, owner.rawId, partners);
    const lines = productRows.length
      ? productLinesFromRows(
          productRows.map((row) => ({
            accountId: row.accountId,
            product: row.product,
            startingArr: row.arrStart,
            endingArr: row.arrCurrent,
          })),
        )
      : [];
    accounts.set(accountId, {
      accountId,
      accountName: names.get(accountId) || accountId,
      xpKey: owner.key,
      xpId: shown.xpId,
      xpName: shown.xpName,
      ownerSource: owner.source,
      onAccountReport: report !== null,
      report,
      lines,
      rollup: lines.length ? rollupProducts(lines) : null,
      hasProductArr: lines.length > 0,
    });
  }

  return { accounts, owners };
}

function opportunityOwner(owners: Map<string, Owner>, row: OpportunityRecord): string {
  const known = owners.get(row.accountId);
  if (known && known.key) return known.key;
  if (row.xpId.trim()) return normalizeKey(row.xpId);
  return "";
}

function viewsFor(book: Book, owners: Map<string, Owner>, names: Map<string, string>): OpportunityView[] {
  const prepared = book.opportunities.map((row) => {
    const stageClass = classifyStage(row.stage);
    return {
      opportunityId: row.opportunityId,
      accountId: row.accountId,
      accountName: names.get(row.accountId) || row.accountId,
      salesProcess: row.salesProcess,
      stage: row.stage,
      closeDate: row.closeDate,
      arr: row.arr,
      sourcedBy: row.sourcedBy,
      xpOnRow: row.xpId,
      stageClass,
      includedInOpenPipeline: stageClass === "open",
      catalogItems: row.catalogItems,
    };
  });
  return dedupedOpportunities(prepared).kept.map((row) => ({
    ...row,
    includedInOpenPipeline: row.stageClass === "open",
  }));
}

function accountNames(book: Book): Map<string, string> {
  const names = new Map<string, string>();
  for (const account of book.accounts) {
    if (account.accountName) names.set(account.accountId, account.accountName);
  }
  for (const renewal of book.renewals) {
    if (!names.has(renewal.accountId) && renewal.accountName) names.set(renewal.accountId, renewal.accountName);
  }
  return names;
}

function matches(key: string, selected: Set<string> | "all"): boolean {
  if (selected === "all") return true;
  return selected.has(key);
}

export function buildDashboard(book: Book, filter: DashboardFilter, today: string): DashboardModel {
  const partners = [...partnerIndex(book).values()].sort((a, b) => a.name.localeCompare(b.name));
  const partnerMap = partnerIndex(book);
  const selected = selectedKeys(filter, partnerMap);
  const selectedPartners =
    selected === "all" ? partners : partners.filter((partner) => selected.has(partner.key));

  const retentionTrust = classifySource(book.meta.sources.product_arr, book.productArr.length);
  const pipelineTrust = classifySource(book.meta.sources.opportunities, book.opportunities.length);
  const renewalTrust = classifySource(book.meta.sources.renewals, book.renewals.length);
  const accountTrust = classifySource(book.meta.sources.accounts, book.accounts.length);

  const { accounts: allAccounts, owners } = buildAccounts(book);
  const emptyReason = filter.kind === "custom" && filter.xpIds.length === 0 ? "no_selection" : null;

  const visible = emptyReason
    ? []
    : [...allAccounts.values()].filter((account) => matches(account.xpKey, selected));

  const cohortAccounts = visible.filter((account) => account.rollup?.inStartingCohort);
  const cohort =
    retentionTrust === "missing"
      ? null
      : rollupAccounts(cohortAccounts.flatMap((account) => (account.rollup ? [account.rollup] : [])));

  const opportunityRows = book.opportunities
    .map((row) => ({
      opportunityId: row.opportunityId,
      accountId: row.accountId,
      stage: row.stage,
      arr: row.arr,
      stageClass: classifyStage(row.stage),
      ownerKey: opportunityOwner(owners, row),
    }))
    .filter((row) => !emptyReason && matches(row.ownerKey, selected));

  const pipeline =
    pipelineTrust === "missing"
      ? {
          openArr: ZERO,
          openCount: 0,
          closedExcludedCount: 0,
          unrecognizedCount: 0,
          duplicatesCollapsed: 0,
          conflictsExcluded: 0,
        }
      : rollupOpenPipeline(opportunityRows);

  const openByAccount = new Map<string, { arr: Decimal; count: number }>();
  if (pipelineTrust !== "missing") {
    for (const row of dedupedOpportunities(opportunityRows).kept) {
      if (row.stageClass !== "open") continue;
      const bucket = openByAccount.get(row.accountId) ?? { arr: ZERO, count: 0 };
      bucket.arr = bucket.arr.plus(row.arr);
      bucket.count += 1;
      openByAccount.set(row.accountId, bucket);
    }
  }

  const currentBookArr = visible.reduce((sum, account) => {
    if (!account.report) return sum;
    return sum.plus(account.report.arr);
  }, ZERO);

  const unavailable = { status: "unavailable" as const };
  const noAccounts = !emptyReason && visible.length === 0 ? "no_accounts" : null;

  return {
    freshness: freshness(book.meta.generated, today),
    period: {
      label: book.meta.periodLabel,
      start: book.meta.periodStart,
      end: book.meta.periodEnd,
    },
    pace: pace(book.meta.periodStart, book.meta.periodEnd),
    filter,
    partners,
    selectedPartners,
    retentionTrust,
    pipelineTrust,
    renewalTrust,
    accountTrust,
    gross: retentionTrust === "missing" || !cohort ? unavailable : cohort.grossRetention,
    netArrChangeRate: retentionTrust === "missing" || !cohort ? unavailable : cohort.netArrChangeRate,
    nrrRatio: retentionTrust === "missing" || !cohort ? unavailable : cohort.nrrRatio,
    cohort: retentionTrust === "missing" ? null : cohort,
    currentBookArr,
    assignedAccounts: visible.filter((account) => account.onAccountReport).length,
    cohortAccounts: retentionTrust === "missing" ? 0 : cohortAccounts.length,
    productOnlyAccounts: visible.filter((account) => !account.onAccountReport).length,
    openPipelineArr: pipelineTrust === "missing" ? ZERO : pipeline.openArr,
    openPipelineCount: pipeline.openCount,
    closedExcludedCount: pipeline.closedExcludedCount,
    unrecognizedStageCount: pipeline.unrecognizedCount,
    duplicateOpportunitiesCollapsed: pipeline.duplicatesCollapsed,
    conflictingOpportunitiesExcluded: pipeline.conflictsExcluded,
    bookHealth: bookHealth(),
    accountHealth: accountHealth(),
    newBusinessPipeline: { available: false, blocker: BLOCKERS.newBusinessPipeline },
    renewalPipeline: { available: false, blocker: BLOCKERS.renewalPipeline },
    accounts: visible
      .map((account) => {
        const open = openByAccount.get(account.accountId) ?? { arr: ZERO, count: 0 };
        return { ...account, openPipelineArr: open.arr, openPipelineCount: open.count };
      })
      .sort((a, b) => a.accountName.localeCompare(b.accountName)),
    emptyReason: emptyReason ?? noAccounts,
  };
}

export function getAccountDetail(book: Book, accountId: string): AccountDetail | null {
  const { accounts, owners } = buildAccounts(book);
  const account = accounts.get(accountId);
  if (!account) return null;
  const names = accountNames(book);
  const opportunities = viewsFor(book, owners, names).filter((row) => row.accountId === accountId);
  const open = opportunities.filter((row) => row.includedInOpenPipeline);
  const retentionTrust = classifySource(book.meta.sources.product_arr, book.productArr.length);
  const pipelineTrust = classifySource(book.meta.sources.opportunities, book.opportunities.length);
  return {
    ...account,
    rollup: retentionTrust === "missing" ? null : account.rollup,
    lines: retentionTrust === "missing" ? [] : account.lines,
    hasProductArr: retentionTrust !== "missing" && account.hasProductArr,
    retentionTrust,
    pipelineTrust,
    opportunities,
    openPipelineArr: open.reduce((sum, row) => sum.plus(row.arr), ZERO),
    openPipelineCount: open.length,
    health: accountHealth(),
    contracts: { available: false, blocker: BLOCKERS.contractDates },
    newBusinessPipeline: { available: false, blocker: BLOCKERS.newBusinessPipeline },
    renewalPipeline: { available: false, blocker: BLOCKERS.renewalPipeline },
    assignment: { available: false, blocker: BLOCKERS.assignmentHistory },
    productIdentity: { available: false, blocker: BLOCKERS.productIdentity },
  };
}

export function getOpportunityDetail(book: Book, opportunityId: string): OpportunityDetail | null {
  const { owners } = buildAccounts(book);
  const names = accountNames(book);
  const match = viewsFor(book, owners, names).find((row) => row.opportunityId === opportunityId);
  if (!match) return null;
  return {
    ...match,
    pipelineTrust: classifySource(book.meta.sources.opportunities, book.opportunities.length),
    recordGaps: { available: false, blocker: BLOCKERS.opportunityRecord },
    newBusinessPipeline: { available: false, blocker: BLOCKERS.newBusinessPipeline },
    renewalPipeline: { available: false, blocker: BLOCKERS.renewalPipeline },
    valueUsedInTotals: "arr",
  };
}

export function listOpportunities(book: Book): OpportunityView[] {
  const { owners } = buildAccounts(book);
  return viewsFor(book, owners, accountNames(book));
}
