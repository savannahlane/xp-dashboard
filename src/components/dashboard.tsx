"use client";

import Decimal from "decimal.js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/states";
import type { DashboardDTO, AccountRowDTO } from "@/lib/dto";
import { CURRENCY_LABEL, formatMoney, formatRate, type RateStatus } from "@/lib/money";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 25;

type SortKey = "name" | "starting" | "ending" | "gross" | "net" | "nrr" | "pipeline";

function trustTone(trust: DashboardDTO["retentionTrust"]): "amber" | "teal" | "rose" {
  if (trust === "production") return "teal";
  if (trust === "sample") return "amber";
  return "rose";
}

function trustLabel(trust: DashboardDTO["retentionTrust"]): string {
  if (trust === "production") return "Production";
  if (trust === "sample") return "Sample feed";
  return "Unavailable";
}

function rateNumber(rate: RateStatus): Decimal | null {
  return rate.status === "value" ? new Decimal(rate.value) : null;
}

function moneyNumber(value: string | null): Decimal | null {
  return value === null ? null : new Decimal(value);
}

export function Dashboard({ dto }: { dto: DashboardDTO }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [cohort, setCohort] = useState<"all" | "cohort" | "missing">("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "name", dir: 1 });
  const [page, setPage] = useState(0);

  function go(kind: "all" | "team" | "custom", xpIds: string[] = []) {
    const params = new URLSearchParams();
    if (kind === "team") params.set("scope", "team");
    if (kind === "custom") {
      params.set("scope", "custom");
      for (const id of xpIds) params.append("xp", id);
    }
    const next = params.toString();
    setPage(0);
    router.push(next ? `/?${next}` : "/");
  }

  function togglePartner(xpId: string) {
    const current = new Set(dto.filter.kind === "custom" ? dto.filter.xpIds : []);
    if (current.has(xpId)) current.delete(xpId);
    else current.add(xpId);
    go("custom", [...current]);
  }

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = dto.accounts.filter((row) => {
      if (cohort === "cohort" && !row.inStartingCohort) return false;
      if (cohort === "missing" && row.hasProductArr) return false;
      if (!needle) return true;
      return row.accountName.toLowerCase().includes(needle) || row.accountId.toLowerCase().includes(needle);
    });
    const valueOf = (row: AccountRowDTO): Decimal | string | null => {
      if (sort.key === "name") return row.accountName;
      if (sort.key === "starting") return moneyNumber(row.startingArr);
      if (sort.key === "ending") return moneyNumber(row.endingArr);
      if (sort.key === "gross") return rateNumber(row.gross);
      if (sort.key === "net") return rateNumber(row.netArrChangeRate);
      if (sort.key === "nrr") return rateNumber(row.nrrRatio);
      return moneyNumber(row.openPipelineArr);
    };
    return filtered.sort((a, b) => {
      const av = valueOf(a);
      const bv = valueOf(b);
      if (typeof av === "string" && typeof bv === "string") return av.localeCompare(bv) * sort.dir;
      if (av === null && bv === null) return a.accountName.localeCompare(b.accountName);
      if (av === null) return 1;
      if (bv === null) return -1;
      if (typeof av === "string" || typeof bv === "string") return 0;
      return av.cmp(bv) * sort.dir;
    });
  }, [dto.accounts, query, cohort, sort]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visible = rows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const selectedIds = new Set(dto.filter.kind === "custom" ? dto.filter.xpIds : []);

  function header(key: SortKey, label: string, title?: string) {
    const active = sort.key === key;
    return (
      <th className="px-3 py-2 text-right font-medium text-muted first:text-left">
        <button
          type="button"
          title={title}
          className="inline-flex items-center gap-1 hover:text-foreground"
          onClick={() => {
            setPage(0);
            setSort((current) =>
              current.key === key ? { key, dir: current.dir === 1 ? -1 : 1 } : { key, dir: key === "name" ? 1 : -1 },
            );
          }}
        >
          {label}
          {active ? <span className="text-[10px] text-brass">{sort.dir === 1 ? "▲" : "▼"}</span> : null}
        </button>
      </th>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Experience Partner dashboard</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Gross retention caps each starting product at its own ending ARR. Net ARR change is the starting cohort’s
            ending ARR minus starting ARR, divided by starting ARR.
          </p>
        </div>
        <div className="rounded border border-line bg-surface px-3 py-2 text-xs text-muted">
          <div>{dto.period.label}</div>
          <div>
            {dto.period.start} → {dto.period.end}
          </div>
        </div>
      </div>

      {dto.retentionTrust === "sample" || dto.pipelineTrust === "sample" ? (
        <div className="rounded-md border border-amber/40 bg-amber/10 px-4 py-3 text-sm text-amber">
          Product ARR, opportunities, and renewals in this file are sample feeds. Retention and pipeline figures below
          are calculated from those feeds. The Account Team report — assignment and current converted ARR — is the
          Salesforce export dated {dto.freshness.asOf}.
        </div>
      ) : null}

      {dto.freshness.stale ? (
        <div className="rounded-md border border-line bg-surface px-4 py-3 text-sm text-muted">
          Data as of {dto.freshness.asOf}
          {dto.freshness.ageDays !== null ? ` (${dto.freshness.ageDays} days ago)` : ""}. The weekly refresh window is 7
          days, so this snapshot is stale.
        </div>
      ) : (
        <div className="text-sm text-dim">Data as of {dto.freshness.asOf}.</div>
      )}

      <section className="rounded-lg border border-line bg-surface p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant={dto.filter.kind === "all" ? "pressed" : "default"} size="sm" onClick={() => go("all")}>
            All XPs · {dto.partners.length}
          </Button>
          <Button variant={dto.filter.kind === "team" ? "pressed" : "default"} size="sm" onClick={() => go("team")}>
            My team · {dto.partners.filter((partner) => partner.team).length}
          </Button>
          <Button
            variant={dto.filter.kind === "custom" ? "pressed" : "default"}
            size="sm"
            onClick={() => go("custom", dto.filter.kind === "custom" ? dto.filter.xpIds : [])}
          >
            Selected XPs
          </Button>
          {dto.filter.kind !== "all" ? (
            <Button variant="ghost" size="sm" onClick={() => go("all")}>
              Clear filters
            </Button>
          ) : null}
        </div>
        <p className="mt-3 text-xs text-dim">
          My team is the partner <code>team</code> flag. No manager or VP hierarchy is stored, so All XPs is the only
          book-wide view. Historical retention uses the account’s current owner.
        </p>
        {dto.filter.kind === "custom" ? (
          <fieldset className="mt-3 max-h-48 overflow-auto rounded border border-line p-3">
            <legend className="px-1 text-xs text-muted">Experience Partners</legend>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {dto.partners.map((partner) => (
                <label key={partner.xpId} className="flex items-center gap-2 text-sm text-muted">
                  <input
                    type="checkbox"
                    className="accent-[var(--brass)]"
                    checked={selectedIds.has(partner.xpId)}
                    onChange={() => togglePartner(partner.xpId)}
                  />
                  <span className="text-foreground">{partner.name}</span>
                  {partner.team ? <Badge tone="brass">Team</Badge> : null}
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge tone="dim">
            {dto.filter.kind === "all"
              ? "All XPs"
              : dto.filter.kind === "team"
                ? `My team · ${dto.selectedPartners.length}`
                : dto.selectedPartners.length
                  ? dto.selectedPartners.map((partner) => partner.name).join(", ")
                  : "No partners selected"}
          </Badge>
          <Badge tone="dim">{dto.period.label}</Badge>
          <Badge tone={dto.freshness.stale ? "amber" : "teal"}>As of {dto.freshness.asOf}</Badge>
          <Badge tone="dim">{CURRENCY_LABEL}</Badge>
        </div>
      </section>

      {dto.emptyReason ? <EmptyState reason={dto.emptyReason} /> : null}

      <section className="grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Gross retention"
          value={formatRate(dto.gross)}
          trust={dto.retentionTrust}
          band={dto.grossBand}
          note={
            dto.grossPace
              ? `YTD pace ${formatRate({ status: "value", value: dto.grossPace })} · annual target 94%`
              : "Cap is 100% of starting product ARR"
          }
        />
        <MetricCard
          label="Net ARR change"
          value={formatRate(dto.netArrChangeRate, "change")}
          trust={dto.retentionTrust}
          note="(Ending − starting) / starting. New logos excluded."
        />
        <MetricCard
          label="NRR ratio"
          value={formatRate(dto.nrrRatio)}
          trust={dto.retentionTrust}
          band={dto.nrrBand}
          note={
            dto.nrrRatioPace
              ? `Ending / starting · YTD pace ${formatRate({ status: "value", value: dto.nrrRatioPace })} · annual target 106%`
              : "Ending / starting for the same cohort"
          }
        />
        <BlockedCard label="Book health" summary={dto.bookHealth.blocker.summary} />
        <BlockedCard label="Open new-business pipeline" summary={dto.newBusinessPipeline.blocker.summary} />
        <BlockedCard label="Open renewal pipeline" summary={dto.renewalPipeline.blocker.summary} />
        <MetricCard
          label="Open pipeline"
          value={dto.openPipelineArr === null ? "Unavailable" : formatMoney(dto.openPipelineArr)}
          trust={dto.pipelineTrust}
          note={
            dto.openPipelineArr === null
              ? "Opportunities feed is missing"
              : `${dto.openPipelineCount} open · measure is arr, unweighted · ${dto.closedExcludedCount} Closed Won excluded`
          }
        />
        <MetricCard
          label="Assigned accounts"
          value={String(dto.assignedAccounts)}
          trust={dto.accountTrust}
          note={`${formatMoney(dto.currentBookArr)} current book ARR · ${dto.cohortAccounts} in the starting cohort`}
        />
      </section>

      <section className="rounded-lg border border-line bg-surface">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line px-4 py-3">
          <div>
            <h2 className="text-base font-semibold">Accounts</h2>
            <p className="text-xs text-dim">
              Starting and ending ARR come from product ARR. Accounts with no product rows stay in the list and their
              retention stays unavailable.
            </p>
          </div>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <Input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(0);
              }}
              placeholder="Search name or account id"
              aria-label="Search accounts"
              className="sm:w-64"
            />
            <select
              className="h-9 rounded-md border border-line bg-surface2 px-2 text-sm"
              value={cohort}
              aria-label="Filter accounts"
              onChange={(event) => {
                setCohort(event.target.value as "all" | "cohort" | "missing");
                setPage(0);
              }}
            >
              <option value="all">All accounts</option>
              <option value="cohort">Starting cohort</option>
              <option value="missing">No product ARR</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead className="bg-surface2 text-xs">
              <tr>
                {header("name", "Account")}
                {header("starting", "Starting ARR", "Sum of product arr_start")}
                {header("ending", "Ending ARR", `Product arr_current as of ${dto.period.end}`)}
                {header("gross", "Gross retention")}
                {header("net", "Net ARR change")}
                {header("nrr", "NRR ratio")}
                <th className="px-3 py-2 text-right font-medium text-muted" title={dto.accountHealth.blocker.summary}>
                  Health
                </th>
                <th className="px-3 py-2 text-right font-medium text-muted" title={dto.newBusinessPipeline.blocker.summary}>
                  New business
                </th>
                <th className="px-3 py-2 text-right font-medium text-muted" title={dto.renewalPipeline.blocker.summary}>
                  Renewal pipeline
                </th>
                {header("pipeline", "Open pipeline", "Unsplit opportunities.arr")}
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-muted">
                    No accounts match this search.
                  </td>
                </tr>
              ) : (
                visible.map((row) => (
                  <tr key={row.accountId} className="border-t border-line/70 hover:bg-surface2">
                    <td className="px-3 py-2 text-left">
                      <Link href={`/accounts/${encodeURIComponent(row.accountId)}`} className="font-medium hover:text-brass">
                        {row.accountName}
                      </Link>
                      <div className="text-[11px] text-dim">
                        {row.xpName}
                        {row.onAccountReport ? "" : " · Not on the Account Team report"}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">{row.startingArr === null ? "Unavailable" : formatMoney(row.startingArr)}</td>
                    <td className="px-3 py-2 text-right">{row.endingArr === null ? "Unavailable" : formatMoney(row.endingArr)}</td>
                    <td className="px-3 py-2 text-right">{formatRate(row.gross)}</td>
                    <td className="px-3 py-2 text-right">{formatRate(row.netArrChangeRate, "change")}</td>
                    <td className="px-3 py-2 text-right">{formatRate(row.nrrRatio)}</td>
                    <td className="px-3 py-2 text-right text-amber">Unavailable</td>
                    <td className="px-3 py-2 text-right text-amber">Unavailable</td>
                    <td className="px-3 py-2 text-right text-amber">Unavailable</td>
                    <td className="px-3 py-2 text-right">
                      {row.openPipelineArr === null ? "Unavailable" : formatMoney(row.openPipelineArr)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-line px-4 py-3 text-xs text-muted">
          <span>
            {rows.length === 0
              ? "0 accounts"
              : `${safePage * PAGE_SIZE + 1}–${Math.min(rows.length, (safePage + 1) * PAGE_SIZE)} of ${rows.length}`}
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="default" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
              Previous
            </Button>
            <Button
              size="sm"
              variant="default"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage(safePage + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </section>

      <section id="data-gaps" className="space-y-3">
        <h2 className="text-base font-semibold">Data gaps</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {dto.gaps.map((gap) => (
            <article key={gap.id} className="rounded-lg border border-line bg-surface p-4">
              <h3 className="text-sm font-semibold">{gap.title}</h3>
              <p className="mt-1 text-sm text-muted">{gap.summary}</p>
              <p className="mt-2 text-xs text-dim">{gap.detail}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  note,
  trust,
  band,
}: {
  label: string;
  value: string;
  note: string;
  trust: DashboardDTO["retentionTrust"];
  band?: "pos" | "warn" | "neg" | null;
}) {
  return (
    <div className="bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-muted">{label}</div>
        <Badge tone={trustTone(trust)}>{trustLabel(trust)}</Badge>
      </div>
      <div
        className={cn(
          "mt-2 text-2xl font-semibold tracking-tight",
          band === "pos" && "text-teal",
          band === "warn" && "text-amber",
          band === "neg" && "text-rose",
        )}
      >
        {value}
      </div>
      <p className="mt-2 text-[11px] leading-4 text-dim">{note}</p>
    </div>
  );
}

function BlockedCard({ label, summary }: { label: string; summary: string }) {
  return (
    <div className="bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-muted">{label}</div>
        <Badge tone="amber">Unavailable</Badge>
      </div>
      <div className="mt-2 text-2xl font-semibold text-dim">—</div>
      <p className="mt-2 text-[11px] leading-4 text-dim">{summary}</p>
    </div>
  );
}
