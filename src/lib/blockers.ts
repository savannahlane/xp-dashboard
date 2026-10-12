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
      "Book health is an ARR-weighted average of account health scores. No account health score is stored, so the rollup cannot be calculated.",
    detail:
      "The approved weight is current Account Team ARR. Accounts with no score are left out of the average. CAPDB Engagement Cloud Grade (cec_grade) is not converted into a score.",
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
    summary: "Opportunity Type is not in the shipped opportunities feed.",
    detail:
      "Open new-business pipeline is opportunities.arr where Type is New Business and the stage is open. sales_process is not used as a substitute. The shipped file has no type column.",
  },
  renewalPipeline: {
    id: "renewal_pipeline",
    title: "Open renewal pipeline",
    summary: "Opportunity Type is not in the shipped opportunities feed.",
    detail:
      "Open renewal pipeline is opportunities.arr where Type is Existing Business and the stage is open. The closed renewals feed and expansion_arr are not added to that total.",
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
    summary: "Name, Record Type, Amount, Probability, and Owner are not in the feed.",
    detail:
      "Totals use the arr column, in USD. That column is the feed's ARR measure, not Opportunity.Amount. Type is read when the column is present. Record links use https://granicus.lightning.force.com/ when the id is a Salesforce Account (001) or Opportunity (006) id.",
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
    summary: "Product name is the approved identity until a subscription id exists.",
    detail:
      "There is no subscription id, SKU, or product family column. Gross retention matches the product column. A renewal that continues under a different product string is a different product.",
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
    summary: "Converted ARR is USD.",
    detail:
      "The Account Team column is Annual Recurring Revenue (A) (converted). Amounts are labeled USD.",
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
