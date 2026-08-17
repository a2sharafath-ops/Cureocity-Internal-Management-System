"use server";

import { revalidatePath } from "next/cache";
import { getProfile } from "@/lib/auth";
import {
  CUREOCITY_ASSISTANT_POLICY_VERSION,
  FRONT_DESK_OPERATIONAL_TASK_KEY,
  decideAssistantTask,
} from "@/lib/cureocity-assistant-policy";
import {
  buildFrontDeskOperationalDraft,
  frontDeskWorkflowProblem,
  type FrontDeskWorkflowKey,
} from "@/lib/front-desk-assistant";
import { logServerError } from "@/lib/runtime-errors";
import { createClient } from "@/lib/supabase/server";

export type FrontDeskAssistantState = {
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
  if (!profile || profile.role !== "Front Desk") {
    return { profile, error: "Only a signed-in Front Desk account can use this operational checklist pilot." };
  }
  const policy = decideAssistantTask({
    realRole: profile.role,
    taskKey: FRONT_DESK_OPERATIONAL_TASK_KEY,
    env: process.env,
  });
  return {
    profile,
    error: policy.allowed
      ? null
      : `Front Desk checklist assistance is off. ${policy.reasons.join(" ")}`,
  };
}

/**
 * Builds a deterministic checklist from static Front Desk route metadata and
 * persists it through migration 0187. It calls no AI provider and reads no
 * application record.
 */
export async function generateFrontDeskOperationalDraft(
  _previous: FrontDeskAssistantState,
  formData: FormData,
): Promise<FrontDeskAssistantState> {
  const readiness = await readinessProblem();
  if (readiness.error || !readiness.profile) return { error: readiness.error ?? "Front Desk checklist assistance is unavailable." };

  const workflowKey = String(formData.get("workflow_key") || "");
  const workflowProblem = frontDeskWorkflowProblem(workflowKey);
  if (workflowProblem) return { error: workflowProblem };
  const draft = buildFrontDeskOperationalDraft(workflowKey as FrontDeskWorkflowKey);
  const supabase = await createClient();
  const { data: draftId, error } = await supabase.rpc("create_front_desk_assistant_draft", {
    p_workflow_key: workflowKey,
    p_policy_version: CUREOCITY_ASSISTANT_POLICY_VERSION,
    p_task_version: draft.taskVersion,
  });
  if (error || !draftId) {
    logServerError(error ?? new Error("Front Desk Assistant draft RPC returned no id"), {
      source: "front_desk_assistant",
      operation: "create_draft",
    });
    return { error: "The checklist could not be saved. Nothing was applied; verify migrations 0186 and 0187 before enabling this pilot." };
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

export async function acceptFrontDeskOperationalDraft(draftId: string) {
  const readiness = await readinessProblem();
  if (readiness.error || !readiness.profile) return { error: readiness.error ?? "Front Desk checklist assistance is unavailable." };
  if (!draftId) return { error: "Choose a checklist to accept." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_front_desk_assistant_draft", {
    p_draft_id: draftId,
  });
  if (error || data !== true) {
    logServerError(error ?? new Error("Front Desk Assistant acceptance RPC returned false"), {
      source: "front_desk_assistant",
      operation: "accept_draft",
    });
    return { error: "The checklist could not be marked accepted. No action was taken." };
  }
  revalidatePath("/copilot");
  return { ok: "Accepted as reviewed working text. Nothing was opened, contacted, scheduled, changed, submitted or completed." };
}

export async function discardFrontDeskOperationalDraft(draftId: string) {
  const readiness = await readinessProblem();
  if (readiness.error || !readiness.profile) return { error: readiness.error ?? "Front Desk checklist assistance is unavailable." };
  if (!draftId) return { error: "Choose a checklist to discard." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("discard_front_desk_assistant_draft", { p_draft_id: draftId });
  if (error || data !== true) {
    logServerError(error ?? new Error("Front Desk Assistant discard RPC returned false"), {
      source: "front_desk_assistant",
      operation: "discard_draft",
    });
    return { error: "The checklist could not be discarded. No action was taken." };
  }
  revalidatePath("/copilot");
  return { ok: "Checklist discarded. No action was taken." };
}
