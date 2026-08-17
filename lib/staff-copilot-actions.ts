"use server";

import { revalidatePath } from "next/cache";
import { getProfile } from "@/lib/auth";
import { decideAssistantTask } from "@/lib/cureocity-assistant-policy";
import { openaiComplete } from "@/lib/ai";
import { logServerError } from "@/lib/runtime-errors";
import {
  SUPER_ADMIN_COPILOT_SYSTEM_PROMPT,
  acceptedSuperAdminCopilotText,
  buildSuperAdminCopilotContext,
  parseSuperAdminCopilotOutput,
  superAdminCopilotRequestProblem,
  superAdminCopilotSafetyProblem,
  superAdminCopilotUserPrompt,
  type SuperAdminCopilotSource,
  type SuperAdminCopilotTask,
} from "@/lib/super-admin-copilot";
import { createClient } from "@/lib/supabase/server";

export type SuperAdminCopilotState = {
  error?: string;
  draft?: {
    id: string;
    title: string;
    text: string;
    evidence: string[];
    caution: string | null;
  };
};

type Profile = NonNullable<Awaited<ReturnType<typeof getProfile>>>;

function pilotReady(profile: Profile | null, taskKey = "operational_summary") {
  if (!profile || profile.role !== "Super Admin") {
    return "Only a signed-in Super Admin can use this pilot.";
  }
  const policy = decideAssistantTask({ realRole: profile.role, taskKey, env: process.env });
  return policy.allowed ? null : `Super Admin Cureocity Assistant is off. ${policy.reasons.join(" ")}`;
}

async function audit(
  profile: Profile,
  action: string,
  taskType: string,
  detail: string | null = null,
) {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("audit_log").insert({
      actor_id: profile.id,
      actor_name: profile.name,
      actor_role: profile.role,
      action,
      target: `Super Admin Copilot · ${taskType}`,
      detail,
    });
    if (error) logServerError(error, { source: "super_admin_copilot", operation: "audit" });
  } catch (error) {
    logServerError(error, { source: "super_admin_copilot", operation: "audit" });
  }
}

/** Generates and stores reviewable text only. No operational mutation is available from this action. */
export async function generateSuperAdminCopilotDraft(
  _previous: SuperAdminCopilotState,
  formData: FormData,
): Promise<SuperAdminCopilotState> {
  const profile = await getProfile();
  const task = String(formData.get("task_type") || "");
  const readinessProblem = pilotReady(profile, task);
  if (readinessProblem || !profile) return { error: readinessProblem ?? "Super Admin Copilot is unavailable." };

  const instruction = String(formData.get("instruction") || "").trim();
  const requestProblem = superAdminCopilotRequestProblem(task, instruction);
  if (requestProblem) return { error: requestProblem };

  const supabase = await createClient();
  const results = await Promise.all([
    supabase.from("tasks").select("id, type, priority, status, due_date").order("due_date", { ascending: true }).limit(300),
    supabase.from("followups").select("id, kind, priority, status, stage, due_date").order("due_date", { ascending: true }).limit(300),
    supabase.from("profiles").select("id, role, branch, staff_id").limit(500),
    supabase.from("staff").select("id, role").limit(500),
    supabase.from("appointments").select("type, status, date").order("date", { ascending: false }).limit(500),
  ]);
  const operations = ["tasks", "followups", "profiles", "staff", "appointments"] as const;
  const failedIndex = results.findIndex((result) => Boolean(result.error));
  if (failedIndex >= 0) {
    logServerError(results[failedIndex].error, {
      source: "super_admin_copilot",
      operation: `read_${operations[failedIndex]}`,
    });
    return { error: "Required operational data could not be loaded. No draft was generated or saved; try again after the data connection is restored." };
  }

  const context = buildSuperAdminCopilotContext({
    tasks: (results[0].data ?? []) as SuperAdminCopilotSource["tasks"],
    followups: (results[1].data ?? []) as SuperAdminCopilotSource["followups"],
    profiles: (results[2].data ?? []) as SuperAdminCopilotSource["profiles"],
    staff: (results[3].data ?? []) as SuperAdminCopilotSource["staff"],
    appointments: (results[4].data ?? []) as SuperAdminCopilotSource["appointments"],
    limits: { tasks: 300, followups: 300, profiles: 500, staff: 500, appointments: 500 },
  });

  const modelName = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const result = await openaiComplete(
    SUPER_ADMIN_COPILOT_SYSTEM_PROMPT,
    superAdminCopilotUserPrompt(task as SuperAdminCopilotTask, context, instruction),
    { model: modelName, json: true, maxTokens: 1400, temperature: 0.1 },
  );
  if (result.error || !result.text) {
    await audit(profile, "Super Admin Copilot generation failed", task, "No draft was persisted");
    return { error: result.error ?? "The Copilot returned no draft." };
  }
  const parsed = parseSuperAdminCopilotOutput(result.text);
  if ("error" in parsed) {
    await audit(profile, "Super Admin Copilot generation blocked", task, "Invalid output format; no draft was persisted");
    return { error: parsed.error };
  }
  const safetyProblem = superAdminCopilotSafetyProblem(parsed);
  if (safetyProblem) {
    await audit(profile, "Super Admin Copilot generation blocked", task, "Safety boundary; no draft was persisted");
    return { error: safetyProblem };
  }

  const { data: saved, error } = await supabase.from("staff_copilot_drafts").insert({
    role_name: "Super Admin",
    task_type: task,
    staff_instruction: instruction || null,
    context_snapshot: context,
    model_name: modelName,
    title: parsed.title,
    draft_text: parsed.draft,
    evidence: parsed.evidence,
    caution: parsed.caution,
    created_by: profile.id,
    creator_name: profile.name,
  }).select("id").single();
  if (error || !saved?.id) {
    logServerError(error ?? new Error("Draft insert returned no id"), {
      source: "super_admin_copilot",
      operation: "save_draft",
    });
    return { error: "The review draft could not be saved. Nothing was applied; try again after checking migration 0183." };
  }

  await audit(profile, "Super Admin Copilot draft generated", task, "Reviewable draft only; no action executed");
  revalidatePath("/copilot");
  return {
    draft: {
      id: saved.id,
      title: parsed.title,
      text: parsed.draft,
      evidence: parsed.evidence,
      caution: parsed.caution,
    },
  };
}

