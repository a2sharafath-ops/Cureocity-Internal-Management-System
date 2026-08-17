import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { canSee } from "@/lib/roles";
import { FINANCE_WORKFLOWS, buildFinanceReviewDraft, financeWorkflowProblem } from "@/lib/finance-assistant";

describe("Finance process-checklist Assistant", () => {
  it("offers only the four approved static finance workflows", () => {
    expect(FINANCE_WORKFLOWS.map((workflow) => workflow.key)).toEqual([
      "invoice_payment_reconciliation", "refund_void_review_preparation", "expense_reimbursement_evidence", "reporting_and_control_review",
    ]);
    expect(financeWorkflowProblem("invoice_payment_reconciliation")).toBeNull();
    expect(financeWorkflowProblem("execute_refund")).toContain("approved Finance process");
  });

  it("uses only existing Finance-visible destinations", () => {
    for (const workflow of FINANCE_WORKFLOWS) for (const destination of workflow.destinations) {
      const url = new URL(destination.href, "https://cureocity.test");
      expect(canSee("Finance", url.pathname), destination.href).toBe(true);
    }
  });

  it("builds deterministic guidance with transaction hard stops", () => {
    const result = buildFinanceReviewDraft("refund_void_review_preparation");
    expect(result).toMatchObject({ policyVersion: "2026-08-17.1", taskVersion: "finance.process_checklist.v1", title: "Refund and void review preparation checklist", context: { role: "Finance", workflowKey: "refund_void_review_preparation" } });
    expect(result.draft).toContain("does not determine eligibility");
    expect(result.draft).toContain("cannot confirm that anything exists, matches");
    expect(result.caution).toContain("No invoice, payment, refund");
    expect(JSON.stringify(result.context)).not.toMatch(/client_id|invoice_id|payment_id|expense_id|staff_id|email|phone|record_id/i);
  });

  it("has no free-text, AI, finance-record read, or transaction action path", () => {
    const action = readFileSync(resolve(process.cwd(), "lib/finance-assistant-actions.ts"), "utf8");
    const component = readFileSync(resolve(process.cwd(), "components/FinanceAssistant.tsx"), "utf8");
    expect(action).not.toContain("openaiComplete");
    expect(action).not.toMatch(/\.from\(["'](?:invoices|payments|expenses|payables|estimates|ledger|reimbursements|subscriptions|passes|clients|staff|profiles|messages)["']\)/);
    expect(action).toContain('.rpc("create_finance_assistant_draft"');
    expect(action).not.toContain('formData.get("instruction")');
    expect(action).not.toMatch(/refundInvoice|markInvoicePaid|voidClientPackage|payReimbursement|addLedger/i);
    expect(component).toContain('name="workflow_key"');
    expect(component).not.toContain('name="instruction"');
    expect(component).toContain("readOnly");
  });
});
