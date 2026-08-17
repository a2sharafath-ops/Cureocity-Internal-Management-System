"use server";

import { revalidatePath } from "next/cache";
import { getProfile } from "@/lib/auth";
import {
  CUREOCITY_ASSISTANT_POLICY_VERSION,
  STAFF_NAVIGATION_TASK_KEY,
  decideAssistantTask,
} from "@/lib/cureocity-assistant-policy";
import { logServerError } from "@/lib/runtime-errors";
import {
  buildStaffNavigationDraft,
  staffNavigationDraftSafetyProblem,
  staffNavigationRequestProblem,
} from "@/lib/staff-navigation-assistant";
import { createClient } from "@/lib/supabase/server";

export type StaffNavigationAssistantState = {
  error?: string;
  draft?: {
    id: string;
    title: string;
    text: string;
    evidence: string[];
    caution: string;
  };
};

async function readinessProblem() {
  const profile = await getProfile();
  if (!profile || profile.role !== "Staff") {
    return { profile, error: "Only a signed-in Staff account can use this navigation pilot." };
  }
  const policy = decideAssistantTask({
    realRole: profile.role,
    taskKey: STAFF_NAVIGATION_TASK_KEY,
    env: process.env,
  });
  return {
    profile,
    error: policy.allowed
      ? null
      : `Staff navigation assistance is off. ${policy.reasons.join(" ")}`,
  };
}

/**
 * Builds a deterministic checklist from public route metadata and persists it
 * through the transaction/audit RPC introduced by migration 0186. It performs
 * no external AI call and reads no application record.
 */
export async function generateStaffNavigationDraft(
  _previous: StaffNavigationAssistantState,
  formData: FormData,
): Promise<StaffNavigationAssistantState> {
  const readiness = await readinessProblem();
  if (readiness.error || !readiness.profile) return { error: readiness.error ?? "Staff navigation assistance is unavailable." };

  const request = String(formData.get("instruction") || "").trim();
  const requestProblem = staffNavigationRequestProblem(request);
  if (requestProblem) return { error: requestProblem };
  const draft = buildStaffNavigationDraft(request);
  const safetyProblem = staffNavigationDraftSafetyProblem(draft.draft);
  if (safetyProblem) return { error: safetyProblem };

  const supabase = await createClient();
  const { data: draftId, error } = await supabase.rpc("create_staff_assistant_draft", {
    p_task_key: STAFF_NAVIGATION_TASK_KEY,
    p_policy_version: CUREOCITY_ASSISTANT_POLICY_VERSION,
    p_task_version: draft.taskVersion,
    p_staff_instruction: request,
    p_context_snapshot: draft.context,
    p_title: draft.title,
    p_draft_text: draft.draft,
    p_evidence: draft.evidence,
    p_caution: draft.caution,
  });
  if (error || !draftId) {
    logServerError(error ?? new Error("Staff Assistant draft RPC returned no id"), {
      source: "staff_navigation_assistant",
      operation: "create_draft",
    });
    return { error: "The navigation checklist could not be saved. Nothing was applied; verify migration 0186 before enabling this pilot." };
  }

  revalidatePath("/copilot");
  return {
    draft: {
      id: String(draftId),
      title: draft.title,
      text: draft.draft,
      evidence: draft.evidence,
      caution: draft.caution,
    },
  };
}

export async function acceptStaffNavigationDraft(draftId: string, editedText: string) {
  const readiness = await readinessProblem();
  if (readiness.error || !readiness.profile) return { error: readiness.error ?? "Staff navigation assistance is unavailable." };
  const safetyProblem = staffNavigationDraftSafetyProblem(editedText);
  if (!draftId || safetyProblem) return { error: safetyProblem ?? "Choose a navigation checklist to accept." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_staff_assistant_draft", {
    p_draft_id: draftId,
    p_accepted_text: editedText.trim(),
  });
  if (error || data !== true) {
    logServerError(error ?? new Error("Staff Assistant acceptance RPC returned false"), {
      source: "staff_navigation_assistant",
      operation: "accept_draft",
    });
    return { error: "The checklist could not be marked accepted. No action was taken." };
  }
  revalidatePath("/copilot");
  return { ok: "Accepted as reviewed navigation text. Nothing was opened, sent, changed, approved, or applied." };
}

export async function discardStaffNavigationDraft(draftId: string) {
  const readiness = await readinessProblem();
  if (readiness.error || !readiness.profile) return { error: readiness.error ?? "Staff navigation assistance is unavailable." };
  if (!draftId) return { error: "Choose a navigation checklist to discard." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("discard_staff_assistant_draft", { p_draft_id: draftId });
  if (error || data !== true) {
    logServerError(error ?? new Error("Staff Assistant discard RPC returned false"), {
      source: "staff_navigation_assistant",
      operation: "discard_draft",
    });
    return { error: "The checklist could not be discarded. No action was taken." };
  }
  revalidatePath("/copilot");
  return { ok: "Checklist discarded. No action was taken." };
}
