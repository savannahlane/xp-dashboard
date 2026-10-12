# Experience Partner dashboard

Retention, account health, and pipeline for Experience Partners. Metric math lives in `src/lib`. The original static page remains in `files/`.

This repository contains customer ARR in `files/index.html` and `data/book-of-business.json`. Keep it private.

## Data sources

| Feed | File field | Status in the shipped file | Used for |
|---|---|---|---|
| Salesforce Account Team — Experience Partners | `accounts`, `partners` | Production export, generated 2026-09-17 | XP name, current assignment, current converted ARR, account attributes |
| Product ARR | `product_arr` | Sample | Starting and ending product ARR |
| Opportunities | `opportunities` | Sample | Unsplit open pipeline (`arr`) |
| Renewal outcomes | `renewals` | Sample | Account names for cohort rows missing from the Account Team report. Not used as open pipeline or as contract dates |
| Onboarding, activations, training | Present on the static page | Sample | Not used by this dashboard |

There is no warehouse, Salesforce API client, or database. Column mappings are in [DISCOVERY.md](DISCOVERY.md).

`BOOK_DATA_PATH` overrides the dataset path. The default is `data/book-of-business.json`. No other environment variables are required. Do not put secrets in the dataset path.

## Metric formulas

Amounts use `decimal.js`. Display is cents, labeled **USD**. The Account Team column is `Annual Recurring Revenue (A) (converted)`, and that converted amount is USD.

The measurement window is `meta.period_start` through `meta.period_end` (FY26 year to date, 2026-01-01 to 2026-09-17). Ending ARR is `arr_current` as of the period end. It is not a fiscal year-end close.

### Gross retention

For each product an account owned at the start (`arr_start` > 0):

```
retained_arr = min(arr_start, max(arr_current, 0))
gross_retention = min(1, sum(retained_arr) / sum(arr_start))
```

Calculated at product, account, and XP-book level. Duplicate rows for the same account and product string are summed before `min`. Product name is the approved identity until a subscription id exists. A different string is a different product.

Expansion does not raise gross retention. Downgrades and churn lower it. A product with no starting ARR is excluded. A churned product stays in the starting cohort with ending ARR of zero. Each result is capped at 100%.

### Net ARR change and NRR ratio

Starting cohort = accounts whose product starting ARR is greater than zero.

```
net_arr_change = (sum(ending ARR) − sum(starting ARR)) / sum(starting ARR)
nrr_ratio      = sum(ending ARR) / sum(starting ARR)
```

Ending ARR includes expansion, contraction, churn, and products added to those accounts. New-logo accounts (no starting ARR) are excluded from both sums. Churned accounts stay in, with ending ARR of zero. A zero denominator is shown as undefined, not as zero or infinity.

The existing static page’s “NRR” is `nrr_ratio`. This dashboard shows that ratio and the requested net change as separate figures. Annual targets from `CFG.targets` are 94% gross and 106% NRR ratio. YTD pace follows the existing formula: year fraction = days in the window / 365, then the annual gap is scaled by that fraction. Pace is not applied to net ARR change.

### Book health and account health

Book health is an ARR-weighted average of stored account health scores. The weight is current Account Team ARR. Accounts with no score are left out of both the numerator and the denominator. No account health score, scale, or drivers are stored, so the rollup stays unavailable. `cec_grade` is not turned into a score.

### Pipeline

Open stages, verified in the shipped feed and the existing engine: Discovery, Proposal, Negotiation. `Closed Won` is excluded. Any other stage is excluded as unrecognized.

The total is the sum of `opportunities.arr` after collapsing duplicate opportunity ids. Conflicting duplicates are dropped. The total is unweighted because probability is not in the feed. `Opportunity.Amount` is not present and is not assumed.

Open new-business pipeline is that same `arr` where `Type` is `New Business`. Open renewal pipeline is `arr` where `Type` is `Existing Business`. Closed stages stay out of both. `sales_process` is not a substitute for Type. `renewals.expansion_arr` is not added. The shipped opportunities file has no `type` column, so both splits stay unavailable until that column is uploaded.

### Cohort and assignment

- Retention uses the product ARR cohort. Accounts on the team report with no product rows are counted as assigned and their retention is unavailable.
- New logos stay on the account list and outside both rates.
- The current `accounts.xp_id` wins over `product_arr.xp_id`.
- If the account is absent from the team report, the product row’s `xp_id` is the fallback. Disagreeing fallbacks are left unassigned.
- There is no effective-dated assignment history.

### Fiscal year

No fiscal calendar object. The dashboard labels the window with `meta.period_label` and the two period dates. FY26 in this file starts on 1 January.

A snapshot is stale when `meta.generated` is more than 7 days before today, matching the README’s weekly refresh.

## Known data gaps

- No account health score, so the approved ARR-weighted book-health average cannot be calculated.
- The shipped opportunities feed has no `type` column. The rule is `New Business` versus `Existing Business` (renewal).
- No opportunity name, Record Type, Amount, Probability, or Owner.
- Record links use `https://granicus.lightning.force.com/` for Salesforce Account (`001`) and Opportunity (`006`) ids. The shipped opportunity ids are sample ids, so those links are omitted.
- No contract start, end, or term.
- No subscription id, SKU, or product family. Product name is the approved grain for now.
- No XP assignment history and no VP hierarchy.
- Product ARR, opportunities, and renewals are sample until replaced.
- No row-level security beyond whoever can read this app.

## Local setup

```bash
npm install
npm test
npm run typecheck
npm run lint
npm run build
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Optional:

```bash
BOOK_DATA_PATH=/absolute/path/book-of-business.json npm run dev
```

## Confirmed rules

- Opportunity `Type` of `New Business` is new business. `Existing Business` is renewal.
- Book health, once account scores exist, is an ARR-weighted average.
- Product name remains the product identity until a subscription id is available.
- Currency is USD. Salesforce links use `https://granicus.lightning.force.com/`.
