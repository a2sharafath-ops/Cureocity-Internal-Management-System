import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/today";
import { applicableMarkerKeys, MARKERS, TONE_STYLE, markerOverdueDays, type MarkerKey } from "@/lib/coach-markers";
import { MARKER_BASELINE_GRACE_DAYS } from "@/lib/work-owners";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import MarkerAssessment from "@/components/MarkerAssessment";
import { isHealthCoachSupervisor } from "@/lib/roles";

const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

// Health-Coach workspace board — applicable SOP screening markers per client,
// with non-indicated tools still available for an explicit clinical decision.
export default async function CoachMarkersSection({ me, heading = false }: { me: { role: string; staffId?: string | null }; heading?: boolean }) {
  const supabase = await createClient();
  const today = todayISO();
  const isCoach = me.role === "Health Coach";
  const supervisorOverride = isHealthCoachSupervisor(me.role);

  // Coach → their assigned clients; overseers → all clients on a coach's caseload.
  let clientIds: string[] = [];
  if (isCoach && me.staffId) {
    const { data } = await supabase.from("client_assignments").select("client_id").eq("discipline", "coach").eq("staff_id", me.staffId);
    clientIds = ((data ?? []) as { client_id: string }[]).map((r) => r.client_id);
  } else {
    const { data } = await supabase.from("client_assignments").select("client_id").eq("discipline", "coach");
    clientIds = Array.from(new Set(((data ?? []) as { client_id: string }[]).map((r) => r.client_id)));
  }

  const [{ data: cl }, { data: asmt }, { data: baselines }, { data: pkgs }, { data: protos }] = await Promise.all([
    // gender comes along for AUDIT-C, which uses a lower cut-off for women.
    clientIds.length ? supabase.from("clients").select("id, name, code, gender").in("id", clientIds).order("name") : Promise.resolve({ data: [] }),
    clientIds.length ? supabase.from("coach_assessments").select("client_id, marker, score, band, tone, date, next_review_date").in("client_id", clientIds).order("date", { ascending: false }).order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
    clientIds.length ? supabase.from("coach_baselines").select("client_id, status, triggered_pathways").in("client_id", clientIds) : Promise.resolve({ data: [] }),
    // When each client's clock started, so a baseline isn't demanded on day one.
    clientIds.length ? supabase.from("client_packages").select("client_id, start_date").in("client_id", clientIds).eq("status", "active") : Promise.resolve({ data: [] }),
    clientIds.length ? supabase.from("care_protocols").select("client_id, start_date").in("client_id", clientIds).eq("status", "active") : Promise.resolve({ data: [] }),
  ]);

  // Days since care began provide a short grace for a triggered first tool.
  const startOf = new Map<string, string>();
  for (const r of [...((pkgs ?? []) as { client_id: string; start_date: string | null }[]),
                   ...((protos ?? []) as { client_id: string; start_date: string | null }[])]) {
    if (!r.start_date) continue;
    const prev = startOf.get(r.client_id);
    // A care protocol row overwrites a package one, and the earliest wins —
    // matching protocolStartFor, which every dated engine already uses.
    if (!prev || r.start_date < prev) startOf.set(r.client_id, r.start_date);
  }
  const clients = (cl ?? []) as { id: string; name: string; code: string | null; gender: string | null }[];
  // latest assessment per (client, marker)
  const latest = new Map<string, { score: number | null; band: string | null; tone: string | null; date: string; next_review_date: string | null }>();
  const firstDate = new Map<string, string>();
  const assessedByClient = new Map<string, Set<string>>();
  for (const a of (asmt ?? []) as { client_id: string; marker: string; score: number | null; band: string | null; tone: string | null; date: string; next_review_date: string | null }[]) {
    const k = `${a.client_id}|${a.marker}`;
    if (!latest.has(k)) latest.set(k, { score: a.score, band: a.band, tone: a.tone, date: a.date, next_review_date: a.next_review_date });
    const first = firstDate.get(k);
    if (!first || a.date < first) firstDate.set(k, a.date);
    (assessedByClient.get(a.client_id) ?? assessedByClient.set(a.client_id, new Set()).get(a.client_id)!).add(a.marker);
  }
  const baselineByClient = new Map(((baselines ?? []) as { client_id: string; status: string; triggered_pathways: string[] }[])
    .map((baseline) => [baseline.client_id, baseline]));

  const chip = (tone: string | null, label: string) => {
    const s = tone && TONE_STYLE[tone as keyof typeof TONE_STYLE] ? TONE_STYLE[tone as keyof typeof TONE_STYLE] : { bg: "var(--neutral-bg)", text: "var(--muted)" };
    return <span style={{ background: s.bg, color: s.text, borderRadius: 999, padding: "1px 8px", fontSize: 10.5, fontWeight: 700 }}>{label}</span>;
  };

  return (
    <div style={{ maxWidth: 1120 }}>
      <RealtimeRefresh tables={["coach_assessments"]} />
      {heading && <h1 style={{ fontSize: 20, margin: "0 0 4px" }}>Health Coaching</h1>}
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 16px" }}>
        Track the SOP screening markers per client. Complete every applicable item or record the verified official-form result; partial questionnaires are never scored.
      </p>

      {/* SOP guide */}
      <details style={{ ...box, padding: "12px 16px", marginBottom: 16 }}>
        <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: 14 }}>SOP guide — tools, cadence &amp; bands</summary>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12, marginTop: 12 }}>
          {MARKERS.map((m) => (
            <div key={m.key} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px" }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{m.icon} {m.label} <span style={{ color: "var(--muted)", fontWeight: 500 }}>· {m.tool} ({m.range})</span></div>
              <div style={{ fontSize: 12, color: "var(--muted)", margin: "4px 0" }}>{m.frequency}</div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 4 }}>
                {m.bands.map((b) => <span key={b.label} style={{ background: TONE_STYLE[b.tone].bg, color: TONE_STYLE[b.tone].text, borderRadius: 999, padding: "1px 8px", fontSize: 10.5, fontWeight: 600 }}>{b.label} {b.min}–{b.max}</span>)}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--red-text)" }}>⚑ {m.referral}</div>
            </div>
          ))}
        </div>
      </details>

      {/* Per-client marker boards */}
      {clients.length === 0 ? (
        <div style={{ ...box, padding: "22px 16px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
          No clients on your coaching caseload yet. Assign a Health Coach on a client&apos;s care team to see them here.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {clients.map((c) => (
            <div key={c.id} style={{ ...box, padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <Link href={`/clients/${c.id}`} style={{ fontWeight: 700, fontSize: 14.5, textDecoration: "none", color: "var(--ink)" }}>{c.name}</Link>
                {c.code && <span style={{ color: "var(--muted)", fontSize: 12 }}>· {c.code}</span>}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 10 }}>
                {MARKERS.map((m: (typeof MARKERS)[number]) => {
                  const l = latest.get(`${c.id}|${m.key as MarkerKey}`);
                  const baseline = baselineByClient.get(c.id);
                  const applicable = applicableMarkerKeys(
                    baseline?.triggered_pathways ?? [],
                    assessedByClient.get(c.id) ?? [],
                  ).has(m.key);
                  const start = startOf.get(c.id) ?? null;
                  const sinceStart = start ? daysBetween(start, today) : 0;
                  // Same rule and the same grace as the attention queue — the
                  // shared helper, so the two screens cannot drift apart again.
                  const withinGrace = applicable && !l && sinceStart < MARKER_BASELINE_GRACE_DAYS;
                  const overdueDays = !applicable || withinGrace
                    ? null
                    : markerOverdueDays(
                      m,
                      l ? { marker: m.key, date: l.date, tone: l.tone, band: l.band, next_review_date: l.next_review_date } : undefined,
                      today,
                      sinceStart - MARKER_BASELINE_GRACE_DAYS,
                      firstDate.get(`${c.id}|${m.key}`) ?? null,
                    );
                  const dueLabel = !applicable
                    ? (baseline ? "Not currently indicated" : "Awaiting baseline")
                    : !l
                      ? (withinGrace ? "Applicable · due soon" : overdueDays && overdueDays > 0 ? `Due ${overdueDays}d overdue` : "Applicable · due today")
                      : overdueDays !== null && overdueDays > 0
                        ? `Due ${overdueDays}d overdue`
                        : l.next_review_date
                          ? `Next ${l.next_review_date}`
                          : m.cadence.kind === "clinical-plan" ? "No repeat scheduled" : `Last ${daysBetween(l.date, today)}d ago`;
                  const dueBad = overdueDays !== null && overdueDays > 0;
                  return (
                    <div key={m.key} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "9px 11px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 700 }}>{m.icon} {m.label}</span>
                        {l && l.band && chip(l.tone, `${l.band} · ${l.score}`)}
                        <span style={{ flex: 1 }} />
                        <span style={{ fontSize: 10.5, fontWeight: 600, color: dueBad ? "var(--amber-text)" : applicable ? "var(--brand-text)" : "var(--muted)" }}>{dueLabel}</span>
                      </div>
                      <MarkerAssessment clientId={c.id} marker={m.key} tool={m.tool} range={m.range} gender={c.gender} supervisorOverride={supervisorOverride} />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
