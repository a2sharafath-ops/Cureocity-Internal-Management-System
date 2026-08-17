"use server";

import { revalidatePath } from "next/cache";
import { getProfile } from "@/lib/auth";
import { CUREOCITY_ASSISTANT_POLICY_VERSION, DIETITIAN_REVIEW_TASK_KEY, decideAssistantTask } from "@/lib/cureocity-assistant-policy";
import { buildDietitianReviewDraft, dietitianWorkflowProblem, type DietitianWorkflowKey } from "@/lib/dietitian-assistant";
import { logServerError } from "@/lib/runtime-errors";
import { createClient } from "@/lib/supabase/server";

export type DietitianAssistantState = { error?: string; draft?: { id: string; title: string; text: string; evidence: string[]; caution: string } };

async function readinessProblem() {
  const profile = await getProfile();
  if (!profile || profile.role !== "Dietitian") return { profile, error: "Only a signed-in Dietitian account can use this review checklist pilot." };
  const policy = decideAssistantTask({ realRole: profile.role, taskKey: DIETITIAN_REVIEW_TASK_KEY, env: process.env });
  return { profile, error: policy.allowed ? null : `Dietitian checklist assistance is off. ${policy.reasons.join(" ")}` };
}

export async function generateDietitianReviewDraft(_previous: DietitianAssistantState, formData: FormData): Promise<DietitianAssistantState> {
  const readiness = await readinessProblem();
  if (readiness.error || !readiness.profile) return { error: readiness.error ?? "Dietitian checklist assistance is unavailable." };
  const workflowKey = String(formData.get("workflow_key") || "");
  const workflowProblem = dietitianWorkflowProblem(workflowKey);
  if (workflowProblem) return { error: workflowProblem };
  const draft = buildDietitianReviewDraft(workflowKey as DietitianWorkflowKey);
  const supabase = await createClient();
  const { data: draftId, error } = await supabase.rpc("create_dietitian_assistant_draft", {
    p_workflow_key: workflowKey, p_policy_version: CUREOCITY_ASSISTANT_POLICY_VERSION, p_task_version: draft.taskVersion,
  });
  if (error || !draftId) {
    logServerError(error ?? new Error("Dietitian Assistant draft RPC returned no id"), { source: "dietitian_assistant", operation: "create_draft" });
    return { error: "The checklist could not be saved. Nothing was applied; verify migrations 0186 and 0191 before enabling this pilot." };
  }
  revalidatePath("/copilot");
  return { draft: { id: String(draftId), title: draft.title, text: draft.draft, evidence: draft.evidence, caution: draft.caution } };
}

export async function acceptDietitianReviewDraft(draftId: string) {
  const readiness = await readinessProblem();
  if (readiness.error || !readiness.profile) return { error: readiness.error ?? "Dietitian checklist assistance is unavailable." };
  if (!draftId) return { error: "Choose a checklist to accept." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_dietitian_assistant_draft", { p_draft_id: draftId });
  if (error || data !== true) {
    logServerError(error ?? new Error("Dietitian Assistant acceptance RPC returned false"), { source: "dietitian_assistant", operation: "accept_draft" });
    return { error: "The checklist could not be marked accepted. No action was taken." };
  }
  revalidatePath("/copilot");
  return { ok: "Accepted as reviewed working text. Nothing was calculated, recommended, prescribed, changed, submitted, approved, published, delivered or sent." };
}

export async function discardDietitianReviewDraft(draftId: string) {
  const readiness = await readinessProblem();
  if (readiness.error || !readiness.profile) return { error: readiness.error ?? "Dietitian checklist assistance is unavailable." };
  if (!draftId) return { error: "Choose a checklist to discard." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("discard_dietitian_assistant_draft", { p_draft_id: draftId });
  if (error || data !== true) {
    logServerError(error ?? new Error("Dietitian Assistant discard RPC returned false"), { source: "dietitian_assistant", operation: "discard_draft" });
    return { error: "The checklist could not be discarded. No action was taken." };
  }
  revalidatePath("/copilot");
  return { ok: "Checklist discarded. No action was taken." };
}
