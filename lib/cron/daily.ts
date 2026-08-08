import { createAdminClient } from "@/lib/supabase/admin";
import { todayISO } from "@/lib/today";
import { sendEmail } from "@/lib/email/send";
import { tplAppointmentReminder } from "@/lib/email/templates";
import { buildFollowupRows, governingPackage } from "@/lib/followups";
import { notifyRoles } from "@/lib/notify";
import { runBlueprintSla } from "@/lib/cron/blueprint-sla";
import { runComprehensiveSla } from "@/lib/cron/comprehensive-sla";
import { runPtSla } from "@/lib/cron/pt-sla";
import { runLeadFollowups } from "@/lib/cron/lead-followups";
import { runLeadCoverage } from "@/lib/cron/lead-coverage";
import { runLeadIdle } from "@/lib/cron/lead-idle";
import { runConcernEscalation } from "@/lib/cron/concern-escalation";
import { runLeadStagnation } from "@/lib/cron/lead-stagnation";

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
  // The milestone anchor is the package start, not the join date — see
  // lib/followups.ts. Length comes along so a multi-cycle plan repeats.
  const [{ data: clients }, { data: subs }, { data: cps }, { data: protos }] = await Promise.all([
    supabase.from("clients").select("id, joined"),
    supabase.from("subscriptions").select("client_id, renews_on").eq("status", "active"),
    supabase.from("client_packages").select("client_id, category, start_date, end_date").eq("status", "active"),
    // The protocol date is authoritative where one exists — protocolStartFor.
    supabase.from("care_protocols").select("client_id, start_date").eq("status", "active"),
  ]);
  const protoOf = new Map(((protos ?? []) as { client_id: string; start_date: string | null }[]).map((r) => [r.client_id, r.start_date]));
  // A client may hold several active packages; the care package governs, not
  // whichever row came back last. See governingPackage().
  const cpsByClient = new Map<string, { client_id: string; category: string | null; start_date: string | null; end_date: string | null }[]>();
  for (const r of (cps ?? []) as { client_id: string; category: string | null; start_date: string | null; end_date: string | null }[]) {
    (cpsByClient.get(r.client_id) ?? cpsByClient.set(r.client_id, []).get(r.client_id)!).push(r);
  }
  const packOf = new Map(Array.from(cpsByClient, ([id, rows]) => [id, governingPackage(rows)!]));
  const dayspan = (a: string | null, b: string | null) =>
    a && b ? Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000) : null;
  const rows = buildFollowupRows(
    ((clients ?? []) as { id: string; joined: string | null }[]).map((c) => {
      const pk = packOf.get(c.id);
      return {
        ...c,
        category: pk?.category ?? null,
        start: pk?.start_date ?? null,
        protocolStart: protoOf.get(c.id) ?? null,
        days: dayspan(pk?.start_date ?? null, pk?.end_date ?? null),
      };
    }),
    (subs ?? []) as { client_id: string; renews_on: string | null }[],
    "auto",
  );
  // ---- writing the rows ----------------------------------------------------
  //
  // Two different keys, needing two different behaviours, and treating them the
  // same is what broke renewals.
  //
  // A MILESTONE key is unique per cycle ("diet_10#2"), so `ignoreDuplicates`
  // is right: once the row exists, leave it alone — re-creating it would undo
  // whoever worked it.
  //
  // The RENEWAL key is the constant string "renewal", one row per client for
  // ever. With `ignoreDuplicates` that row was written once and then frozen:
  // its due date and label stayed on the first cycle, so it sat permanently
  // overdue and inflated the front desk's counter — and once somebody closed
  // it, no renewal was ever chased again. Migration 0122 says the row should
  // "update as the cycle advances"; this is the code finally doing that.
  const renewals = rows.filter((r) => r.milestone_key === "renewal");
  const milestones = rows.filter((r) => r.milestone_key !== "renewal");

  if (milestones.length) {
    await supabase.from("followups").upsert(milestones, { onConflict: "client_id,milestone_key", ignoreDuplicates: true });
  }

  if (renewals.length) {
    const { data: existing } = await supabase
      .from("followups")
      .select("id, client_id, due_date")
      .eq("milestone_key", "renewal")
      .in("client_id", renewals.map((r) => r.client_id));
    const byClient = new Map(((existing ?? []) as { id: string; client_id: string; due_date: string | null }[])
      .map((r) => [r.client_id, r]));

    const fresh = renewals.filter((r) => !byClient.has(r.client_id));
    if (fresh.length) await supabase.from("followups").insert(fresh);

    for (const r of renewals) {
      const prev = byClient.get(r.client_id);
      // Same due date = same cycle. Leave it exactly as it is, closed or not:
      // reopening a renewal somebody already handled would be worse than the
      // bug we're fixing.
      if (!prev || prev.due_date === r.due_date) continue;
      await supabase.from("followups").update({
        due_date: r.due_date, label: r.label,
        status: "pending", stage: "PENDING_CALL",
      }).eq("id", prev.id);
    }
  }
  return rows.length;
}

