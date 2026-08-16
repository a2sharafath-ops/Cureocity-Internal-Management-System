"use server";

import { revalidatePath } from "next/cache";
import { getProfile } from "@/lib/auth";
import { logServerError } from "@/lib/runtime-errors";
import { createClient } from "@/lib/supabase/server";
import { canManageWorkboard, validateWorkboardStatusUpdate } from "@/lib/workboard";

export type WorkboardActionState = { ok?: string; error?: string };

export async function updateWorkboardStatus(
  _previous: WorkboardActionState,
  formData: FormData,
): Promise<WorkboardActionState> {
  const me = await getProfile();
  if (!me || !canManageWorkboard(me.role)) return { error: "Super Admin access is required." };

  const validated = validateWorkboardStatusUpdate(formData);
  if (!validated.ok) return { error: validated.error };

  const supabase = await createClient();
  // Actor attribution, immutable-field protection, item history and the global
  // audit entry are all enforced atomically by migration 0184's DB trigger.
  const { data, error } = await supabase
    .from("workboard_items")
    .update({ status: validated.status })
    .eq("id", validated.id)
    .select("id, status")
    .maybeSingle();

  if (error) {
    logServerError(error, { source: "workboard", operation: "status_update" });
    return { error: "The work item could not be updated. Please try again." };
  }
  if (!data) return { error: "Work item not found." };

  revalidatePath("/workboard");
  revalidatePath("/audit");
  return { ok: `Status updated to ${validated.status}.` };
}
