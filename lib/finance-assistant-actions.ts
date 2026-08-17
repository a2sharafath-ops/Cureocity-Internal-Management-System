"use server";

import { revalidatePath } from "next/cache";
import { getProfile } from "@/lib/auth";
import { CUREOCITY_ASSISTANT_POLICY_VERSION, FINANCE_REVIEW_TASK_KEY, decideAssistantTask } from "@/lib/cureocity-assistant-policy";
import { buildFinanceReviewDraft, financeWorkflowProblem, type FinanceWorkflowKey } from "@/lib/finance-assistant";
import { logServerError } from "@/lib/runtime-errors";
import { createClient } from "@/lib/supabase/server";

export type FinanceAssistantState = { error?: string; draft?: { id: string; title: string; text: string; evidence: string[]; caution: string } };

async function readinessProblem() {
  const profile = await getProfile();
  if (!profile || profile.role !== "Finance") return { profile, error: "Only a signed-in Finance account can use this checklist pilot." };
  const policy = decideAssistantTask({ realRole: profile.role, taskKey: FINANCE_REVIEW_TASK_KEY, env: process.env });
  return { profile, error: policy.allowed ? null : `Finance checklist assistance is off. ${policy.reasons.join(" ")}` };
}

export async function generateFinanceReviewDraft(_previous: FinanceAssistantState, formData: FormData): Promise<FinanceAssistantState> {
  const readiness = await readinessProblem();
  if (readiness.error || !readiness.profile) return { error: readiness.error ?? "Finance checklist assistance is unavailable." };
  const workflowKey = String(formData.get("workflow_key") || "");
  const workflowProblem = financeWorkflowProblem(workflowKey);
  if (workflowProblem) return { error: workflowProblem };
  const draft = buildFinanceReviewDraft(workflowKey as FinanceWorkflowKey);
  const supabase = await createClient();
  const { data: draftId, error } = await supabase.rpc("create_finance_assistant_draft", {
    p_workflow_key: workflowKey, p_policy_version: CUREOCITY_ASSISTANT_POLICY_VERSION, p_task_version: draft.taskVersion,
  });
  if (error || !draftId) {
    logServerError(error ?? new Error("Finance Assistant draft RPC returned no id"), { source: "finance_assistant", operation: "create_draft" });
    return { error: "The checklist could not be saved. Nothing was applied; verify migrations 0186 and 0195 before enabling this pilot." };
  }
  revalidatePath("/copilot");
  return { draft: { id: String(draftId), title: draft.title, text: draft.draft, evidence: draft.evidence, caution: draft.caution } };
}

export async function acceptFinanceReviewDraft(draftId: string) {
  const readiness = await readinessProblem();
  if (readiness.error || !readiness.profile) return { error: readiness.error ?? "Finance checklist assistance is unavailable." };
  if (!draftId) return { error: "Choose a checklist to accept." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_finance_assistant_draft", { p_draft_id: draftId });
  if (error || data !== true) {
    logServerError(error ?? new Error("Finance Assistant acceptance RPC returned false"), { source: "finance_assistant", operation: "accept_draft" });
    return { error: "The checklist could not be marked accepted. No financial or other action was taken." };
  }
  revalidatePath("/copilot");
  return { ok: "Accepted as reviewed working text. Nothing was calculated, matched, categorized, raised, recorded, captured, changed, refunded, voided, credited, reversed, reimbursed, approved, paid, posted, reconciled or sent." };
}

export async function discardFinanceReviewDraft(draftId: string) {
  const readiness = await readinessProblem();
  if (readiness.error || !readiness.profile) return { error: readiness.error ?? "Finance checklist assistance is unavailable." };
  if (!draftId) return { error: "Choose a checklist to discard." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("discard_finance_assistant_draft", { p_draft_id: draftId });
  if (error || data !== true) {
    logServerError(error ?? new Error("Finance Assistant discard RPC returned false"), { source: "finance_assistant", operation: "discard_draft" });
    return { error: "The checklist could not be discarded. No action was taken." };
  }
  revalidatePath("/copilot");
  return { ok: "Checklist discarded. No action was taken." };
}