/** Acceptance stores reviewed working text only; it deliberately has no execution path. */
export async function acceptSuperAdminCopilotDraft(draftId: string, editedText: string) {
  const profile = await getProfile();
  const readinessProblem = pilotReady(profile);
  if (readinessProblem || !profile) return { error: readinessProblem ?? "Super Admin Copilot is unavailable." };
  const accepted = acceptedSuperAdminCopilotText(editedText);
  if (!draftId || !accepted) return { error: "Review the draft and keep the working text you want to accept." };
  const safetyProblem = superAdminCopilotSafetyProblem({
    title: "Reviewed draft",
    draft: accepted,
    evidence: [],
    caution: null,
  });
  if (safetyProblem) return { error: safetyProblem };

  const supabase = await createClient();
  const { data: draft, error: readError } = await supabase.from("staff_copilot_drafts")
    .select("id, role_name, task_type, status, created_by")
    .eq("id", draftId)
    .maybeSingle();
  if (readError) {
    logServerError(readError, { source: "super_admin_copilot", operation: "read_for_acceptance" });
    return { error: "The draft could not be loaded. Nothing was accepted or applied." };
  }
  if (!draft || draft.role_name !== "Super Admin" || draft.status !== "Draft" || draft.created_by !== profile.id) {
    return { error: "This draft is no longer available for acceptance." };
  }
  const { error } = await supabase.from("staff_copilot_drafts").update({
    status: "Accepted",
    accepted_text: accepted,
    accepted_by: profile.id,
    accepted_by_name: profile.name,
    accepted_at: new Date().toISOString(),
  }).eq("id", draftId).eq("status", "Draft").eq("created_by", profile.id);
  if (error) {
    logServerError(error, { source: "super_admin_copilot", operation: "accept_draft" });
    return { error: "The draft could not be marked accepted. No operational action was taken." };
  }
  await audit(profile, "Super Admin accepted AI-assisted draft", draft.task_type, "Working text stored only; no action executed");
  revalidatePath("/copilot");
  return { ok: "Accepted as AI-assisted working text. Nothing was sent, changed, approved or applied." };
}

export async function discardSuperAdminCopilotDraft(draftId: string) {
  const profile = await getProfile();
  const readinessProblem = pilotReady(profile);
  if (readinessProblem || !profile) return { error: readinessProblem ?? "Super Admin Copilot is unavailable." };
  if (!draftId) return { error: "Choose a draft to discard." };

  const supabase = await createClient();
  const { data: draft, error: readError } = await supabase.from("staff_copilot_drafts")
    .select("id, role_name, task_type, status, created_by")
    .eq("id", draftId)
    .maybeSingle();
  if (readError) {
    logServerError(readError, { source: "super_admin_copilot", operation: "read_for_discard" });
    return { error: "The draft could not be loaded. Nothing was discarded or applied." };
  }
  if (!draft || draft.role_name !== "Super Admin" || draft.status !== "Draft" || draft.created_by !== profile.id) {
    return { error: "This draft is no longer available." };
  }
  const { error } = await supabase.from("staff_copilot_drafts")
    .update({ status: "Discarded" })
    .eq("id", draftId)
    .eq("status", "Draft")
    .eq("created_by", profile.id);
  if (error) {
    logServerError(error, { source: "super_admin_copilot", operation: "discard_draft" });
    return { error: "The draft could not be discarded. No operational action was taken." };
  }
  await audit(profile, "Super Admin discarded Copilot draft", draft.task_type, "No action executed");
  revalidatePath("/copilot");
  return { ok: "Draft discarded. No operational action was taken." };
}
