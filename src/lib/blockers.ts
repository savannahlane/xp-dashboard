export type Blocker = {
  id: string;
  title: string;
  summary: string;
  detail: string;
};

export const BLOCKERS = {
  bookHealth: {
    id: "book_health",
    title: "Book health",
    summary:
      "No stored XP book-health rollup is in this dataset, and the repository does not document an aggregation rule.",
    detail:
      "A straight average and an ARR-weighted average of account scores would produce different results. Neither is approved, so no average is shown. CAPDB Engagement Cloud Grade (cec_grade) is a separate report column and is not used as a health score.",
  },
  accountHealth: {
    id: "account_health",
    title: "Account health",
    summary:
      "No account health score, scale, refresh time, cadence, or component drivers are in the Account Team export or the other feeds.",
    detail:
      "The report includes CAPDB Engagement Cloud Grade (A–D), open at-risk event counts, and lifetime at-risk event counts. None of these is documented as a health score, so no band or driver breakdown is derived.",
  },
  newBusinessPipeline: {
    id: "new_business_pipeline",
    title: "Open new-business pipeline",
    summary: "No Opportunity Type or Record Type value for New Business is present.",
    detail:
      "The opportunities feed has sales_process, stage, close_date, arr, and sourced_by. It has no Type, Record Type, Amount, or Probability. Observed sales_process values are Win-Back, New Program, Competitive Displacement, Cross-Sell, Co-Term, and Upsell. The repository does not map any of those to New Business.",
  },
  renewalPipeline: {
    id: "renewal_pipeline",
    title: "Open renewal pipeline",
    summary: "No open renewal pipeline is stored.",
    detail:
      "Renewals are a separate feed of closed renewal opportunities (outcome Renewed, Downgraded, or Churned). That feed is not an open pipeline. expansion_arr on those rows is not added to opportunity totals. Opportunity sales_process has no Renewal value.",
  },
  contractDates: {
    id: "contract_dates",
    title: "Contract and subscription dates",
    summary: "Contract start, contract end, and subscription term are not in any feed.",
    detail:
      "Renewals include close_date and days_closed_before_term_end. Onboarding includes implementation start and go-live dates. None of these is a contract start, contract end, or term, so they are not shown as contract dates.",
  },
  opportunityRecord: {
    id: "opportunity_record",
    title: "Opportunity record fields",
    summary:
      "Name, Type, Record Type, Amount, Probability, Owner, and a Salesforce record URL are not in the feed.",
    detail:
      "Totals use the arr column on the opportunities feed. That column is documented as ARR, not Opportunity.Amount. xp_id on the row is the feed's XP column, not Opportunity.Owner. No Salesforce instance URL is configured, so record links are omitted.",
  },
  assignmentHistory: {
    id: "assignment_history",
    title: "XP assignment history",
    summary: "No effective-dated XP assignment history is stored.",
    detail:
      "The documented rule attributes the whole period to the account's current owner on the Account Team report. product_arr.xp_id is used only when the account is absent from that report.",
  },
  productIdentity: {
    id: "product_identity",
    title: "Product identity",
    summary: "No subscription id, product id, SKU, or product family column is in the product ARR feed.",
    detail:
      "The feed is documented as one row per account per product, and the existing metric engine matches on the product column (solution-area name). Gross retention uses that documented grain. A renewal that continues under a different product string is not matched.",
  },
  pointInTimeArr: {
    id: "point_in_time_arr",
    title: "Point-in-time ARR",
    summary:
      "The product ARR feed stores arr_start and arr_current for one period. It is not a snapshot history, and the shipped rows are sample.",
    detail:
      "Period bounds are meta.period_start and meta.period_end. There is no snapshot date on each row and no prior-year snapshot table. When this feed is missing, retention is left unavailable. Current Account Team ARR is never used to reconstruct a starting book.",
  },
  fiscalCalendar: {
    id: "fiscal_calendar",
    title: "Fiscal calendar",
    summary: "No fiscal-year settings object is in the repository.",
    detail:
      "The dataset labels the window FY26 year to date and sets period_start to 2026-01-01. The dashboard uses those fields as the measurement window. It does not apply a separate fiscal calendar.",
  },
  vpHierarchy: {
    id: "vp_hierarchy",
    title: "VP hierarchy",
    summary: "No manager or VP relationship is stored.",
    detail:
      "Partners have a team boolean used by the existing My team scope. All XPs is the only book-wide view.",
  },
  currencyCode: {
    id: "currency_code",
    title: "Currency code",
    summary:
      "The Account Team column is Annual Recurring Revenue (A) (converted). No ISO currency code is stored.",
    detail:
      "Amounts are labeled Converted ARR and formatted with a dollar sign, matching the existing dashboard.",
  },
  authorization: {
    id: "authorization",
    title: "Row-level access",
    summary: "The repository has no authentication or row-level security layer.",
    detail:
      "The static dashboard treats repository or SharePoint access as the boundary. This app does not add a separate role model.",
  },
} as const satisfies Record<string, Blocker>;

export const BLOCKER_LIST: Blocker[] = Object.values(BLOCKERS);
