"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  canReportIssue,
  canTriageIssues,
  validateIssueSubmission,
  validateIssueTriage,
} from "@/lib/issue-reports";
import { logServerError } from "@/lib/runtime-errors";

export type IssueActionState = {
  ok?: string;
  warning?: string;
  error?: string;
};

const SCREENSHOT_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const SCREENSHOT_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export async function submitIssueReport(
  _previous: IssueActionState,
  formData: FormData,
): Promise<IssueActionState> {
  const me = await getProfile();
  if (!me || !canReportIssue(me.role)) return { error: "You must be signed in as a staff member." };

  const validated = validateIssueSubmission(formData);
  if (!validated.ok) return { error: validated.error };

  const attachment = formData.get("attachment");
  const hasAttachment = attachment instanceof File && attachment.size > 0;
  if (hasAttachment && attachment.size > 5 * 1024 * 1024) return { error: "Screenshot is too large (maximum 5 MB)." };
  if (hasAttachment && !SCREENSHOT_TYPES.has(attachment.type)) return { error: "Screenshot must be a PNG, JPEG, or WebP image." };

  const supabase = await createClient();
  const input = validated.value;
  const { data: created, error: insertError } = await supabase
    .from("issue_reports")
    .insert({
      report_type: input.type,
      severity: input.severity,
      description: input.description,
      route: input.route,
      client_ref: input.clientRef,
      browser_context: input.browserContext,
      reporter_id: me.id,
      reporter_name: me.name,
      reporter_role: me.role,
      submission_key: input.submissionKey,
    })
    .select("id")
    .single();

  if (insertError?.code === "23505") {
    return { ok: "This report was already submitted." };
  }
  if (insertError || !created?.id) {
    logServerError(insertError ?? new Error("Issue insert returned no id"), {
      source: "issue_report",
      operation: "insert",
    });
    return { error: "The report could not be saved. Please try again." };
  }

  if (hasAttachment) {
    const path = `${me.id}/${created.id}/${crypto.randomUUID()}.${SCREENSHOT_EXT[attachment.type]}`;
    const { error: uploadError } = await supabase.storage
      .from("issue-attachments")
      .upload(path, attachment, { contentType: attachment.type, upsert: false });

    if (uploadError) {
      logServerError(uploadError, { source: "issue_report", operation: "attachment_upload" });
      revalidatePath("/issues");
      return { ok: "Report submitted.", warning: "The optional screenshot could not be attached." };
    }

    const safeName = attachment.name.replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 200) || `screenshot.${SCREENSHOT_EXT[attachment.type]}`;
    const { error: updateError } = await supabase.rpc("attach_issue_screenshot", {
      target_report_id: created.id,
      target_path: path,
      target_name: safeName,
      target_type: attachment.type,
      target_size: attachment.size,
    });
    if (updateError) {
      logServerError(updateError, { source: "issue_report", operation: "attachment_link" });
      const { error: cleanupError } = await supabase.storage.from("issue-attachments").remove([path]);
      if (cleanupError) logServerError(cleanupError, { source: "issue_report", operation: "attachment_cleanup" });
      revalidatePath("/issues");
      return { ok: "Report submitted.", warning: "The optional screenshot could not be attached." };
    }
  }

  revalidatePath("/issues");
  return { ok: "Report submitted. Thank you for including the details." };
}

export async function triageIssueReport(
  _previous: IssueActionState,
  formData: FormData,
): Promise<IssueActionState> {
  const me = await getProfile();
  if (!me || !canTriageIssues(me.role)) return { error: "Administrator access is required." };
  const validated = validateIssueTriage(formData);
  if (!validated.ok) return { error: validated.error };

  const supabase = await createClient();
  const { data, error } = await supabase.from("issue_reports").update({
    status: validated.status,
    admin_note: validated.note,
    triaged_by: me.id,
    triaged_by_name: me.name,
    updated_at: new Date().toISOString(),
    resolved_at: validated.status === "Resolved" ? new Date().toISOString() : null,
  }).eq("id", validated.id).select("id").maybeSingle();

  if (error) {
    logServerError(error, { source: "issue_report", operation: "triage" });
    return { error: "The triage update could not be saved. Please try again." };
  }
  if (!data) return { error: "Issue report not found." };

  revalidatePath("/issues");
  revalidatePath(`/issues/${validated.id}`);
  return { ok: "Triage updated." };
}
