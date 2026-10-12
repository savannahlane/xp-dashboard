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
| Product name | Product | Product ARR feed | `product` | Y | Approved identity until a subscription id exists. Sample feed. |
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
| Opportunity type | Type | Opportunities feed | `type` / Salesforce `Type` | Rule Y, column N | Values: `New Business`, `Existing Business` (renewal). The shipped file has no column. `sales_process` is not a substitute. |
| Record type | Record type | — | — | N | |
| Sales process | Process name | Opportunities feed | `sales_process` | Y | `Win-Back`, `New Program`, `Competitive Displacement`, `Cross-Sell`, `Co-Term`, `Upsell`. Not mapped to New Business or Renewal. |
| Probability | Probability | — | — | N | No weighted amount. |
| Close date | Close date | Opportunities feed | `close_date` | Y | |
| Opportunity owner | Owner | — | — | N | `xp_id` is the feed’s XP column, not Opportunity.Owner. |
| Sourced by | XP or AE | Opportunities feed | `sourced_by` | Y | `XP` or `AE`. Both count in unsplit open pipeline. |
| Salesforce record URL | Link | Granicus Lightning | `https://granicus.lightning.force.com/lightning/r/{Object}/{Id}/view` | Y | Built for Account `001` and Opportunity `006` ids. Shipped opportunity ids are sample, so those links are omitted. |
| New Business pipeline | Open NB ARR | Opportunities `type` + `arr` | `Type` = `New Business` | Rule Y, column N | Calculated when `type` is present. Shipped file cannot compute it. |
| Renewal pipeline | Open renewal ARR | Opportunities `type` + `arr` | `Type` = `Existing Business` | Rule Y, column N | Open only. Closed renewals and `expansion_arr` are not added. |
| Book health | XP rollup | Account health scores | ARR-weighted average | Rule Y, scores N | Weight is current Account Team ARR. No score is stored. |
| Fiscal year settings | Fiscal calendar | `meta` | `period_label`, `period_start`, `period_end` | Partial | Label is `FY26 year to date`. Start is 2026-01-01. No FiscalYearSettings object. |
| Currency code | ISO code | Confirmed | USD | Y | Account Team column remains `Annual Recurring Revenue (A) (converted)`. |
| Row-level security | Authz | — | — | N | Access is the repo/host boundary. No role model added. |

## Opportunity type values

Opportunity Type is `New Business` or `Existing Business`. Existing Business is renewal. The shipped opportunities feed does not include that column, so the dashboard does not classify `sales_process` values (Win-Back, New Program, Competitive Displacement, Cross-Sell, Co-Term, Upsell) into either pipeline.

## Book health

The approved rollup is an ARR-weighted average of account health scores, weighted by current Account Team ARR. No account health score is stored, so the average is not shown. `cec_grade` is not used as that score.

## What the dashboard calculates

- Gross retention, net ARR change, and NRR ratio from `product_arr`, labeled sample.
- Assigned-account count and current book ARR from the Account Team report.
- Unsplit open pipeline from `opportunities.arr` for Discovery, Proposal, and Negotiation, labeled sample.
- New-business and renewal pipeline when `type` is present (`New Business` and `Existing Business`). The shipped file does not include that column.
- Salesforce record links for real Account and Opportunity ids. Amounts are labeled USD.

Historical retention is not reconstructed from current account ARR. If `product_arr` is missing, retention is unavailable.
