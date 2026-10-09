import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Shell } from "@/components/shell";
import { DataError, UnavailableBlock } from "@/components/states";
import { loadBook } from "@/lib/book";
import { freshness } from "@/lib/dates";
import { CURRENCY_LABEL, formatMoney, formatRate } from "@/lib/money";
import { getAccountDetail } from "@/lib/query";
import type { Movement } from "@/lib/retention";

const MOVEMENT: Record<Movement, string> = {
  churn: "Churn",
  contraction: "Contraction",
  expansion: "Expansion",
  unchanged: "Unchanged",
  new_product: "New product",
  none: "No ARR",
};

export default async function AccountPage({ params }: { params: Promise<{ accountId: string }> }) {
  const { accountId } = await params;
  const loaded = loadBook();
  if (!loaded.ok) {
    return (
      <Shell>
        <DataError />
      </Shell>
    );
  }
  const account = getAccountDetail(loaded.book, decodeURIComponent(accountId));
  if (!account) {
    return (
      <Shell>
        <h1 className="text-xl font-semibold">That record is not in the dataset</h1>
        <p className="mt-2 text-sm text-muted">The account id does not match a loaded row.</p>
        <Link href="/" className="mt-4 inline-block text-sm text-brass">
          Back to the dashboard
        </Link>
      </Shell>
    );
  }
  const today = new Date().toISOString().slice(0, 10);
  const fresh = freshness(loaded.book.meta.generated, today);
  const rollup = account.retentionTrust === "missing" ? null : account.rollup;

  return (
    <Shell>
      <Link href="/" className="text-sm text-muted hover:text-foreground">
        ← All accounts
      </Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{account.accountName}</h1>
          <p className="mt-1 text-sm text-muted">
            {account.xpName} · {account.accountId}
            {account.onAccountReport ? "" : " · Not on the current Account Team report"}
          </p>
          {account.salesforceUrl ? (
            <a href={account.salesforceUrl} className="mt-2 inline-block text-sm text-brass" target="_blank" rel="noreferrer">
              Open account in Salesforce
            </a>
          ) : null}
        </div>
        <div className="text-right text-xs text-dim">
          <div>{loaded.book.meta.periodLabel}</div>
          <div>
            As of {fresh.asOf}
            {fresh.stale ? " · stale" : ""}
          </div>
          <div>{CURRENCY_LABEL}</div>
        </div>
      </div>

      {account.retentionTrust === "sample" ? (
        <p className="mt-4 rounded-md border border-amber/40 bg-amber/10 px-3 py-2 text-sm text-amber">
          Product ARR for this account is a sample feed. The movement below is calculated from arr_start and
          arr_current. It is not reconstructed from the Account Team ARR.
        </p>
      ) : null}

      <section className="mt-5 grid gap-3 md:grid-cols-3">
        <figure className="rounded-lg border border-line bg-surface p-4">
          <figcaption className="text-xs text-muted">Starting ARR</figcaption>
          <div className="mt-1 text-xl font-semibold">
            {rollup ? formatMoney(rollup.startingArr) : "Unavailable"}
          </div>
        </figure>
        <figure className="rounded-lg border border-line bg-surface p-4">
          <figcaption className="text-xs text-muted">Ending ARR as of {loaded.book.meta.periodEnd}</figcaption>
          <div className="mt-1 text-xl font-semibold">{rollup ? formatMoney(rollup.endingArr) : "Unavailable"}</div>
        </figure>
        <figure className="rounded-lg border border-line bg-surface p-4">
          <figcaption className="text-xs text-muted">Gross retention</figcaption>
          <div className="mt-1 text-xl font-semibold">
            {rollup ? formatRate(rateText(rollup.grossRetention)) : "Unavailable"}
          </div>
          <p className="mt-1 text-[11px] text-dim">
            Net ARR change {rollup ? formatRate(rateText(rollup.netArrChangeRate), "change") : "Unavailable"} · NRR
            ratio {rollup ? formatRate(rateText(rollup.nrrRatio)) : "Unavailable"}
          </p>
        </figure>
      </section>

      <section className="mt-5 rounded-lg border border-line bg-surface">
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-base font-semibold">ARR movement</h2>
          <p className="text-xs text-dim">
            Churn is a starting product whose ending ARR is zero. Contraction is a partial decline. Expansion is growth
            on the same product string. A new product is excluded from gross retention.
          </p>
        </div>
        {rollup ? (
          <dl className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-4">
            <MovementItem label="Churn" value={formatMoney(rollup.churnArr)} />
            <MovementItem label="Contraction" value={formatMoney(rollup.contractionArr)} />
            <MovementItem label="Expansion" value={formatMoney(rollup.expansionArr)} />
            <MovementItem label="New products" value={formatMoney(rollup.newProductArr)} />
          </dl>
        ) : (
          <p className="px-4 py-6 text-sm text-muted">
            Product ARR is unavailable for this account, so starting ARR is not derived from the current Account Team
            amount.
          </p>
        )}
      </section>

      <section className="mt-5 overflow-hidden rounded-lg border border-line bg-surface">
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-base font-semibold">Product retention</h2>
          <p className="text-xs text-dim">Identity is the product column. No SKU or subscription id is stored.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-surface2 text-xs text-muted">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Product</th>
                <th className="px-3 py-2 text-right font-medium">Starting ARR</th>
                <th className="px-3 py-2 text-right font-medium">Ending ARR</th>
                <th className="px-3 py-2 text-right font-medium">Retained ARR</th>
                <th className="px-3 py-2 text-right font-medium">Gross retention</th>
                <th className="px-3 py-2 text-left font-medium">Movement</th>
              </tr>
            </thead>
            <tbody>
              {account.lines.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-muted">
                    No product ARR rows.
                  </td>
                </tr>
              ) : (
                account.lines.map((line) => (
                  <tr key={line.product} className="border-t border-line/70">
                    <td className="px-3 py-2">{line.product}</td>
                    <td className="px-3 py-2 text-right">{formatMoney(line.startingArr)}</td>
                    <td className="px-3 py-2 text-right">{formatMoney(line.endingArr)}</td>
                    <td className="px-3 py-2 text-right">{formatMoney(line.retainedArr)}</td>
                    <td className="px-3 py-2 text-right">{formatRate(rateText(line.grossRetention))}</td>
                    <td className="px-3 py-2">{MOVEMENT[line.movement]}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <UnavailableBlock blocker={account.health.blocker} />
        <UnavailableBlock blocker={account.contracts.blocker} />
      </div>

      {account.report ? (
        <section className="mt-5 rounded-lg border border-line bg-surface p-4">
          <h2 className="text-base font-semibold">Account Team fields</h2>
          <p className="mt-1 text-xs text-dim">These columns are on the Salesforce report. They are not a health score.</p>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <Field label="Current converted ARR" value={formatMoney(account.report.arr)} />
            <Field label="CAPDB Engagement Cloud Grade" value={account.report.cecGrade || "Blank"} />
            <Field label="Open at-risk events" value={String(account.report.openRiskEvents)} />
            <Field label="# of at-risk events" value={String(account.report.riskEvents)} />
            <Field label="# of open opportunities" value={String(account.report.openOpps)} />
            <Field label="Market segment" value={account.report.segment || "Blank"} />
            <Field label="Customer segment" value={account.report.tier || "Blank"} />
            <Field label="State/Province" value={account.report.state || "Blank"} />
          </dl>
        </section>
      ) : null}

      <section className="mt-5 overflow-hidden rounded-lg border border-line bg-surface">
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-base font-semibold">Opportunities</h2>
          <p className="text-xs text-dim">
            Open pipeline on this account is {formatMoney(account.openPipelineArr)} across {account.openPipelineCount}{" "}
            open rows. The measure is arr in {CURRENCY_LABEL}.
            {account.newBusinessPipeline.available
              ? ` New business ${formatMoney(account.newBusinessPipeline.arr)}. Renewal (Existing Business) ${formatMoney(account.renewalPipeline.available ? account.renewalPipeline.arr : "0")}.`
              : " Type is not in this feed, so the new-business and renewal splits are unavailable."}
            {account.pipelineTrust === "sample" ? " This feed is sample." : ""}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-surface2 text-xs text-muted">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Opportunity</th>
                <th className="px-3 py-2 text-left font-medium">Type</th>
                <th className="px-3 py-2 text-left font-medium">Sales process</th>
                <th className="px-3 py-2 text-left font-medium">Stage</th>
                <th className="px-3 py-2 text-left font-medium">Close date</th>
                <th className="px-3 py-2 text-right font-medium">ARR</th>
                <th className="px-3 py-2 text-left font-medium">In open pipeline</th>
              </tr>
            </thead>
            <tbody>
              {account.opportunities.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-muted">
                    No opportunity rows for this account.
                  </td>
                </tr>
              ) : (
                account.opportunities.map((row) => (
                  <tr key={row.opportunityId} className="border-t border-line/70">
                    <td className="px-3 py-2">
                      <Link
                        href={`/opportunities/${encodeURIComponent(row.opportunityId)}`}
                        className="hover:text-brass"
                      >
                        {row.opportunityId}
                      </Link>
                      {row.salesforceUrl ? (
                        <a href={row.salesforceUrl} className="ml-2 text-xs text-brass" target="_blank" rel="noreferrer">
                          Salesforce
                        </a>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">{typeLabel(row.typeClass, row.type)}</td>
                    <td className="px-3 py-2">{row.salesProcess || "—"}</td>
                    <td className="px-3 py-2">{row.stage || "—"}</td>
                    <td className="px-3 py-2">{row.closeDate || "—"}</td>
                    <td className="px-3 py-2 text-right">{formatMoney(row.arr)}</td>
                    <td className="px-3 py-2">
                      {row.includedInOpenPipeline ? <Badge tone="teal">Open</Badge> : <Badge>Excluded</Badge>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </Shell>
  );
}

function typeLabel(kind: string, raw: string): string {
  if (kind === "new_business") return "New Business";
  if (kind === "existing_business") return "Existing Business";
  if (kind === "missing") return "Missing";
  return raw || "Unrecognized";
}

function MovementItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface px-4 py-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 font-semibold">{value}</dd>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
  );
}

function rateText(rate: {
  status: "value" | "zero_denominator" | "excluded";
  value?: import("decimal.js").default;
  reason?: "no_starting_arr";
}) {
  if (rate.status === "value" && rate.value) return { status: "value" as const, value: rate.value.toString() };
  if (rate.status === "excluded") return { status: "excluded" as const, reason: "no_starting_arr" as const };
  if (rate.status === "zero_denominator") return { status: "zero_denominator" as const };
  return { status: "unavailable" as const };
}
