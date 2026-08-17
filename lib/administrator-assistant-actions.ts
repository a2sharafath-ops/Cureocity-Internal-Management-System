"use server";

import { revalidatePath } from "next/cache";
import { getProfile } from "@/lib/auth";
import {
  ADMINISTRATOR_GOVERNANCE_TASK_KEY,
  CUREOCITY_ASSISTANT_POLICY_VERSION,
  decideAssistantTask,
} from "@/lib/cureocity-assistant-policy";
import {
  administratorWorkflowProblem,
  buildAdministratorGovernanceDraft,
  type AdministratorWorkflowKey,
} from "@/lib/administrator-assistant";
import { logServerError } from "@/lib/runtime-errors";
import { createClient } from "@/lib/supabase/server";

export type AdministratorAssistantState = {
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
  if (!profile || profile.role !== "Administrator") {
    return { profile, error: "Only a signed-in Administrator account can use this governance checklist pilot." };
  }
  const policy = decideAssistantTask({
    realRole: profile.role,
    taskKey: ADMINISTRATOR_GOVERNANCE_TASK_KEY,
    env: process.env,
  });
  return {
    profile,
    error: policy.allowed
      ? null
      : `Administrator checklist assistance is off. ${policy.reasons.join(" ")}`,
  };
}

/**
 * Builds a deterministic checklist from static Administrator-visible route
 * metadata and persists it through migration 0189. It calls no AI provider and
 * reads no application record.
 */
export async function generateAdministratorGovernanceDraft(
  _previous: AdministratorAssistantState,
  formData: FormData,
): Promise<AdministratorAssistantState> {
  const readiness = await readinessProblem();
  if (readiness.error || !readiness.profile) return { error: readiness.error ?? "Administrator checklist assistance is unavailable." };

  const workflowKey = String(formData.get("workflow_key") || "");
  const workflowProblem = administratorWorkflowProblem(workflowKey);
  if (workflowProblem) return { error: workflowProblem };
  const draft = buildAdministratorGovernanceDraft(workflowKey as AdministratorWorkflowKey);

  const supabase = await createClient();
  const { data: draftId, error } = await supabase.rpc("create_administrator_assistant_draft", {
    p_workflow_key: workflowKey,
    p_policy_version: CUREOCITY_ASSISTANT_POLICY_VERSION,
    p_task_version: draft.taskVersion,
  });
  if (error || !draftId) {
    logServerError(error ?? new Error("Administrator Assistant draft RPC returned no id"), {
      source: "administrator_assistant",
      operation: "create_draft",
    });
    return { error: "The checklist could not be saved. Nothing was applied; verify migrations 0186 and 0189 before enabling this pilot." };
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

export async function acceptAdministratorGovernanceDraft(draftId: string) {
  const readiness = await readinessProblem();
  if (readiness.error || !readiness.profile) return { error: readiness.error ?? "Administrator checklist assistance is unavailable." };
  if (!draftId) return { error: "Choose a checklist to accept." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_administrator_assistant_draft", { p_draft_id: draftId });
  if (error || data !== true) {
    logServerError(error ?? new Error("Administrator Assistant acceptance RPC returned false"), {
      source: "administrator_assistant",
      operation: "accept_draft",
    });
    return { error: "The checklist could not be marked accepted. No action was taken." };
  }
  revalidatePath("/copilot");
  return { ok: "Accepted as reviewed working text. Nothing was opened, changed, resolved, approved, assigned, configured, published, sent or deleted." };
}

export async function discardAdministratorGovernanceDraft(draftId: string) {
  const readiness = await readinessProblem();
  if (readiness.error || !readiness.profile) return { error: readiness.error ?? "Administrator checklist assistance is unavailable." };
  if (!draftId) return { error: "Choose a checklist to discard." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("discard_administrator_assistant_draft", { p_draft_id: draftId });
  if (error || data !== true) {
    logServerError(error ?? new Error("Administrator Assistant discard RPC returned false"), {
      source: "administrator_assistant",
      operation: "discard_draft",
    });
    return { error: "The checklist could not be discarded. No action was taken." };
  }
  revalidatePath("/copilot");
  return { ok: "Checklist discarded. No action was taken." };
}
