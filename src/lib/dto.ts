import Decimal from "decimal.js";
import { BLOCKER_LIST, type Blocker } from "@/lib/blockers";
import { paceBand } from "@/lib/dates";
import { CURRENCY_LABEL, type RateStatus } from "@/lib/money";
import type { DashboardAccount, DashboardModel, PipelineSplitMetric } from "@/lib/query";
import type { RateValue } from "@/lib/retention";

export type PipelineSplitDTO =
  | { available: false; blocker: Blocker }
  | { available: true; arr: string; count: number; unclassifiedOpen: number };

export type BookHealthDTO =
  | { available: false; blocker: Blocker }
  | { available: true; score: string; accounts: number };

export type AccountRowDTO = {
  accountId: string;
  accountName: string;
  xpName: string;
  onAccountReport: boolean;
  inStartingCohort: boolean;
  hasProductArr: boolean;
  startingArr: string | null;
  endingArr: string | null;
  gross: RateStatus;
  netArrChangeRate: RateStatus;
  nrrRatio: RateStatus;
  openPipelineArr: string | null;
  openPipelineCount: number;
  newBusinessArr: string | null;
  renewalArr: string | null;
};

export type DashboardDTO = {
  freshness: DashboardModel["freshness"];
  period: DashboardModel["period"];
  currencyLabel: string;
  filter: DashboardModel["filter"];
  partners: DashboardModel["partners"];
  selectedPartners: DashboardModel["selectedPartners"];
  retentionTrust: DashboardModel["retentionTrust"];
  pipelineTrust: DashboardModel["pipelineTrust"];
  accountTrust: DashboardModel["accountTrust"];
  gross: RateStatus;
  netArrChangeRate: RateStatus;
  nrrRatio: RateStatus;
  grossPace: string | null;
  nrrRatioPace: string | null;
  grossBand: "pos" | "warn" | "neg" | null;
  nrrBand: "pos" | "warn" | "neg" | null;
  cohortStartingArr: string | null;
  cohortEndingArr: string | null;
  currentBookArr: string;
  assignedAccounts: number;
  cohortAccounts: number;
  productOnlyAccounts: number;
  openPipelineArr: string | null;
  openPipelineCount: number;
  closedExcludedCount: number;
  unrecognizedStageCount: number;
  bookHealth: BookHealthDTO;
  accountHealth: DashboardModel["accountHealth"];
  newBusinessPipeline: PipelineSplitDTO;
  renewalPipeline: PipelineSplitDTO;
  accounts: AccountRowDTO[];
  emptyReason: DashboardModel["emptyReason"];
  gaps: typeof BLOCKER_LIST;
};

function splitDto(split: PipelineSplitMetric): PipelineSplitDTO {
  if (!split.available) return split;
  return {
    available: true,
    arr: split.arr.toString(),
    count: split.count,
    unclassifiedOpen: split.unclassifiedOpen,
  };
}

function rateDto(rate: RateValue | { status: "unavailable" }): RateStatus {
  if (rate.status === "value") return { status: "value", value: rate.value.toString() };
  if (rate.status === "excluded") return { status: "excluded", reason: "no_starting_arr" };
  if (rate.status === "zero_denominator") return { status: "zero_denominator" };
  return { status: "unavailable" };
}

function accountRates(model: DashboardModel, account: DashboardAccount): Pick<
  AccountRowDTO,
  "gross" | "netArrChangeRate" | "nrrRatio" | "startingArr" | "endingArr"
> {
  if (model.retentionTrust === "missing" || !account.hasProductArr || !account.rollup) {
    return {
      gross: { status: "unavailable" },
      netArrChangeRate: { status: "unavailable" },
      nrrRatio: { status: "unavailable" },
      startingArr: null,
      endingArr: null,
    };
  }
  return {
    gross: rateDto(account.rollup.grossRetention),
    netArrChangeRate: rateDto(account.rollup.netArrChangeRate),
    nrrRatio: rateDto(account.rollup.nrrRatio),
    startingArr: account.rollup.startingArr.toString(),
    endingArr: account.rollup.endingArr.toString(),
  };
}

export function toDashboardDTO(model: DashboardModel): DashboardDTO {
  const gross = rateDto(model.gross);
  const nrrRatio = rateDto(model.nrrRatio);
  return {
    freshness: model.freshness,
    period: model.period,
    currencyLabel: CURRENCY_LABEL,
    filter: model.filter,
    partners: model.partners,
    selectedPartners: model.selectedPartners,
    retentionTrust: model.retentionTrust,
    pipelineTrust: model.pipelineTrust,
    accountTrust: model.accountTrust,
    gross,
    netArrChangeRate: rateDto(model.netArrChangeRate),
    nrrRatio,
    grossPace: model.pace ? model.pace.grr.toString() : null,
    nrrRatioPace: model.pace ? model.pace.nrrRatio.toString() : null,
    grossBand:
      model.pace && gross.status === "value" ? paceBand(new Decimal(gross.value), model.pace.grr) : null,
    nrrBand:
      model.pace && nrrRatio.status === "value"
        ? paceBand(new Decimal(nrrRatio.value), model.pace.nrrRatio)
        : null,
    cohortStartingArr: model.cohort ? model.cohort.startingArr.toString() : null,
    cohortEndingArr: model.cohort ? model.cohort.endingArr.toString() : null,
    currentBookArr: model.currentBookArr.toString(),
    assignedAccounts: model.assignedAccounts,
    cohortAccounts: model.cohortAccounts,
    productOnlyAccounts: model.productOnlyAccounts,
    openPipelineArr: model.pipelineTrust === "missing" ? null : model.openPipelineArr.toString(),
    openPipelineCount: model.openPipelineCount,
    closedExcludedCount: model.closedExcludedCount,
    unrecognizedStageCount: model.unrecognizedStageCount,
    bookHealth: model.bookHealth.available
      ? { available: true, score: model.bookHealth.score.toString(), accounts: model.bookHealth.accounts }
      : model.bookHealth,
    accountHealth: model.accountHealth,
    newBusinessPipeline: splitDto(model.newBusinessPipeline),
    renewalPipeline: splitDto(model.renewalPipeline),
    accounts: model.accounts.map((account) => ({
      accountId: account.accountId,
      accountName: account.accountName,
      xpName: account.xpName,
      onAccountReport: account.onAccountReport,
      inStartingCohort: Boolean(account.rollup?.inStartingCohort),
      hasProductArr: model.retentionTrust !== "missing" && account.hasProductArr,
      ...accountRates(model, account),
      openPipelineArr: model.pipelineTrust === "missing" ? null : account.openPipelineArr.toString(),
      openPipelineCount: model.pipelineTrust === "missing" ? 0 : account.openPipelineCount,
      newBusinessArr: model.newBusinessPipeline.available ? account.newBusinessArr.toString() : null,
      renewalArr: model.renewalPipeline.available ? account.renewalArr.toString() : null,
    })),
    emptyReason: model.emptyReason,
    gaps: BLOCKER_LIST,
  };
}
