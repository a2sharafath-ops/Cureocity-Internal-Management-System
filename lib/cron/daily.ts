import { createAdminClient } from "@/lib/supabase/admin";
import { todayISO } from "@/lib/today";
import { sendEmail } from "@/lib/email/send";
import { tplAppointmentReminder } from "@/lib/email/templates";
import { buildFollowupRows } from "@/lib/followups";
import { notifyRoles } from "@/lib/notify";
import { runBlueprintSla } from "@/lib/cron/blueprint-sla";

type Admin = ReturnType<typeof createAdminClient>;

function addDays(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function fmtHour(h: number | null) {
  if (h == null) return "";
  const am = h < 12;
  const hr = h % 12 === 0 ? 12 : h % 12;
  return ` at ${hr}:00 ${am ? "AM" : "PM"}`;
}

async function nextInvoiceNum(supabase: Admin) {
  const { data } = await supabase.from("invoices").select("num").order("num", { ascending: false }).limit(1).maybeSingle();
  return ((data?.num as number | null) ?? 0) + 1;
}

// Renew every active, auto-renewing subscription that is due today or earlier.
async function processRenewals(supabase: Admin) {
  const today = todayISO();
  const { data: due } = await supabase
    .from("subscriptions")
    .select("id, client_id, package_id, amount, interval_days, renews_on")
    .eq("status", "active").eq("auto_renew", true).lte("renews_on", today);

  let renewed = 0;
  for (const sub of (due ?? []) as { id: string; client_id: string; package_id: string | null; amount: number; interval_days: number; renews_on: string | null }[]) {
    const num = await nextInvoiceNum(supabase);
    const { data: pkg } = await supabase.from("packages").select("name").eq("id", sub.package_id ?? "").maybeSingle();
    await supabase.from("invoices").insert({
      num, client_id: sub.client_id, description: `${pkg?.name ?? "Subscription"} — renewal`,
      amount: sub.amount, status: "Unpaid", issued_date: today, created_by: "auto-renewal",
    });
    const base = sub.renews_on && sub.renews_on > today ? sub.renews_on : today;
    await supabase.from("subscriptions").update({ renews_on: addDays(base, sub.interval_days) }).eq("id", sub.id);
    renewed++;
  }
  return renewed;
}

// Email a reminder for every session scheduled tomorrow (deduped per client/day).
async function sendReminders(supabase: Admin) {
  const tomorrow = addDays(todayISO(), 1);
  const { data: sessions } = await supabase
    .from("sessions")
    .select("id, hour, client_id, clients(name, email)")
    .eq("date", tomorrow).eq("status", "scheduled");

  // avoid re-sending: emails already logged today with template 'reminder'
  const { data: sentToday } = await supabase
    .from("email_log").select("to_email").eq("template", "reminder").gte("created_at", todayISO());
  const already = new Set(((sentToday ?? []) as { to_email: string }[]).map((r) => r.to_email));

  let reminders = 0;
  for (const s of (sessions ?? []) as unknown as { id: string; hour: number | null; client_id: string; clients: { name: string | null; email: string | null } | null }[]) {
    const email = s.clients?.email;
    if (!email || already.has(email)) continue;
    const tpl = tplAppointmentReminder(s.clients?.name ?? "there", `tomorrow${fmtHour(s.hour)}`);
    let result;
    try { result = await sendEmail(email, tpl.subject, tpl.html); }
    catch { result = { status: "failed" as const, error: "Unexpected" }; }
    await supabase.from("email_log").insert({
      to_email: email, client_id: s.client_id, template: "reminder", subject: tpl.subject,
      status: result.status, provider: "resend",
      provider_id: "providerId" in result ? result.providerId ?? null : null,
      error: "error" in result ? result.error ?? null : null,
      created_by: "cron",
    });
    already.add(email);
    reminders++;
  }

  // also remind tomorrow's calendar appointments
  const { data: appts } = await supabase
    .from("appointments")
    .select("id, hour, client_id, title, clients(name, email)")
    .eq("date", tomorrow).eq("status", "scheduled");
  for (const a of (appts ?? []) as unknown as { id: string; hour: number | null; client_id: string; title: string | null; clients: { name: string | null; email: string | null } | null }[]) {
    const email = a.clients?.email;
    if (!email || already.has(email)) continue;
    const tpl = tplAppointmentReminder(a.clients?.name ?? "there", `tomorrow${fmtHour(a.hour)}${a.title ? ` — ${a.title}` : ""}`);
    let result;
    try { result = await sendEmail(email, tpl.subject, tpl.html); }
    catch { result = { status: "failed" as const, error: "Unexpected" }; }
    await supabase.from("email_log").insert({
      to_email: email, client_id: a.client_id, template: "reminder", subject: tpl.subject,
      status: result.status, provider: "resend",
      provider_id: "providerId" in result ? result.providerId ?? null : null,
      error: "error" in result ? result.error ?? null : null,
      created_by: "cron",
    });
    already.add(email);
    reminders++;
  }
  return reminders;
}

async function generateFollowups(supabase: Admin) {
  // The onboarding protocol is the Comprehensive care plan, so the client's
  // package category has to come along — without it every client, including
  // BluePrint and facility-only members, was queued for diet follow-ups they
  // never bought.
  const [{ data: clients }, { data: subs }, { data: cps }] = await Promise.all([
    supabase.from("clients").select("id, joined"),
    supabase.from("subscriptions").select("client_id, renews_on").eq("status", "active"),
    supabase.from("client_packages").select("client_id, category").eq("status", "active"),
  ]);
  const catOf = new Map(
    ((cps ?? []) as { client_id: string; category: string | null }[]).map((r) => [r.client_id, r.category]),
  );
  const rows = buildFollowupRows(
    ((clients ?? []) as { id: string; joined: string | null }[])
      .map((c) => ({ ...c, category: catOf.get(c.id) ?? null })),
    (subs ?? []) as { client_id: string; renews_on: string | null }[],
    "auto",
  );
  if (rows.length) await supabase.from("followups").upsert(rows, { onConflict: "client_id,label", ignoreDuplicates: true });
  return rows.length;
}

export async function runDaily() {
  const supabase = createAdminClient();
  const renewed = await processRenewals(supabase);
  const reminders = await sendReminders(supabase);
  const followups = await generateFollowups(supabase);
  // BluePrint turnaround: warn before the 24h/48h deadlines, escalate after.
  const sla = await runBlueprintSla(supabase);
  await supabase.from("audit_log").insert({
    actor_name: "System (cron)", actor_role: "System", action: "Daily automation run",
    target: null,
    detail: `renewed ${renewed} · reminders ${reminders} · follow-ups ${followups}`
      + ` · blueprint SLA ${sla.scanned} scanned, ${sla.warnings} warned, ${sla.breaches} breached`,
  });
  await notifyRoles(supabase, ["Administrator", "Manager"], {
    title: "Daily automation ran",
    body: `${renewed} renewals · ${reminders} reminders · ${followups} follow-ups queued`
      + (sla.breaches ? ` · ${sla.breaches} BluePrint SLA breach${sla.breaches === 1 ? "" : "es"}` : ""),
    href: "/followups", icon: "⚙️",
  });
  return { renewed, reminders, followups, sla, ranAt: new Date().toISOString() };
}
