"use server";

import { revalidatePath } from "next/cache";
import { getProfile } from "@/lib/auth";
import { CUREOCITY_ASSISTANT_POLICY_VERSION, HR_PROCESS_TASK_KEY, decideAssistantTask } from "@/lib/cureocity-assistant-policy";
import { buildHrProcessDraft, hrWorkflowProblem, type HrWorkflowKey } from "@/lib/hr-assistant";
import { logServerError } from "@/lib/runtime-errors";
import { createClient } from "@/lib/supabase/server";

export type HrAssistantState = { error?: string; draft?: { id: string; title: string; text: string; evidence: string[]; caution: string } };

async function readinessProblem() {
  const profile = await getProfile();
  if (!profile || profile.role !== "HR") return { profile, error: "Only a signed-in HR account can use this checklist pilot." };
  const policy = decideAssistantTask({ realRole: profile.role, taskKey: HR_PROCESS_TASK_KEY, env: process.env });
  return { profile, error: policy.allowed ? null : `HR checklist assistance is off. ${policy.reasons.join(" ")}` };
}

export async function generateHrProcessDraft(_previous: HrAssistantState, formData: FormData): Promise<HrAssistantState> {
  const readiness = await readinessProblem();
  if (readiness.error || !readiness.profile) return { error: readiness.error ?? "HR checklist assistance is unavailable." };
  const workflowKey = String(formData.get("workflow_key") || "");
  const workflowProblem = hrWorkflowProblem(workflowKey);
  if (workflowProblem) return { error: workflowProblem };
  const draft = buildHrProcessDraft(workflowKey as HrWorkflowKey);
  const supabase = await createClient();
  const { data: draftId, error } = await supabase.rpc("create_hr_assistant_draft", {
    p_workflow_key: workflowKey, p_policy_version: CUREOCITY_ASSISTANT_POLICY_VERSION, p_task_version: draft.taskVersion,
  });
  if (error || !draftId) {
    logServerError(error ?? new Error("HR Assistant draft RPC returned no id"), { source: "hr_assistant", operation: "create_draft" });
    return { error: "The checklist could not be saved. Nothing was applied; verify migrations 0186 and 0196 before enabling this pilot." };
  }
  revalidatePath("/copilot");
  return { draft: { id: String(draftId), title: draft.title, text: draft.draft, evidence: draft.evidence, caution: draft.caution } };
}

export async function acceptHrProcessDraft(draftId: string) {
  const readiness = await readinessProblem();
  if (readiness.error || !readiness.profile) return { error: readiness.error ?? "HR checklist assistance is unavailable." };
  if (!draftId) return { error: "Choose a checklist to accept." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_hr_assistant_draft", { p_draft_id: draftId });
  if (error || data !== true) {
    logServerError(error ?? new Error("HR Assistant acceptance RPC returned false"), { source: "hr_assistant", operation: "accept_draft" });
    return { error: "The checklist could not be marked accepted. No HR or other action was taken." };
  }
  revalidatePath("/copilot");
  return { ok: "Accepted as reviewed working text. Nobody was scored, ranked, assessed, hired, terminated, disciplined, compensated, assigned, approved, rejected, changed, provisioned, removed or contacted." };
}

export async function discardHrProcessDraft(draftId: string) {
  const readiness = await readinessProblem();
  if (readiness.error || !readiness.profile) return { error: readiness.error ?? "HR checklist assistance is unavailable." };
  if (!draftId) return { error: "Choose a checklist to discard." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("discard_hr_assistant_draft", { p_draft_id: draftId });
  if (error || data !== true) {
    logServerError(error ?? new Error("HR Assistant discard RPC returned false"), { source: "hr_assistant", operation: "discard_draft" });
    return { error: "The checklist could not be discarded. No action was taken." };
  }
  revalidatePath("/copilot");
  return { ok: "Checklist discarded. No action was taken." };
}
