// Nightly sweep: high-value leads that have gone quiet.
//
// Dormant until the team starts entering `expected_value` — see lib/lead-idle.ts
// for why that is deliberate rather than an oversight.
//
// Unlike the coverage digest, this one is PER LEAD. That is the right shape
// here precisely because it is rare: a ₹35,000 deal going cold is a specific
// thing a specific person should do something about today, not a line in a
// summary. The value threshold is what keeps the volume low enough for that to
// stay true.

import {
  idleVerdict, alertTitle, alertBody, money,
  IDLE_ESCALATE_DAYS, type IdleLead,
} from "@/lib/lead-idle";
import { notifyRoles, notifyStaff } from "@/lib/notify";

type Sb = { from: (t: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any

const PROTOCOL = "lead_idle";
const MANAGEMENT = ["Manager", "Administrator", "Super Admin"];
const FRONT_DESK = ["Front Desk"];

export type IdleSweepResult = { scanned: number; idle: number; escalated: number; value: number };

export async function runLeadIdle(supabase: Sb, today: string): Promise<IdleSweepResult> {
  // Only leads carrying a value can possibly qualify, so filter in the query
  // rather than pulling all 999 and discarding them.
  const { data: leadRows } = await supabase
    .from("leads")
    .select("id, name, owner_id, stage, expected_value, expected_close, disqualified_at, created_at")
    .not("expected_value", "is", null);

  const leads = (leadRows ?? []) as (IdleLead & { created_at: string | null })[];
  if (!leads.length) return { scanned: 0, idle: 0, escalated: 0, value: 0 };

  // Last contact = most recent remark. A lead nobody has ever remarked on has
  // been quiet since it arrived, which is the harshest reading and the right
  // one — an untouched ₹35,000 enquiry is worse than a neglected one.
  const ids = leads.map((l) => l.id);
  const { data: remarkRows } = await supabase
    .from("lead_remarks")
    .select("lead_id, created_at")
    .in("lead_id", ids);

  const lastRemark = new Map<string, string>();
  for (const r of (remarkRows ?? []) as { lead_id: string; created_at: string }[]) {
    const prev = lastRemark.get(r.lead_id);
    if (!prev || r.created_at > prev) lastRemark.set(r.lead_id, r.created_at);
  }

  const { data: seen } = await supabase
    .from("automation_events")
    .select("subject_id, gate, kind")
    .eq("protocol", PROTOCOL)
    .in("subject_id", ids);
  const already = new Set(
    ((seen ?? []) as { subject_id: string; gate: string; kind: string }[])
      .map((e) => `${e.subject_id}|${e.gate}|${e.kind}`),
  );

  const events: { subject_id: string; subject_kind: string; protocol: string; gate: string; kind: string; due_at: string }[] = [];
  let idle = 0, escalated = 0, value = 0;

  for (const l of leads) {
    const touch = lastRemark.get(l.id) ?? l.created_at;
    const verdict = idleVerdict({ ...l, last_touch: touch }, today);
    if (!verdict || verdict.status === "ok") continue;

    // Gate embeds the week, so a deal that stays quiet re-alerts weekly rather
    // than nightly — persistent without being nagging.
    const week = Math.floor(Date.parse(`${today}T00:00:00Z`) / (7 * 86_400_000));
    const gate = `idle:${week}`;
    const key = `${l.id}|${gate}|${verdict.status}`;
    if (already.has(key)) continue;
    already.add(key);

    if (verdict.status === "escalated") escalated++; else idle++;
    value += verdict.value;

    const payload = {
      title: alertTitle(l, verdict),
      body: alertBody(verdict),
      href: `/leads/${l.id}`,
      icon: verdict.closingSoon ? "🔥" : "💰",
    };

    const reached = l.owner_id ? await notifyStaff(supabase, l.owner_id, payload) : false;
    if (!reached) await notifyRoles(supabase, FRONT_DESK, payload);

    // Money is management's business once the owner has had two weeks.
    if (verdict.status === "escalated") {
      await notifyRoles(supabase, MANAGEMENT, {
        ...payload,
        body: `${payload.body} Worth ${money(verdict.value)}.`,
      });
    }

    events.push({
      subject_id: l.id, subject_kind: "lead", protocol: PROTOCOL,
      gate, kind: verdict.status, due_at: `${today}T00:00:00Z`,
    });
  }

  if (events.length) {
    await supabase.from("automation_events")
      .upsert(events, { onConflict: "subject_id,protocol,gate,kind", ignoreDuplicates: true });
  }

  return { scanned: leads.length, idle, escalated, value };
}
