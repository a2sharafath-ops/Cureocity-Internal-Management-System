import { NextResponse } from "next/server";
import { runTaskReminders } from "@/lib/cron/task-reminders";
import { bearerOk } from "@/lib/safe-equal";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayISO } from "@/lib/today";

export const dynamic = "force-dynamic";

/**
 * Controlled Production verification for task reminders.
 *
 * This intentionally refuses to run unless there is exactly one opted-in
 * WhatsApp contact. It exercises the real database scope, template sender and
 * automation-event duplicate gates for that one staff record, without running
 * the rest of the daily automation suite or notifying other staff.
 */
export async function POST(req: Request) {
  if (!bearerOk(req.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.from("staff")
    .select("id, task_reminder_phone")
    .eq("task_reminder_whatsapp_opt_in", true)
    .not("task_reminder_phone", "is", null);
  if (error) {
    return NextResponse.json({ ok: false, error: "Reminder contact lookup failed" }, { status: 500 });
  }

  const recipients = ((data ?? []) as { id: string; task_reminder_phone: string | null }[])
    .filter((row) => Boolean(row.task_reminder_phone?.trim()));
  if (recipients.length !== 1) {
    return NextResponse.json({
      ok: false,
      error: "Controlled run requires exactly one opted-in reminder contact",
      optedInContacts: recipients.length,
    }, { status: 409 });
  }

  try {
    const result = await runTaskReminders(supabase, todayISO(), {
      onlyStaffId: recipients[0].id,
      sendInApp: true,
      escalateManagement: false,
      includeOperationsDigest: true,
    });
    return NextResponse.json({ ok: true, controlled: true, ...result });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "Controlled task-reminder run failed",
    }, { status: 500 });
  }
}
