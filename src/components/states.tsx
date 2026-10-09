import type { Blocker } from "@/lib/blockers";

export function UnavailableBlock({ blocker }: { blocker: Blocker }) {
  return (
    <div className="rounded-lg border border-amber/30 bg-amber/5 p-4">
      <div className="text-xs font-semibold tracking-wide text-amber uppercase">Unavailable</div>
      <h2 className="mt-1 text-base font-semibold">{blocker.title}</h2>
      <p className="mt-2 text-sm text-muted">{blocker.summary}</p>
      <p className="mt-2 text-sm text-dim">{blocker.detail}</p>
    </div>
  );
}

export function DataError() {
  return (
    <div className="rounded-lg border border-rose/40 bg-rose/10 p-5">
      <h1 className="text-lg font-semibold">The dataset could not be read</h1>
      <p className="mt-2 max-w-xl text-sm text-muted">
        Check that <code>data/book-of-business.json</code> is present and matches the feed columns in the README.
        This message does not include account data.
      </p>
    </div>
  );
}

export function EmptyState({ reason }: { reason: "no_selection" | "no_accounts" }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-8 text-center">
      <h2 className="text-lg font-semibold">
        {reason === "no_selection" ? "Select one or more Experience Partners" : "No accounts in this view"}
      </h2>
      <p className="mx-auto mt-2 max-w-lg text-sm text-muted">
        {reason === "no_selection"
          ? "Choose partners below. My team uses the partner team flag. All XPs is the book-wide view."
          : "None of the selected partners have accounts on the Account Team report or in the product ARR cohort."}
      </p>
    </div>
  );
}
