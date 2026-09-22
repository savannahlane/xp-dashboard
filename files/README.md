# Book of Business — Experience Partner dashboard

A single static page. No build step, no server. Drop it in a repo, turn on GitHub Pages,
and it runs. Files are parsed in the browser; nothing is sent anywhere.

It shows retention across the whole book, ranks partners on metrics that come out of
Salesforce and Wrike rather than self-reporting, and lets you open any partner to see
their accounts, points, and badges.

## ⚠ This repo contains customer ARR

`index.html` and `data/book-of-business.json` both carry the Account Team report —
492 accounts with ARR. Keep the repo private, or host it in SharePoint where the
permissions already match who should see account financials. Do not make it public.

## What's real and what's sample

| Feed | Source | Status as shipped |
|---|---|---|
| Accounts | Salesforce — Account Team, Experience Partners | **Real**, 2026-09-17 |
| Product ARR | Salesforce — subscription/asset ARR by product | Sample |
| Renewal outcomes | Salesforce — closed renewal opportunities | Sample |
| Opportunities | Salesforce — non-renewal opportunities, XP and AE | Sample |
| Onboarding projects | Wrike — weekly dashboard export | Sample |
| Catalog activations | Wrike — completed activation tasks | Sample |
| Training completions | Wrike — training environment | Sample |

Sample rows are generated against the real account IDs and partner names so every view
works, and every page shows a banner until the sample feeds are replaced. Sample churned
accounts are named "Sample churned account N". Retention, points, and badges are not real
until renewals and opportunities are uploaded.

## Repo layout

```
index.html                    the dashboard, with the current dataset embedded
data/book-of-business.json    the dataset the page loads on open
templates/*.csv               column templates for the six feeds besides the account report
README.md
```

## Deploy

1. Create a private repo and push these files.
2. Settings → Pages → deploy from `main`, root folder.
3. Viewers need repo access to open a Pages site on a private repo.

## Weekly refresh

1. Export the Account Team — Experience Partners report from Salesforce as .xlsx.
   Upload it as-is; grouping and subtotal rows are handled.
2. Export the other six feeds (templates in `templates/`).
3. Dashboard → **Data** tab → drop each file on its row.
4. Check the team list. New partner names start unchecked.
5. **Download dataset** and commit it as `data/book-of-business.json`.

The page compares the committed file with whatever is cached in each viewer's browser
and uses the newer one, so a fresh commit reaches everyone without cache-clearing.

Reading .xlsx loads SheetJS from cdnjs the first time. If that's blocked on your network,
save the export as CSV — the parser handles both.

## Retention definitions

Targets: **NRR 106%, GRR 94%**, both annual. Edit `CFG.targets`.

```
NRR = ARR today ÷ ARR at start of year                       (starting customers only)
GRR = Σ min(product ARR today, product ARR at start) ÷ Σ product ARR at start
```

NRR counts any growth — XP-sourced, AE-sourced, uplift, new products. GRR caps every
account-product pair at its starting value, so a new product on one account never offsets
a lost product on another, and uplift never offsets contraction. New logos (accounts with
no starting ARR) sit outside both rates.

**Pace.** A YTD reading is compared to a pro-rated target: in mid-September, about 71% of
the year has passed, so NRR pace is ~104.3% and GRR pace ~95.7%. Green is at or above
pace, amber within a point, red below. Renewals are lumpy — a partner with a heavy Q4
will read behind pace until Q4.

**Both rates need the Product ARR feed**: one row per account per product with
`arr_start` (ARR on the first day of the period) and `arr_current`. Churned accounts
belong in it with `arr_current` = 0; the Account Team report won't carry them.

**Without it**, the dashboard falls back to deriving the starting book from the account
report plus renewal and opportunity deltas. That version nets gains and losses inside
each renewal, which overstates GRR — on the shipped sample, 98.2% versus 95.7%
product-level. The ledger states which method is in use.

**Attribution follows the account's current owner** in the Salesforce report, so a
rebalanced account brings its whole period with it.

## Opportunity sourcing

`sourced_by` on opportunities is `XP` or `AE`. Both count fully toward NRR, per the
definition above. For **points**, XP-sourced growth scores at 150 per 1% of starting ARR
and AE-sourced at 40 — the XP gets influence credit for growth on their book without being
paid in points for the AE's deal. Change the ratio in `CFG.points` if you disagree.

## Scoring

All in `CFG` and `BADGES` at the top of the script. The Scoring tab reads those same
objects, so it documents itself.

Dollar outcomes (growth, uplift, at-risk saves) score as a **share of the partner's
starting book**, not raw dollars. With raw dollars, a new XP3 on a $1.3M book could never
catch a $5M book no matter how well they ran it. Activity points (go-lives, activations,
training) are flat.

Level thresholds are set for a fiscal year-to-date view in September, with headroom above
the current leader. Revisit them at year end.

## Clouds and solution areas

Catalog items use the solution-area names from the Salesforce report (Agenda & Video,
Email & SMS, Public Records Request, and so on). The **Every cloud** badge checks
Operations, Engagement, and Service Cloud — edit `CFG.clouds` if that's the wrong set.
The Wrike activation export supplies its own `cloud` column; the sample data's
solution-area-to-cloud mapping is a guess and goes away when real data arrives.

## Connecting SharePoint later

The simplest durable path is a scheduled Power Automate flow that picks up the weekly
exports from a SharePoint folder and commits the merged JSON to the repo through the
GitHub API. No change to this page. Browser-side Microsoft Graph is possible but needs an
app registration and makes the page depend on an auth flow.

## Known limits

- No history. Each upload replaces the last. Dated JSON snapshots in `data/` would fix it.
- Partner names must match across feeds (accents and case are ignored).
- The waterfall trims its axis so small deltas are visible; the axis start is labeled.
