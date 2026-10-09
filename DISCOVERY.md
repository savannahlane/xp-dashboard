# Discovery report

Sources inspected: `files/index.html` (embedded dataset and metric engine), `files/README.md`, and `data/book-of-business.json` (identical to the embedded seed; also stored in `files/xp-dashboard.zip`).

This repository has no warehouse models, Salesforce describe metadata, live CRM connection, or database schema. Names below are the Account Team report labels and the feed column names the existing dashboard already uses. Salesforce API names are marked not found when only a report label exists.

Point-in-time ARR: the product feed has two amounts, `arr_start` and `arr_current`, for one window (`meta.period_start` / `meta.period_end`). There is no snapshot-date column and no snapshot history. The shipped product rows are sample.

XP assignment history: not stored. The existing engine attributes the whole period to the account’s current owner. That is the documented rule, so the dashboard follows it.

| Metric | Required field | Source object/table | Exact API name/column | Found | Notes |
|---|---|---|---|---|---|
| XP identifier | XP id | Account Team report, normalized `partners` / `accounts` | Report label `Team Member Name` → `xp_id` | Y | Display name and id are the same string. No separate Experience Partner id. |
| XP display name | Name | `partners` | `name` | Y | Copied from `Team Member Name`. |
| XP → account assignment | Current owner | Account Team report | `Team Member Name` → `accounts.xp_id` | Y | One current owner per account. |
| XP assignment history | Effective dates | — | — | N | README: no history. Current owner keeps the whole period. |
| Manager / VP hierarchy | Manager, VP | `partners` | `team` (boolean only) | N | `team` is the existing “My team” flag. No VP rollup. |
| Account identifier | Account id | Account Team report | `Account ID - 18` → `account_id` | Y | 18-character ids, prefix `001`. |
| Account name | Name | Account Team report | `Account Name` → `account_name` | Y | Sample churned accounts exist only on the product/renewal feeds. |
| Current account ARR | Current converted ARR | Account Team report | `Annual Recurring Revenue (A) (converted)`, fallback `Annual Recurring Revenue (A)` → `arr` | Y | Single as-of value for 2026-09-17. Not a starting snapshot. |
| ARR snapshot date | Snapshot date | `meta` | `generated`, `period_end` | Partial | No per-row snapshot date. |
| Product / subscription id | Stable subscription id | Product ARR feed | — | N | Grain is `account_id` + `product`. |
| Product name | Product | Product ARR feed | `product` | Y | Solution-area name. Documented match key. Sample feed. |
| SKU | SKU | — | — | N | |
| Product family | Family | — | — | N | |
| Product starting ARR | ARR at period start | Product ARR feed | `arr_start` | Y | Sample. “ARR on the first day of the period.” |
| Product ending ARR | ARR at period end | Product ARR feed | `arr_current` | Y | Sample. As of `period_end`, not a fiscal year-end close. |
| Contract start | Start date | — | — | N | |
| Contract end | End date | — | — | N | |
| Subscription term | Term | — | — | N | Renewals have `days_closed_before_term_end`, which is not a term. |
| Churn | Outcome or zero ending ARR | Renewals feed; product ARR | `outcome` = `Churned`; product `arr_current` = 0 | Partial | Outcome is sample and closed-only. Gross retention uses the product snapshots, not the outcome label. |
| Cancellation | Cancellation flag | — | — | N | Not separate from churn. |
| Downgrade | Partial decline | Renewals feed; product ARR | `outcome` = `Downgraded`; ending &lt; starting on the same product | Partial | Product math calls this contraction. |
| Expansion / upsell / cross-sell | Classified growth | Opportunities `sales_process`; renewals `expansion_arr` | Values present on the sample feeds, not a Type or Record Type | Partial | Not used to split pipeline. Same-product growth is “expansion” only as a snapshot delta. |
| Account health score | Score | — | — | N | |
| Health scale | Scale | — | — | N | |
| Health timestamp | As of | — | — | N | |
| Health cadence | Cadence | — | — | N | |
| Health component drivers | Drivers | — | — | N | |
| Engagement grade | Grade | Account Team report | `CAPDB Engagement Cloud Grade` → `cec_grade` | Y | A–D or blank. Not documented as a health score. Not displayed as one. |
| At-risk counts | Counts | Account Team report | `Open At Risk Events`, `# of At Risk Events` | Y | Counts only. |
| Opportunity id | Id | Opportunities feed | `opportunity_id` | Y | Sample ids. Not joined to renewals. |
| Opportunity name | Name | — | — | N | |
| Opportunity account | Account | Opportunities feed | `account_id` | Y | Name comes from the account or renewal feed. |
| Opportunity amount | Amount | — | — | N | Not assumed to be ARR. |
| Opportunity ARR | Pipeline measure | Opportunities feed | `arr` | Y | Documented measure. Unweighted. Sample. |
| Stage | Stage | Opportunities feed | `stage` | Y | `Closed Won`, `Negotiation`, `Proposal`, `Discovery`. |
| Status / closed flag | IsClosed | — | — | N | Open = Discovery, Proposal, Negotiation. `Closed Won` excluded. Any other stage is unrecognized and excluded. |
| Opportunity type | Type | — | — | N | |
| Record type | Record type | — | — | N | |
| Sales process | Process name | Opportunities feed | `sales_process` | Y | `Win-Back`, `New Program`, `Competitive Displacement`, `Cross-Sell`, `Co-Term`, `Upsell`. Not mapped to New Business or Renewal. |
| Probability | Probability | — | — | N | No weighted amount. |
| Close date | Close date | Opportunities feed | `close_date` | Y | |
| Opportunity owner | Owner | — | — | N | `xp_id` is the feed’s XP column, not Opportunity.Owner. |
| Sourced by | XP or AE | Opportunities feed | `sourced_by` | Y | `XP` or `AE`. Both count in unsplit open pipeline. |
| Salesforce record URL | Link | — | — | N | No org domain configured. |
| New Business pipeline | Open NB ARR | — | — | N | Blocked. No verified Type or Record Type. |
| Renewal pipeline | Open renewal ARR | Renewals feed | Closed outcomes only | N | Feed is closed renewals. `expansion_arr` is not added to opportunity totals. |
| Book health | XP rollup | — | — | N | No stored rollup and no documented average. Not calculated. |
| Fiscal year settings | Fiscal calendar | `meta` | `period_label`, `period_start`, `period_end` | Partial | Label is `FY26 year to date`. Start is 2026-01-01. No FiscalYearSettings object. |
| Currency code | ISO code | Account Team report | Column says `(converted)` | N | Shown as Converted ARR with `$`, matching the existing page. |
| Row-level security | Authz | — | — | N | Access is the repo/host boundary. No role model added. |

## Opportunity type values

There is no Opportunity Type or Record Type column. The opportunities feed is documented as non-renewal. Observed `sales_process` values are Win-Back, New Program, Competitive Displacement, Cross-Sell, Co-Term, and Upsell. None is documented as New Business. Renewal is a separate closed feed with outcomes Renewed, Downgraded, and Churned.

## Book health

No stored XP health rollup. The points and badge system in `CFG` is not an account-health formula. A straight average and an ARR-weighted average are both unapproved, so book health is blocked.

## What the dashboard calculates

- Gross retention, net ARR change, and NRR ratio from `product_arr`, labeled sample.
- Assigned-account count and current book ARR from the Account Team report.
- Unsplit open pipeline from `opportunities.arr` for Discovery, Proposal, and Negotiation, labeled sample.

Historical retention is not reconstructed from current account ARR. If `product_arr` is missing, retention is unavailable.
