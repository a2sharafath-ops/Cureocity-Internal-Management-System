"use server";

import { revalidatePath } from "next/cache";
import { getProfile } from "@/lib/auth";
import { CUREOCITY_ASSISTANT_POLICY_VERSION, PSYCHOLOGIST_REVIEW_TASK_KEY, decideAssistantTask } from "@/lib/cureocity-assistant-policy";
import { buildPsychologistReviewDraft, psychologistWorkflowProblem, type PsychologistWorkflowKey } from "@/lib/psychologist-assistant";
import { logServerError } from "@/lib/runtime-errors";
import { createClient } from "@/lib/supabase/server";

export type PsychologistAssistantState = { error?: string; draft?: { id: string; title: string; text: string; evidence: string[]; caution: string } };

async function readinessProblem() {
  const profile = await getProfile();
  if (!profile || profile.role !== "Psychologist") return { profile, error: "Only a signed-in Psychologist account can use this checklist pilot." };
  const policy = decideAssistantTask({ realRole: profile.role, taskKey: PSYCHOLOGIST_REVIEW_TASK_KEY, env: process.env });
  return { profile, error: policy.allowed ? null : `Psychologist checklist assistance is off. ${policy.reasons.join(" ")}` };
}

export async function generatePsychologistReviewDraft(_previous: PsychologistAssistantState, formData: FormData): Promise<PsychologistAssistantState> {
  const readiness = await readinessProblem();
  if (readiness.error || !readiness.profile) return { error: readiness.error ?? "Psychologist checklist assistance is unavailable." };
  const workflowKey = String(formData.get("workflow_key") || "");
  const workflowProblem = psychologistWorkflowProblem(workflowKey);
  if (workflowProblem) return { error: workflowProblem };
  const draft = buildPsychologistReviewDraft(workflowKey as PsychologistWorkflowKey);
  const supabase = await createClient();
  const { data: draftId, error } = await supabase.rpc("create_psychologist_assistant_draft", {
    p_workflow_key: workflowKey, p_policy_version: CUREOCITY_ASSISTANT_POLICY_VERSION, p_task_version: draft.taskVersion,
  });
  if (error || !draftId) {
    logServerError(error ?? new Error("Psychologist Assistant draft RPC returned no id"), { source: "psychologist_assistant", operation: "create_draft" });
    return { error: "The checklist could not be saved. Nothing was applied; verify migrations 0186 and 0192 before enabling this pilot." };
  }
  revalidatePath("/copilot");
  return { draft: { id: String(draftId), title: draft.title, text: draft.draft, evidence: draft.evidence, caution: draft.caution } };
}

export async function acceptPsychologistReviewDraft(draftId: string) {
  const readiness = await readinessProblem();
  if (readiness.error || !readiness.profile) return { error: readiness.error ?? "Psychologist checklist assistance is unavailable." };
  if (!draftId) return { error: "Choose a checklist to accept." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_psychologist_assistant_draft", { p_draft_id: draftId });
  if (error || data !== true) {
    logServerError(error ?? new Error("Psychologist Assistant acceptance RPC returned false"), { source: "psychologist_assistant", operation: "accept_draft" });
    return { error: "The checklist could not be marked accepted. No action was taken." };
  }
  revalidatePath("/copilot");
  return { ok: "Accepted as reviewed working text. Nothing was diagnosed, interpreted, recommended, changed, submitted, escalated, closed, assigned, disclosed or sent." };
}

export async function discardPsychologistReviewDraft(draftId: string) {
  const readiness = await readinessProblem();
  if (readiness.error || !readiness.profile) return { error: readiness.error ?? "Psychologist checklist assistance is unavailable." };
  if (!draftId) return { error: "Choose a checklist to discard." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("discard_psychologist_assistant_draft", { p_draft_id: draftId });
  if (error || data !== true) {
    logServerError(error ?? new Error("Psychologist Assistant discard RPC returned false"), { source: "psychologist_assistant", operation: "discard_draft" });
    return { error: "The checklist could not be discarded. No action was taken." };
  }
  revalidatePath("/copilot");
  return { ok: "Checklist discarded. No action was taken." };
}
