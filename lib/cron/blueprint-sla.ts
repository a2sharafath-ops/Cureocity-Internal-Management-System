// Nightly BluePrint SLA sweep.
//
// Reads every in-flight BluePrint client, runs the clocks, and tells the right
// people once — and only once — per gate per kind. The `blueprint_sla_events`
// unique constraint on (client_id, gate, kind) is what makes "once" true: a
// blueprint that stays breached for a week notifies on the first night and
// then stays quiet, rather than nagging the same manager nightly forever. Same
// idempotency trick the reminder cron plays with email_log.
//
// Warnings fire before the deadline so a breach can be prevented; breaches
// escalate to management. Both are recorded, so "how often do we miss this?"
// becomes a query rather than a memory.

import { blueprintSla, formatLeft, KIND_LABEL, type SlaKind } from "@/lib/blueprint-sla";
import { notifyRoles } from "@/lib/notify";

type Sb = {
  from: (t: string) => any;   // eslint-disable-line @typescript-eslint/no-explicit-any
};

export type SlaSweepResult = {
  scanned: number;
  warnings: number;
  breaches: number;
};

/** Discipline -> the roles that owe the sign-off. Mirrors ownsConsultKind. */
const OWNER_ROLES: Record<SlaKind, string[]> = {
  Doctor: ["Doctor"],
  Diet: ["Dietitian"],
  Trainer: ["Fitness Trainer"],
};

const MANAGEMENT = ["Manager", "Administrator", "Super Admin"];

export async function runBlueprintSla(supabase: Sb, now: number = Date.now()): Promise<SlaSweepResult> {
  // Only BluePrint clients that haven't been delivered. A generated blueprint
  // has passed every gate; re-checking it would just re-derive "met".
  const { data: bps } = await supabase
    .from("blueprints")
    .select("client_id, consolidated_at, approved_at, hold_since, hold_ms, generated")
    .eq("generated", false);

  const rows = (bps ?? []) as {
    client_id: string; consolidated_at: string | null; approved_at: string | null;
    hold_since: string | null; hold_ms: number | null; generated: boolean;
  }[];
  if (!rows.length) return { scanned: 0, warnings: 0, breaches: 0 };

  const ids = rows.map((r) => r.client_id);
  const [{ data: consults }, { data: clients }, { data: seen }] = await Promise.all([
    supabase.from("consultations")
      .select("client_id, kind, completed_at, approved_at").in("client_id", ids),
    supabase.from("clients").select("id, name").in("id", ids),
    supabase.from("blueprint_sla_events").select("client_id, gate, kind").in("client_id", ids),
  ]);

  const nameOf = new Map(((clients ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]));
  const already = new Set(
    ((seen ?? []) as { client_id: string; gate: string; kind: string }[])
      .map((e) => `${e.client_id}|${e.gate}|${e.kind}`),
  );
  const byClient = new Map<string, { kind: string; completedAt: string | null; approvedAt: string | null }[]>();
  for (const c of (consults ?? []) as { client_id: string; kind: string; completed_at: string | null; approved_at: string | null }[]) {
    const list = byClient.get(c.client_id) ?? [];
    list.push({ kind: c.kind, completedAt: c.completed_at, approvedAt: c.approved_at });
    byClient.set(c.client_id, list);
  }

  const events: { client_id: string; gate: string; kind: string; due_at: string }[] = [];
  let warnings = 0, breaches = 0;

  for (const bp of rows) {
    const name = nameOf.get(bp.client_id) ?? "A client";
    const report = blueprintSla({
      consults: byClient.get(bp.client_id) ?? [],
      consolidatedAt: bp.consolidated_at,
      approvedAt: bp.approved_at,
      hold: { holdSince: bp.hold_since, holdMs: Number(bp.hold_ms ?? 0) },
    }, now);

    // A client-side hold means the delay isn't ours. Skip entirely rather than
    // notify — the clocks are already extended, so anything firing here would
    // be an artefact of a stale deadline.
    if (report.onHold) continue;

    const fire = async (gate: string, kind: "warning" | "breach", dueAt: string, roles: string[], msLeft: number | null, what: string) => {
      const key = `${bp.client_id}|${gate}|${kind}`;
      if (already.has(key)) return;
      already.add(key);
      events.push({ client_id: bp.client_id, gate, kind, due_at: dueAt });
      if (kind === "warning") warnings++; else breaches++;
      await notifyRoles(supabase, roles, {
        title: kind === "breach" ? `BluePrint SLA missed — ${name}` : `BluePrint due soon — ${name}`,
        body: `${what} · ${formatLeft(msLeft)}`,
        href: "/blueprint",
        icon: kind === "breach" ? "🔴" : "⏳",
      });
    };

    for (const { kind, clock } of report.signoffs) {
      const gate = `signoff:${kind}`;
      const what = `${KIND_LABEL[kind]} summary sign-off (24h)`;
      if (clock.status === "due_soon" && clock.dueAt) {
        // Warn only the person who owes it — management doesn't need to know
        // about work that is still on track to land.
        await fire(gate, "warning", clock.dueAt, OWNER_ROLES[kind], clock.msLeft, what);
      }
      if (clock.status === "breached" && clock.dueAt) {
        await fire(gate, "breach", clock.dueAt, [...OWNER_ROLES[kind], ...MANAGEMENT], clock.msLeft, what);
      }
    }

    const c = report.consolidated;
    const what = "Consolidated summary + blueprint approval (48h)";
    if (c.status === "due_soon" && c.dueAt) {
      await fire("consolidated", "warning", c.dueAt, [...OWNER_ROLES.Doctor, ...MANAGEMENT], c.msLeft, what);
    }
    if (c.status === "breached" && c.dueAt) {
      await fire("consolidated", "breach", c.dueAt, [...OWNER_ROLES.Doctor, ...MANAGEMENT], c.msLeft, what);
    }
  }

  if (events.length) {
    // ignoreDuplicates so a race with a second sweep can't throw; the unique
    // constraint remains the source of truth for "already told them".
    await supabase.from("blueprint_sla_events")
      .upsert(events, { onConflict: "client_id,gate,kind", ignoreDuplicates: true });
  }

  return { scanned: rows.length, warnings, breaches };
}
