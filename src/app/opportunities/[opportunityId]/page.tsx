import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Shell } from "@/components/shell";
import { DataError, UnavailableBlock } from "@/components/states";
import { loadBook } from "@/lib/book";
import { CURRENCY_LABEL, formatMoney } from "@/lib/money";
import { getOpportunityDetail } from "@/lib/query";

export default async function OpportunityPage({
  params,
}: {
  params: Promise<{ opportunityId: string }>;
}) {
  const { opportunityId } = await params;
  const loaded = loadBook();
  if (!loaded.ok) {
    return (
      <Shell>
        <DataError />
      </Shell>
    );
  }
  const opportunity = getOpportunityDetail(loaded.book, decodeURIComponent(opportunityId));
  if (!opportunity) {
    return (
      <Shell>
        <h1 className="text-xl font-semibold">That record is not in the dataset</h1>
        <p className="mt-2 text-sm text-muted">The opportunity id does not match a loaded row.</p>
        <Link href="/" className="mt-4 inline-block text-sm text-brass">
          Back to the dashboard
        </Link>
      </Shell>
    );
  }

  return (
    <Shell>
      <Link href={`/accounts/${encodeURIComponent(opportunity.accountId)}`} className="text-sm text-muted hover:text-foreground">
        ← {opportunity.accountName}
      </Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{opportunity.opportunityId}</h1>
          <p className="mt-1 text-sm text-muted">Opportunity name is not in the feed. The id is the label.</p>
        </div>
        {opportunity.pipelineTrust === "sample" ? <Badge tone="amber">Sample feed</Badge> : <Badge tone="teal">Loaded</Badge>}
      </div>

      <dl className="mt-5 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2">
        <Item label="Opportunity id" value={opportunity.opportunityId} />
        <Item label="Account" value={`${opportunity.accountName} · ${opportunity.accountId}`} />
        <Item label="Type / record type" value="Unavailable" />
        <Item label="Sales process" value={opportunity.salesProcess || "Blank"} />
        <Item label="Stage" value={opportunity.stage || "Blank"} />
        <Item label="Close date" value={opportunity.closeDate || "Blank"} />
        <Item label="Amount" value="Unavailable" />
        <Item label={`Value used in totals (${CURRENCY_LABEL})`} value={formatMoney(opportunity.arr)} />
        <Item label="Probability" value="Unavailable" />
        <Item label="Owner" value="Unavailable" />
        <Item label="XP column on the row" value={opportunity.xpOnRow || "Blank"} />
        <Item label="Sourced by" value={opportunity.sourcedBy || "Blank"} />
        <Item
          label="Open pipeline"
          value={opportunity.includedInOpenPipeline ? "Included · arr, unweighted" : `Excluded · stage is ${opportunity.stageClass}`}
        />
        <Item label="Salesforce record" value="Unavailable" />
      </dl>

      <div className="mt-5 grid gap-4">
        <UnavailableBlock blocker={opportunity.recordGaps.blocker} />
        <UnavailableBlock blocker={opportunity.newBusinessPipeline.blocker} />
        <UnavailableBlock blocker={opportunity.renewalPipeline.blocker} />
      </div>
    </Shell>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface px-4 py-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 text-sm">{value}</dd>
    </div>
  );
}
