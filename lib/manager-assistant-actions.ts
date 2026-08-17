"use server";

import { revalidatePath } from "next/cache";
import { getProfile } from "@/lib/auth";
import {
  CUREOCITY_ASSISTANT_POLICY_VERSION,
  MANAGER_OPERATIONS_TASK_KEY,
  decideAssistantTask,
} from "@/lib/cureocity-assistant-policy";
import {
  buildManagerOperationsDraft,
  managerWorkflowProblem,
  type ManagerWorkflowKey,
} from "@/lib/manager-assistant";
import { logServerError } from "@/lib/runtime-errors";
import { createClient } from "@/lib/supabase/server";

export type ManagerAssistantState = {
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
  if (!profile || profile.role !== "Manager") {
    return { profile, error: "Only a signed-in Manager account can use this operations checklist pilot." };
  }
  const policy = decideAssistantTask({
    realRole: profile.role,
    taskKey: MANAGER_OPERATIONS_TASK_KEY,
    env: process.env,
  });
  return {
    profile,
    error: policy.allowed ? null : `Manager checklist assistance is off. ${policy.reasons.join(" ")}`,
  };
}

/** Builds a deterministic checklist from static Manager-visible route metadata. */
export async function generateManagerOperationsDraft(
  _previous: ManagerAssistantState,
  formData: FormData,
): Promise<ManagerAssistantState> {
  const readiness = await readinessProblem();
  if (readiness.error || !readiness.profile) return { error: readiness.error ?? "Manager checklist assistance is unavailable." };

  const workflowKey = String(formData.get("workflow_key") || "");
  const workflowProblem = managerWorkflowProblem(workflowKey);
  if (workflowProblem) return { error: workflowProblem };
  const draft = buildManagerOperationsDraft(workflowKey as ManagerWorkflowKey);

  const supabase = await createClient();
  const { data: draftId, error } = await supabase.rpc("create_manager_assistant_draft", {
    p_workflow_key: workflowKey,
    p_policy_version: CUREOCITY_ASSISTANT_POLICY_VERSION,
    p_task_version: draft.taskVersion,
  });
  if (error || !draftId) {
    logServerError(error ?? new Error("Manager Assistant draft RPC returned no id"), {
      source: "manager_assistant",
      operation: "create_draft",
    });
    return { error: "The checklist could not be saved. Nothing was applied; verify migrations 0186 and 0190 before enabling this pilot." };
  }

  revalidatePath("/copilot");
  return { draft: { id: String(draftId), title: draft.title, text: draft.draft, evidence: draft.evidence, caution: draft.caution } };
}

export async function acceptManagerOperationsDraft(draftId: string) {
  const readiness = await readinessProblem();
  if (readiness.error || !readiness.profile) return { error: readiness.error ?? "Manager checklist assistance is unavailable." };
  if (!draftId) return { error: "Choose a checklist to accept." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_manager_assistant_draft", { p_draft_id: draftId });
  if (error || data !== true) {
    logServerError(error ?? new Error("Manager Assistant acceptance RPC returned false"), { source: "manager_assistant", operation: "accept_draft" });
    return { error: "The checklist could not be marked accepted. No action was taken." };
  }
  revalidatePath("/copilot");
  return { ok: "Accepted as reviewed working text. Nothing was assigned, scheduled, changed, approved, completed, configured, published, sent or deleted." };
}

export async function discardManagerOperationsDraft(draftId: string) {
  const readiness = await readinessProblem();
  if (readiness.error || !readiness.profile) return { error: readiness.error ?? "Manager checklist assistance is unavailable." };
  if (!draftId) return { error: "Choose a checklist to discard." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("discard_manager_assistant_draft", { p_draft_id: draftId });
  if (error || data !== true) {
    logServerError(error ?? new Error("Manager Assistant discard RPC returned false"), { source: "manager_assistant", operation: "discard_draft" });
    return { error: "The checklist could not be discarded. No action was taken." };
  }
  revalidatePath("/copilot");
  return { ok: "Checklist discarded. No action was taken." };
}
