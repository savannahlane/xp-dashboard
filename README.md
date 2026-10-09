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

Amounts use `decimal.js`. Display is cents, labeled **Converted ARR ($)**. The Account Team column is `Annual Recurring Revenue (A) (converted)`. No ISO currency code is stored.

The measurement window is `meta.period_start` through `meta.period_end` (FY26 year to date, 2026-01-01 to 2026-09-17). Ending ARR is `arr_current` as of the period end. It is not a fiscal year-end close.

### Gross retention

For each product an account owned at the start (`arr_start` > 0):

```
retained_arr = min(arr_start, max(arr_current, 0))
gross_retention = min(1, sum(retained_arr) / sum(arr_start))
```

Calculated at product, account, and XP-book level. Duplicate rows for the same account and product string are summed before `min`. The product string is the documented identity. A different string is a different product.

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

Blocked. No stored score and no documented aggregation. The dashboard does not average `cec_grade` or at-risk counts. See [DISCOVERY.md](DISCOVERY.md).

### Pipeline

Open stages, verified in the shipped feed and the existing engine: Discovery, Proposal, Negotiation. `Closed Won` is excluded. Any other stage is excluded as unrecognized.

The total is the sum of `opportunities.arr` after collapsing duplicate opportunity ids. Conflicting duplicates are dropped. The total is unweighted because probability is not in the feed. `Opportunity.Amount` is not present and is not assumed.

New-business and renewal splits are blocked. `renewals.expansion_arr` is not added to the opportunity total.

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

- No health score, scale, timestamp, cadence, drivers, or book-health rule.
- No Opportunity Type, Record Type, Amount, Probability, Owner, name, or org URL.
- No open renewal pipeline and no verified New Business value.
- No contract start, end, or term.
- No subscription id, SKU, or product family.
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

## Questions

1. Which source field and which exact values should split open pipeline into New Business and Renewal?
2. Once an account health score exists, should XP book health be a straight average or an ARR-weighted average?
3. Is the product-name grain approved until a subscription id exists?
4. Which ISO currency does “converted” ARR use, and what is the Salesforce org domain for record links?
