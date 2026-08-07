import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { canConsult } from "@/lib/roles";
import { todayISO } from "@/lib/today";
import { ageFromDob } from "@/lib/dob";
import { daysBetween } from "@/lib/whiteboard";
import { stageClient, STAGE_META, STAGE_RANK, type StageKey, type StageInput } from "@/lib/whiteboard-stage";
import type { BpScores } from "@/lib/blueprint";
import { openWhiteboard, closeWhiteboard } from "@/lib/actions";
import WhiteboardReviewRow, { type ReviewRowData, type RowAlert } from "@/components/WhiteboardReviewRow";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import { RingMeter } from "@/components/Meters";
import { disciplineLabel } from "@/lib/disciplines";

const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
const btn: React.CSSProperties = { border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "7px 13px", fontSize: 13, fontWeight: 600, cursor: "pointer" };

// Daily team whiteboard — the mandatory working-day walk through every alive
// client. Reused as the standalone /whiteboard page and the workspace tab.
export default async function WhiteboardSection({ me, heading = false }: { me: { role: string; branch?: string | null }; heading?: boolean }) {
  const supabase = await createClient();
  const today = todayISO();
  const branch = me.branch ?? "Kochi";

  const { data: sessionRow } = await supabase
    .from("whiteboard_sessions").select("*").eq("date", today).eq("branch", branch).maybeSingle();
  const session = sessionRow as { id: string; date: string; branch: string | null; status: string; facilitator: string | null } | null;

  const [
    { data: clientData }, { data: bpData }, { data: sessData }, { data: concernData },
    { data: fuData }, { data: measureData }, { data: pkgData }, { data: asgData },
    { data: staffData }, { data: slaData },
  ] = await Promise.all([
    supabase.from("clients").select("id, code, name, dob, gender, conditions, goals").or(`branch.eq.${branch},branch.is.null`),
    supabase.from("blueprints").select("client_id, scores, generated"),
    supabase.from("sessions").select("client_id, status, date"),
    supabase.from("concerns").select("id, client_id, status, body, role, created_at").eq("status", "Open"),
    supabase.from("followups").select("id, client_id, status, due_date, label").eq("status", "pending"),
    supabase.from("measurements").select("client_id, weight, body_fat, bmi, date").order("date", { ascending: false }),
    supabase.from("client_packages").select("client_id, category, status").eq("status", "active"),
    supabase.from("client_assignments").select("client_id, discipline, staff_id"),
    supabase.from("staff").select("id, name, role"),
    supabase.from("blueprint_sla_events").select("client_id, protocol").eq("kind", "breach"),
  ]);

  const clients = (clientData ?? []) as { id: string; code: string | null; name: string; dob: string | null; gender: string | null; conditions: string | null; goals: string[] | null }[];
  const bps = new Map(((bpData ?? []) as { client_id: string; scores: BpScores | null; generated: boolean }[]).map((b) => [b.client_id, b]));
  const sessions = (sessData ?? []) as { client_id: string; status: string; date: string }[];
  const concerns = (concernData ?? []) as { id: string; client_id: string; status: string; body: string; role: string | null; created_at: string | null }[];
  const followups = (fuData ?? []) as { id: string; client_id: string; status: string; due_date: string; label: string }[];
  const measurements = (measureData ?? []) as { client_id: string; weight: number | null; body_fat: number | null; bmi: number | null; date: string | null }[];
  const staff = new Map(((staffData ?? []) as { id: string; name: string; role: string }[]).map((s) => [s.id, s]));

  // alive = has an active package; the category informs the SLA protocol owner.
  const aliveCat = new Map<string, string[]>();
  for (const p of (pkgData ?? []) as { client_id: string; category: string }[]) {
    (aliveCat.get(p.client_id) ?? aliveCat.set(p.client_id, []).get(p.client_id)!).push(p.category);
  }

  // owner resolution: client + discipline → staff name.
  const asgByClient = new Map<string, { discipline: string; staff_id: string | null }[]>();
  for (const a of (asgData ?? []) as { client_id: string; discipline: string; staff_id: string | null }[]) {
    (asgByClient.get(a.client_id) ?? asgByClient.set(a.client_id, []).get(a.client_id)!).push(a);
  }
  const ownerName = (clientId: string, discipline: string | null): string => {
    const rows = asgByClient.get(clientId) ?? [];
    const exact = discipline ? rows.find((r) => r.discipline === discipline) : null;
    const pick = exact ?? rows[0] ?? null;
    const name = pick?.staff_id ? staff.get(pick.staff_id)?.name : null;
    if (name) return discipline && !exact ? `${name} (care team)` : name;
    return discipline ? `Unassigned ${disciplineLabel(discipline)}` : "Unassigned";
  };

  const slaProtocol = new Map<string, string>();
  for (const e of (slaData ?? []) as { client_id: string; protocol: string }[]) slaProtocol.set(e.client_id, e.protocol);
  const breached = new Set(slaProtocol.keys());

  // responses + reviews for today's board
  let responses = new Map<string, { why: string | null; solution: string | null; resolved: boolean; answered_by: string | null }>();
  let reviewed = new Set<string>();
  if (session) {
    const [{ data: respData }, { data: revData }] = await Promise.all([
      supabase.from("whiteboard_alert_responses").select("client_id, alert_key, why, solution, resolved, answered_by").eq("session_id", session.id),
      supabase.from("whiteboard_reviews").select("client_id").eq("session_id", session.id),
    ]);
    responses = new Map(((respData ?? []) as { client_id: string; alert_key: string; why: string | null; solution: string | null; resolved: boolean; answered_by: string | null }[])
      .map((r) => [`${r.client_id}|${r.alert_key}`, r]));
    reviewed = new Set(((revData ?? []) as { client_id: string }[]).map((r) => r.client_id));
  }

  // Build a staged view for every client.
  type Staged = ReviewRowData & { alive: boolean; rank: number };
  const staged: Staged[] = clients.map((c) => {
    const alive = aliveCat.has(c.id);
    const cats = aliveCat.get(c.id) ?? [];
    const mine = sessions.filter((s) => s.client_id === c.id);
    const done = mine.filter((s) => s.status === "completed").map((s) => s.date).sort();
    const lastSession = done.length ? done[done.length - 1] : null;
    const upcoming = mine.filter((s) => s.status === "scheduled" && s.date >= today).length;

    const input: StageInput = {
      scores: bps.get(c.id)?.scores ?? null,
      slaBreached: breached.has(c.id),
      slaProtocol: slaProtocol.get(c.id) ?? (cats.includes("blueprint") ? "blueprint" : cats[0] ?? null),
      openConcerns: concerns.filter((x) => x.client_id === c.id).map((x) => ({ id: x.id, body: x.body, role: x.role, created_at: x.created_at })),
      today,
      overdueFollowups: followups.filter((f) => f.client_id === c.id && f.due_date < today).map((f) => ({ id: f.id, label: f.label })),
      nothingBooked: !upcoming && Boolean(lastSession),
      daysQuiet: lastSession ? daysBetween(lastSession, today) : 0,
    };
    const { alerts, stage } = stageClient(input);

    const rowAlerts: RowAlert[] = alerts.map((a) => {
      const r = responses.get(`${c.id}|${a.key}`);
      return {
        key: a.key, kind: a.kind, label: a.label, detail: a.detail, severity: a.severity,
        discipline: a.discipline, ownerName: ownerName(c.id, a.discipline),
        area: `/clients/${c.id}`,
        why: r?.why ?? null, solution: r?.solution ?? null, resolved: r?.resolved ?? false, answeredBy: r?.answered_by ?? null,
      };
    });

    const m = measurements.find((x) => x.client_id === c.id);
    const facts = [
      { label: "last session", value: lastSession ?? "—" },
      { label: "upcoming", value: String(upcoming) },
      { label: "weight", value: m?.weight != null ? `${m.weight}kg` : "—" },
      { label: "conditions", value: c.conditions || "none" },
    ];

    return {
      sessionId: session?.id ?? "", clientId: c.id, name: c.name, code: c.code, age: ageFromDob(c.dob),
      stage, alerts: rowAlerts, reviewed: reviewed.has(c.id), facts,
      alive, rank: STAGE_RANK[stage],
    };
  });

  const total = staged.length;
  const aliveRows = staged.filter((s) => s.alive).sort((a, b) => b.rank - a.rank || a.name.localeCompare(b.name));
  const deadRows = staged.filter((s) => !s.alive).sort((a, b) => a.name.localeCompare(b.name));
  const alerted = aliveRows.filter((s) => s.alerts.length > 0);
  const openAlerts = alerted.reduce((n, s) => n + s.alerts.filter((a) => !a.solution).length, 0);
  const reviewedCount = aliveRows.filter((s) => s.reviewed).length;
  const pct = aliveRows.length ? Math.round((reviewedCount / aliveRows.length) * 100) : 0;

  const stageCounts = STAGE_RANK; // reuse keys order
  const countByStage = (k: StageKey) => aliveRows.filter((s) => s.stage === k).length;

  const locked = session?.status === "closed" || !canConsult(me.role);

  const statCard = (n: number | string, label: string, color: string) => (
    <div style={{ ...box, padding: "12px 16px", flex: 1, minWidth: 120 }}>
      <div style={{ fontSize: 26, fontWeight: 800, color }}>{n}</div>
      <div style={{ color: "var(--muted)", fontSize: 12.5 }}>{label}</div>
    </div>
  );

  return (
    <div style={{ maxWidth: 1180 }}>
      <RealtimeRefresh tables={["whiteboard_sessions", "whiteboard_alert_responses", "whiteboard_reviews", "concerns", "followups"]} />
      {heading && <h1 style={{ fontSize: 20, margin: "0 0 4px" }}>Whiteboard</h1>}
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 16px" }}>
        Mandatory daily walk-through — every alive client, one by one. Alive in green, dropped in red. Where a client is flagged, the assigned person records why and the fix.
      </p>

      {/* headline stats */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        {statCard(total, "Total clients", "var(--ink)")}
        {statCard(aliveRows.length, "Alive (active package)", "#15803d")}
        {statCard(deadRows.length, "Dropped (no active package)", "#b91c1c")}
        {statCard(alerted.length, "With major alerts", alerted.length ? "#c2410c" : "var(--muted)")}
      </div>

      {/* stage legend */}
      <div style={{ ...box, padding: "10px 14px", marginBottom: 16, display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>Stages:</span>
        {(Object.keys(stageCounts) as StageKey[]).map((k) => (
          <span key={k} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            <span style={{ width: 11, height: 11, borderRadius: 999, background: STAGE_META[k].dot }} />
            {STAGE_META[k].label}<b style={{ color: "var(--ink)" }}>{countByStage(k)}</b>
          </span>
        ))}
      </div>

      {!session ? (
        <div style={{ ...box, padding: "26px 22px", textAlign: "center" }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>No board open for today</div>
          <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 14 }}>
            The whiteboard is mandatory every working day — open it to walk the team through all {aliveRows.length} alive clients.
          </div>
          <form action={openWhiteboard}>
            <input type="hidden" name="branch" value={branch} />
            <button type="submit" style={{ ...btn, background: "var(--ink)", color: "#fff", border: "none", padding: "10px 18px" }}>Open today&apos;s board</button>
          </form>
        </div>
      ) : (
        <>
          <div style={{ ...box, padding: "14px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 16 }}>
            <RingMeter value={pct} size={58} stroke={7} centerText={`${reviewedCount}/${aliveRows.length}`} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700 }}>
                {new Date(today + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}
                {session.status === "closed" && <span style={{ marginLeft: 8, background: "var(--neutral-bg)", color: "var(--muted)", borderRadius: 999, padding: "1px 9px", fontSize: 11, fontWeight: 700 }}>Closed</span>}
              </div>
              <div style={{ color: "var(--muted)", fontSize: 12.5 }}>
                {branch}{session.facilitator ? ` · led by ${session.facilitator}` : ""} · {reviewedCount} of {aliveRows.length} reviewed{openAlerts ? ` · ${openAlerts} answer${openAlerts === 1 ? "" : "s"} needed` : ""}
              </div>
            </div>
            {session.status === "open" && canConsult(me.role) && (
              <form action={closeWhiteboard}>
                <input type="hidden" name="session_id" value={session.id} />
                <button type="submit" style={btn}>Close board</button>
              </form>
            )}
          </div>

          {/* summary: alive clients with major alerts */}
          <div style={{ fontWeight: 700, fontSize: 14, margin: "4px 0 8px" }}>
            Alive clients with major alerts · {alerted.length}
            {openAlerts > 0 && <span style={{ marginLeft: 8, background: "rgba(220,38,38,0.10)", color: "#b91c1c", borderRadius: 999, padding: "1px 9px", fontSize: 11, fontWeight: 700 }}>{openAlerts} awaiting why + solution</span>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
            {alerted.length ? alerted.map((s) => (
              <WhiteboardReviewRow key={s.clientId} data={s} locked={locked} />
            )) : (
              <div style={{ ...box, padding: "18px 16px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
                No major alerts on any alive client. 🎉
              </div>
            )}
          </div>

          {/* step by step: every alive client */}
          <div style={{ fontWeight: 700, fontSize: 14, margin: "4px 0 8px" }}>Step by step — all alive clients · {aliveRows.length}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
            {aliveRows.map((s) => (
              <WhiteboardReviewRow key={s.clientId} data={s} locked={locked} />
            ))}
          </div>

          {/* dropped clients */}
          {deadRows.length > 0 && (
            <details style={{ ...box, padding: "12px 16px", marginBottom: 8 }}>
              <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: 14, color: "#b91c1c" }}>Dropped clients · {deadRows.length} <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: 12 }}>(no active package)</span></summary>
              <div style={{ display: "grid", gap: 4, marginTop: 10 }}>
                {deadRows.map((s) => (
                  <Link key={s.clientId} href={`/clients/${s.clientId}`} style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "inherit", padding: "3px 0" }}>
                    <span style={{ width: 10, height: 10, borderRadius: 999, background: "#dc2626", flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</span>
                    {s.code && <span style={{ color: "var(--muted)", fontSize: 12 }}>· {s.code}</span>}
                    <span style={{ flex: 1 }} />
                    <span style={{ color: "var(--muted)", fontSize: 12 }}>no active package</span>
                  </Link>
                ))}
              </div>
            </details>
          )}
        </>
      )}

      <div style={{ marginTop: 12, fontSize: 12, color: "var(--muted)" }}>
        Answers here are a dated working record. The signed-off <Link href="/blueprint" style={{ color: "var(--brand-text)" }}>BluePrint</Link> document is never overwritten.
      </div>
    </div>
  );
}
