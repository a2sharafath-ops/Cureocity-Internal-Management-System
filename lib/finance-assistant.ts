import {
  CUREOCITY_ASSISTANT_POLICY_VERSION,
  FINANCE_REVIEW_TASK_KEY,
  assistantTaskManifest,
} from "@/lib/cureocity-assistant-policy";

export const FINANCE_WORKFLOWS = [
  {
    key: "invoice_payment_reconciliation",
    label: "Invoice and payment reconciliation",
    destinations: [
      { label: "Billing", href: "/billing?tab=invoices", purpose: "Open the existing invoice workspace." },
      { label: "Collections", href: "/finsheets?tab=sales", purpose: "Open paid collections in Finance Sheets." },
      { label: "Reports", href: "/reports", purpose: "Open the Finance-visible reporting area." },
    ],
    checks: [
      "Independently verify the period, currency, invoice identity, payment source, status, dates, reference and approved reconciliation basis.",
      "Investigate differences in the source systems and document the human conclusion through the approved finance workflow.",
      "The Assistant does not read invoices or payments, calculate totals, assert a variance or match, record payment, post an entry, reconcile or contact anyone.",
    ],
  },
  {
    key: "refund_void_review_preparation",
    label: "Refund and void review preparation",
    destinations: [
      { label: "Refunds and credits", href: "/billing?tab=refunds", purpose: "Open the existing refund and credit view." },
      { label: "Paid invoices", href: "/billing?status=paid", purpose: "Open the existing paid-invoice view for independent source review." },
      { label: "Collections", href: "/finsheets?tab=sales", purpose: "Open collections for independent ledger verification." },
    ],
    checks: [
      "Independently verify the invoice, settled status, payment source, amount, reason, authority, supporting evidence and duplicate-operation safeguards.",
      "Use the existing atomic finance workflow and required human authorization for any permitted reversal.",
      "The Assistant does not determine eligibility, recommend a decision, refund, void, credit, reverse a ledger entry, approve or contact anyone.",
    ],
  },
  {
    key: "expense_reimbursement_evidence",
    label: "Expense and reimbursement evidence",
    destinations: [
      { label: "Expenses", href: "/expenses", purpose: "Open the Finance-visible expense area." },
      { label: "Reimbursements", href: "/finsheets?tab=reimburse", purpose: "Open the existing reimbursement workflow." },
      { label: "Payables", href: "/finsheets?tab=payable", purpose: "Open the existing payables workflow." },
    ],
    checks: [
      "Independently verify claimant or vendor, business purpose, date, amount, currency, receipt, category, duplicate risk, authority and payment state.",
      "Keep missing evidence separate from approval and payment decisions; follow the existing role separation.",
      "The Assistant does not read a claim or receipt, categorize, calculate, create, edit, approve, reject, reimburse, pay, post or change petty cash.",
    ],
  },
  {
    key: "reporting_and_control_review",
    label: "Reporting and control review",
    destinations: [
      { label: "Reports", href: "/reports", purpose: "Open the Finance-visible reporting area." },
      { label: "Bank ledger", href: "/finsheets?tab=bank", purpose: "Open the existing bank-ledger view." },
      { label: "Subscriptions", href: "/subscriptions", purpose: "Open the existing subscriptions area." },
    ],
    checks: [
      "Independently confirm reporting period, currency, source coverage, cut-off, status filters, reconciliation state and responsible reviewer.",
      "Treat displayed summaries as working views and resolve exceptions against authoritative source records.",
      "The Assistant does not read reports or accounts, calculate a balance or forecast, infer a control breach, change a subscription, price or budget, post an entry or issue a statement.",
    ],
  },
] as const;

export type FinanceWorkflowKey = (typeof FINANCE_WORKFLOWS)[number]["key"];
export type FinanceReviewDraft = {
  policyVersion: string;
  taskVersion: string;
  title: string;
  draft: string;
  evidence: string[];
  caution: string;
  context: { role: "Finance"; workflowKey: FinanceWorkflowKey; destinations: { label: string; href: string; purpose: string }[]; checks: string[] };
};

export function isFinanceWorkflowKey(value: string): value is FinanceWorkflowKey {
  return FINANCE_WORKFLOWS.some((workflow) => workflow.key === value);
}

export function financeWorkflowProblem(value: string) {
  return isFinanceWorkflowKey(value) ? null : "Choose one approved Finance process from the list.";
}

export function buildFinanceReviewDraft(workflowKey: FinanceWorkflowKey): FinanceReviewDraft {
  const workflow = FINANCE_WORKFLOWS.find((item) => item.key === workflowKey);
  const manifest = assistantTaskManifest("Finance", FINANCE_REVIEW_TASK_KEY);
  if (!workflow || !manifest) throw new Error("Finance task policy is missing.");
  return {
    policyVersion: CUREOCITY_ASSISTANT_POLICY_VERSION,
    taskVersion: manifest.taskVersion,
    title: `${workflow.label} checklist`,
    draft: [
      `Review this static ${workflow.label.toLowerCase()} checklist:`, "", "Navigation",
      ...workflow.destinations.map((destination, index) => `${index + 1}. Open ${destination.label} (${destination.href}) — ${destination.purpose}`),
      "", "Finance controls", ...workflow.checks.map((check, index) => `${index + 1}. ${check}`), "",
      "Independently verify the real record, permission, period, currency, identity, source, status, dates, references, supporting evidence, authority, role separation and approved Cureocity finance workflow before taking any action.",
      "The Assistant has not inspected an invoice, payment, refund, expense, payable, ledger, bank, cash, reimbursement, receipt, subscription, pass, POS, report, budget, payroll, client or staff record and cannot confirm that anything exists, matches, is complete, is accurate, is eligible, is approved, is overdue, is reconciled or is paid.",
    ].join("\n"),
    evidence: [
      ...workflow.destinations.map((destination) => `${destination.label} is an existing Finance-visible destination at ${destination.href}.`),
      ...workflow.checks.map((check) => `Approved static finance boundary: ${check}`),
    ],
    caution: "Static navigation and finance-process orientation only. No invoice, payment, refund, credit, expense, payable, estimate, ledger, bank, cash, reimbursement, receipt, subscription, pass, POS, report, budget, price, payroll, salary, client, staff or message record was read; nothing was calculated, matched, categorized, raised, recorded, captured, changed, refunded, voided, credited, reversed, reimbursed, approved, paid, posted, reconciled or sent.",
    context: {
      role: "Finance",
      workflowKey,
      destinations: workflow.destinations.map(({ label, href, purpose }) => ({ label, href, purpose })),
      checks: [...workflow.checks],
    },
  };
}
