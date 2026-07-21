// Nightly lead-callback sweep.
//
// The sales audit's second-biggest finding: 117 "interested" leads with no next
// step. A callback date that nobody is reminded about is the same as no
// callback date, so this turns the date into a notification.
//
// The ladder, and why it stops where it does:
//   due today      → the owner, once
//   1–2 days late  → the owner again
//   3+ days late   → management
//
// Escalating on day one would make managers the first line of chasing, which
// teaches everyone to ignore escalations. Three days is long enough that the
// owner has genuinely dropped it rather than had a busy morning.
//
// Idempotency: a `lead_id|status|date` key in blueprint_sla_events. Without it
// an escalated lead would notify management every night until someone acted,
// which is exactly how a useful alert becomes noise.

import { followupView } from "@/lib/lead-followup";
import { notifyRoles } from "@/lib/notify";

type Sb = { from: (t: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any

export type LeadSweepResult = { due: number; late: number; escalated: number };

const MANAGEMENT = ["Manager", "Administrator", "Super Admin"];
const FRONT_DESK = ["Front Desk"];
const PROTOCOL = "lead_followup";

export async function runLeadFollowups(supabase: Sb, today: string): Promise<LeadSweepResult> {
  // Only leads still in play. A won or lost lead with a stale callback date
  // isn't a missed follow-up, it's a leftover.
  const { data: leadRows } = await supabase
    .from("leads")
    .select("id, name, phone, stage, next_follow_up, next_follow_up_note, follow_up_owner, fde")
    .not("next_follow_up", "is", null)
    .lte("next_follow_up", today)
    .neq("stage", "LOST");

  const leads = (leadRows ?? []) as {
    id: string; name: string; phone: string | null; stage: string | null;
    next_follow_up: string | null; next_follow_up_note: string | null;
    follow_up_owner: string | null; fde: string | null;
  }[];
  const open = leads.filter((l) => !(l.stage ?? "").startsWith("5"));
  if (!open.length) return { due: 0, late: 0, escalated: 0 };

  const ids = open.map((l) => l.id);
  const { data: seen } = await supabase
    .from("blueprint_sla_events")
    .select("client_id, gate, kind")
    .eq("protocol", PROTOCOL)
    .in("client_id", ids);
  const already = new Set(
    ((seen ?? []) as { client_id: string; gate: string; kind: string }[])
      .map((e) => `${e.client_id}|${e.gate}|${e.kind}`),
  );

  const events: { client_id: string; protocol: string; gate: string; kind: string; due_at: string }[] = [];
  let due = 0, late = 0, escalated = 0;

  for (const l of open) {
    const v = followupView(l.next_follow_up, today);
    if (!v.actionable) continue;

    // Gate keyed on the due date, so moving the callback forward starts a
    // fresh notification cycle rather than staying silent forever.
    const gate = `callback:${l.next_follow_up}`;
    const key = `${l.id}|${gate}|${v.status}`;
    if (already.has(key)) continue;
    already.add(key);

    const owner = l.follow_up_owner ?? l.fde ?? null;
    const who = owner ? ` (${owner})` : "";
    const note = l.next_follow_up_note ? ` — ${l.next_follow_up_note}` : "";

    if (v.status === "due") due++;
    else if (v.status === "late") late++;
    else escalated++;

    // Front desk owns the calling. Management only hears about it once the
    // owner has had three days.
    const roles = v.status === "escalated" ? [...FRONT_DESK, ...MANAGEMENT] : FRONT_DESK;

    await notifyRoles(supabase, roles, {
      title: v.status === "escalated"
        ? `Callback ${v.label} — ${l.name}`
        : `Callback ${v.label.toLowerCase()} — ${l.name}`,
      body: `${l.phone ?? "no phone"}${who}${note}`,
      href: `/leads/${l.id}`,
      icon: v.status === "escalated" ? "🔴" : "📞",
    });

    events.push({
      client_id: l.id, protocol: PROTOCOL, gate, kind: v.status,
      due_at: `${l.next_follow_up}T00:00:00Z`,
    });
  }

  if (events.length) {
    await supabase.from("blueprint_sla_events")
      .upsert(events, { onConflict: "client_id,protocol,gate,kind", ignoreDuplicates: true });
  }

  return { due, late, escalated };
}
