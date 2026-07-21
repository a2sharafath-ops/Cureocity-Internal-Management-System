// Nightly sweep: leads that have stopped moving.
//
// Digest per owner, like the coverage sweep, and for the same reason — once the
// clock has been running a while this could match hundreds of Discovery leads
// at once. Per-lead alerts are reserved for the idle high-value sweep, where
// rarity is guaranteed by the money threshold.
//
// Silent until migration 0086 has been running long enough for real transitions
// to accumulate: every existing lead starts with stage_changed_at NULL, and
// NULL is treated as unknown, never as stuck.

import {
  stagnationVerdict, STAGE_PATIENCE, type StageLead,
} from "@/lib/lead-stagnation";
import { notifyRoles, notifyStaff } from "@/lib/notify";

type Sb = { from: (t: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any

const PROTOCOL = "lead_stagnation";
const MANAGEMENT = ["Manager", "Administrator", "Super Admin"];
const FRONT_DESK = ["Front Desk"];

export type StagnationSweepResult = { scanned: number; stagnant: number; escalated: number; digests: number };

export async function runLeadStagnation(supabase: Sb, today: string): Promise<StagnationSweepResult> {
  // Only rows whose clock has actually started. Everything else is unknowable,
  // and the query filter says so more cheaply than the engine can.
  const { data: leadRows } = await supabase
    .from("leads")
    .select("id, name, owner_id, stage, stage_changed_at, disqualified_at")
    .not("stage_changed_at", "is", null);

  const leads = (leadRows ?? []) as StageLead[];
  if (!leads.length) return { scanned: 0, stagnant: 0, escalated: 0, digests: 0 };

  // Group the breaches by owner.
  type Hit = { lead: StageLead; days: number; stage: string; escalated: boolean };
  const byOwner = new Map<string, Hit[]>();
  const unowned: Hit[] = [];
  let stagnant = 0, escalated = 0;

  for (const l of leads) {
    const v = stagnationVerdict(l, today);
    if (!v || v.status === "ok") continue;
    if (v.status === "escalated") escalated++; else stagnant++;
    const hit: Hit = { lead: l, days: v.daysInStage, stage: v.stage, escalated: v.status === "escalated" };
    if (!l.owner_id) { unowned.push(hit); continue; }
    const g = byOwner.get(l.owner_id) ?? [];
    g.push(hit); byOwner.set(l.owner_id, g);
  }

  if (!stagnant && !escalated) return { scanned: leads.length, stagnant: 0, escalated: 0, digests: 0 };

  const gate = `stagnation:${today}`;
  const ownerIds = [...byOwner.keys()];
  const { data: seen } = await supabase
    .from("automation_events")
    .select("subject_id")
    .eq("protocol", PROTOCOL).eq("gate", gate).eq("kind", "digest")
    .in("subject_id", ownerIds);
  const already = new Set(((seen ?? []) as { subject_id: string }[]).map((e) => e.subject_id));

  const summarise = (hits: Hit[]): string => {
    // Group by stage so the message says where the pipeline is clogging, not
    // just how many leads are stuck.
    const perStage = new Map<string, number>();
    for (const h of hits) perStage.set(h.stage, (perStage.get(h.stage) ?? 0) + 1);
    const parts = [...perStage.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([s, n]) => `${n} in ${s.replace(/^\d-/, "")}`);
    const worst = hits.reduce((a, b) => (b.days > a.days ? b : a));
    return `${parts.join(" · ")}. Longest: ${worst.lead.name}, ${worst.days} days.`;
  };

  let digests = 0;
  for (const [ownerId, hits] of byOwner) {
    if (already.has(ownerId)) continue;
    const anyEscalated = hits.some((h) => h.escalated);
    const delivered = await notifyStaff(supabase, ownerId, {
      title: `${hits.length} lead${hits.length === 1 ? "" : "s"} not moving`,
      body: summarise(hits),
      href: "/leads?view=open&mine=1",
      icon: anyEscalated ? "🟠" : "⏳",
    });
    if (!delivered) continue;

    await supabase.from("automation_events").upsert(
      { subject_id: ownerId, subject_kind: "staff", protocol: PROTOCOL, gate, kind: "digest",
        due_at: `${today}T00:00:00Z` },
      { onConflict: "subject_id,protocol,gate,kind" },
    );
    digests++;
  }

  // Unowned stagnant leads have nobody to tell, so the role hears about them.
  if (unowned.length) {
    await notifyRoles(supabase, FRONT_DESK, {
      title: `${unowned.length} unowned lead${unowned.length === 1 ? "" : "s"} not moving`,
      body: summarise(unowned),
      href: "/leads?view=open", icon: "⏳",
    });
  }

  // Management gets the shape of the problem, not each instance — where the
  // pipeline clogs is a process question, not a chasing question.
  if (escalated) {
    await notifyRoles(supabase, MANAGEMENT, {
      title: `${escalated} lead${escalated === 1 ? "" : "s"} stalled well past expected time`,
      body: `Across ${byOwner.size} owner(s). Thresholds: `
        + Object.entries(STAGE_PATIENCE).map(([s, d]) => `${s.replace(/^\d-/, "")} ${d}d`).join(", "),
      href: "/leads?view=open", icon: "🟠",
    });
  }

  return { scanned: leads.length, stagnant, escalated, digests };
}
