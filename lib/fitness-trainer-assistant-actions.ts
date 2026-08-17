"use server";

import { revalidatePath } from "next/cache";
import { getProfile } from "@/lib/auth";
import {
  CUREOCITY_ASSISTANT_POLICY_VERSION,
  FITNESS_TRAINER_OPERATIONAL_TASK_KEY,
  decideAssistantTask,
} from "@/lib/cureocity-assistant-policy";
import {
  buildFitnessTrainerOperationalDraft,
  fitnessTrainerWorkflowProblem,
  type FitnessTrainerWorkflowKey,
} from "@/lib/fitness-trainer-assistant";
import { logServerError } from "@/lib/runtime-errors";
import { createClient } from "@/lib/supabase/server";

export type FitnessTrainerAssistantState = {
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
  if (!profile || profile.role !== "Fitness Trainer") {
    return { profile, error: "Only a signed-in Fitness Trainer account can use this workspace checklist pilot." };
  }
  const policy = decideAssistantTask({
    realRole: profile.role,
    taskKey: FITNESS_TRAINER_OPERATIONAL_TASK_KEY,
    env: process.env,
  });
  return {
    profile,
    error: policy.allowed
      ? null
      : `Fitness Trainer checklist assistance is off. ${policy.reasons.join(" ")}`,
  };
}

/**
 * Builds a deterministic checklist from static Fitness Trainer workspace
 * metadata and persists it through migration 0188. It calls no AI provider and
 * reads no application record.
 */
export async function generateFitnessTrainerOperationalDraft(
  _previous: FitnessTrainerAssistantState,
  formData: FormData,
): Promise<FitnessTrainerAssistantState> {
  const readiness = await readinessProblem();
  if (readiness.error || !readiness.profile) return { error: readiness.error ?? "Fitness Trainer checklist assistance is unavailable." };

  const workflowKey = String(formData.get("workflow_key") || "");
  const workflowProblem = fitnessTrainerWorkflowProblem(workflowKey);
  if (workflowProblem) return { error: workflowProblem };
  const draft = buildFitnessTrainerOperationalDraft(workflowKey as FitnessTrainerWorkflowKey);

  const supabase = await createClient();
  const { data: draftId, error } = await supabase.rpc("create_fitness_trainer_assistant_draft", {
    p_workflow_key: workflowKey,
    p_policy_version: CUREOCITY_ASSISTANT_POLICY_VERSION,
    p_task_version: draft.taskVersion,
  });
  if (error || !draftId) {
    logServerError(error ?? new Error("Fitness Trainer Assistant draft RPC returned no id"), {
      source: "fitness_trainer_assistant",
      operation: "create_draft",
    });
    return { error: "The checklist could not be saved. Nothing was applied; verify migrations 0186 and 0188 before enabling this pilot." };
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

export async function acceptFitnessTrainerOperationalDraft(draftId: string) {
  const readiness = await readinessProblem();
  if (readiness.error || !readiness.profile) return { error: readiness.error ?? "Fitness Trainer checklist assistance is unavailable." };
  if (!draftId) return { error: "Choose a checklist to accept." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_fitness_trainer_assistant_draft", { p_draft_id: draftId });
  if (error || data !== true) {
    logServerError(error ?? new Error("Fitness Trainer Assistant acceptance RPC returned false"), {
      source: "fitness_trainer_assistant",
      operation: "accept_draft",
    });
    return { error: "The checklist could not be marked accepted. No action was taken." };
  }
  revalidatePath("/copilot");
  return { ok: "Accepted as reviewed working text. Nothing was opened, prescribed, scheduled, completed, changed, submitted, published or sent." };
}

export async function discardFitnessTrainerOperationalDraft(draftId: string) {
  const readiness = await readinessProblem();
  if (readiness.error || !readiness.profile) return { error: readiness.error ?? "Fitness Trainer checklist assistance is unavailable." };
  if (!draftId) return { error: "Choose a checklist to discard." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("discard_fitness_trainer_assistant_draft", { p_draft_id: draftId });
  if (error || data !== true) {
    logServerError(error ?? new Error("Fitness Trainer Assistant discard RPC returned false"), {
      source: "fitness_trainer_assistant",
      operation: "discard_draft",
    });
    return { error: "The checklist could not be discarded. No action was taken." };
  }
  revalidatePath("/copilot");
  return { ok: "Checklist discarded. No action was taken." };
}