export async function runDaily() {
  const supabase = createAdminClient();
  const renewed = await processRenewals(supabase);
  const reminders = await sendReminders(supabase);
  const followups = await generateFollowups(supabase);
  // BluePrint turnaround: warn before the 24h/48h deadlines, escalate after.
  const sla = await runBlueprintSla(supabase);
  // Comprehensive turnarounds + day-offset milestones.
  const comp = await runComprehensiveSla(supabase);
  // PT: fitness-reassessment prompts, never-scheduled packages, and
  // session-cycle deadlines.
  const pt = await runPtSla(supabase);
  // Lead callbacks: remind the owner, escalate to management after 3 days.
  const cb = await runLeadFollowups(supabase, todayISO());
  // Leads nobody committed to at all — the inverse of the callback sweep, and
  // by far the larger group. One digest per owner, never per lead.
  const cov = await runLeadCoverage(supabase, todayISO());
  // High-value deals going quiet. Silent until leads carry an expected_value.
  const idle = await runLeadIdle(supabase, todayISO());
  // Leads where work is happening but nothing progresses. Silent until the
  // 0086 stage clock has recorded real transitions.
  const stag = await runLeadStagnation(supabase, todayISO());
  // Concerns the coach hasn't answered — escalated to the Medical Director.
  const esc = await runConcernEscalation(supabase, todayISO());
  await supabase.from("audit_log").insert({
    actor_name: "System (cron)", actor_role: "System", action: "Daily automation run",
    target: null,
    detail: `renewed ${renewed} · reminders ${reminders} · follow-ups ${followups}`
      + ` · blueprint SLA ${sla.scanned}/${sla.warnings}/${sla.breaches}`
      + ` · comprehensive SLA ${comp.scanned}/${comp.warnings}/${comp.breaches} (scanned/warned/breached)`
      + ` · concerns escalated ${esc.escalated}/${esc.scanned}`
      + ` · ${comp.booked} bookings queued, ${comp.outOfOrder} out of order`
      + ` · PT SLA ${pt.scanned} scanned / ${pt.booked} reassess booked / ${pt.unbooked} never scheduled / ${pt.overdueSessions} sessions behind`
      + ` · callbacks ${cb.due} due / ${cb.late} late / ${cb.escalated} escalated`
      + ` · coverage digests ${cov.sent} sent to ${cov.owners} owner(s), ${cov.leads} leads with no next step`
      + ` · idle deals ${idle.idle} flagged / ${idle.escalated} escalated of ${idle.scanned} valued`
      + ` · stagnant ${stag.stagnant} / ${stag.escalated} stalled of ${stag.scanned} clocked, ${stag.digests} digest(s)`,
  });
  await notifyRoles(supabase, ["Administrator", "Manager"], {
    title: "Daily automation ran",
    body: `${renewed} renewals · ${reminders} reminders · ${followups} follow-ups queued`
      + (cb.escalated ? ` · ${cb.escalated} callback${cb.escalated === 1 ? "" : "s"} escalated` : "")
      + (idle.value ? ` · ${idle.idle + idle.escalated} deal(s) worth ₹${Math.round(idle.value).toLocaleString("en-IN")} going quiet` : "")
      + (sla.breaches + comp.breaches
          ? ` · ${sla.breaches + comp.breaches} care deadline${sla.breaches + comp.breaches === 1 ? "" : "s"} missed`
          : ""),
    href: "/followups", icon: "⚙️",
  });
  return { renewed, reminders, followups, sla, comp, callbacks: cb, coverage: cov, idle, stagnation: stag, ranAt: new Date().toISOString() };
}
