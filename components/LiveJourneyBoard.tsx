"use client";

import { useEffect, useState } from "react";
import Chip from "@/components/Chip";
import SubmitButton from "@/components/SubmitButton";
import { journeyHandover, journeyAdvance, journeyNotifyCoach, journeyCancel } from "@/lib/actions";
import {
  stageMeta, isWaitStage, assessmentOf, MAX_WAIT_MS, fmtElapsed, type JourneyKpis,
} from "@/lib/live-journey";

export type BoardRow = {
  id: string;
  name: string;
  phone: string | null;
  goal: string | null;
  source: string | null;
  concerns: string | null;
  coachName: string | null;
  stage: string;
  status: string;
  stageEnteredAt: string;
  notified: boolean;
};

const card: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  boxShadow: "var(--shadow)",
};
const btn: React.CSSProperties = {
  border: "1px solid var(--border)", background: "var(--card)", color: "var(--ink)",
  borderRadius: 8, padding: "5px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer",
};
const btnPrimary: React.CSSProperties = {
  ...btn, background: "var(--brand-text)", color: "#fff", border: "1px solid var(--brand-text)",
};
const th: React.CSSProperties = { textAlign: "left", fontSize: 11, color: "var(--muted)", fontWeight: 600, padding: "8px 10px", borderBottom: "1px solid var(--border)" };
const td: React.CSSProperties = { padding: "10px", borderBottom: "1px solid var(--border)", fontSize: 13, verticalAlign: "top" };
const label: React.CSSProperties = { fontSize: 11, color: "var(--muted)", fontWeight: 600, display: "block", marginBottom: 3 };
const input: React.CSSProperties = { width: "100%", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 8px", fontSize: 13, background: "var(--card)", color: "var(--ink)" };

// A live mm:ss counter for the current stage.
function Timer({ since, wait }: { since: number; wait: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const elapsed = now - since;
  const over = wait && elapsed > MAX_WAIT_MS;
  return (
    <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700, color: over ? "var(--red-text)" : wait ? "var(--amber-text)" : "var(--muted)" }}>
      {fmtElapsed(elapsed)}
    </span>
  );
}

function KpiCard({ label: l, value, tone }: { label: string; value: string | number; tone?: "good" | "bad" }) {
  const color = tone === "bad" ? "var(--red-text)" : tone === "good" ? "var(--green-text)" : "var(--ink)";
  return (
    <div style={{ ...card, padding: "12px 16px", flex: "1 1 130px", minWidth: 130 }}>
      <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>{l}</div>
      <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2, color }}>{value}</div>
    </div>
  );
}

function stageChip(row: BoardRow) {
  const meta = stageMeta(row.stage);
  if (row.stage === "done") return <Chip bg="var(--green-bg)" color="var(--green-text)">✓ {meta.label}</Chip>;
  if (isWaitStage(row.stage)) {
    const over = Date.now() - Date.parse(row.stageEnteredAt) > MAX_WAIT_MS;
    return over
      ? <Chip bg="var(--red-bg)" color="var(--red-text)">⏳ {meta.label}</Chip>
      : <Chip bg="var(--amber-bg)" color="var(--amber-text)">⏳ {meta.label}</Chip>;
  }
  if (row.stage === "front_desk") return <Chip bg="#eef2f7" color="#64748b">{meta.label}</Chip>;
  return <Chip bg="var(--brand-tint)" color="var(--brand-text)">{meta.label}</Chip>;
}

export default function LiveJourneyBoard({
  rows, kpis, canCoordinate,
}: {
  rows: BoardRow[];
  kpis: JourneyKpis;
  canCoordinate: boolean;
}) {
  const [handoverId, setHandoverId] = useState<string | null>(null);

  // `<form action>` wants a void-returning action; our server actions return
  // { ok, error } (kept for typing + unit tests), so wrap each to drop the value.
  const handoverAction = async (fd: FormData) => { await journeyHandover(fd); };
  const advanceAction = async (fd: FormData) => { await journeyAdvance(fd); };
  const notifyAction = async (fd: FormData) => { await journeyNotifyCoach(fd); };
  const cancelAction = async (fd: FormData) => { await journeyCancel(fd); };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* KPI strip */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <KpiCard label="In journey now" value={kpis.inJourney} />
        <KpiCard label="Avg transition wait" value={fmtElapsed(kpis.avgWaitMs)} tone={kpis.avgWaitMs > MAX_WAIT_MS ? "bad" : undefined} />
        <KpiCard label="Coach present ≤3 min" value={`${kpis.coachPresentPct}%`} tone={kpis.coachPresentPct >= 100 ? "good" : kpis.coachPresentPct < 80 ? "bad" : undefined} />
        <KpiCard label="Unattended > 3 min" value={kpis.breaches} tone={kpis.breaches ? "bad" : "good"} />
        <KpiCard label="Completed today" value={kpis.done} />
      </div>

      {/* Header. There is deliberately no "add" control: the board is a
          projection of work already logged in the CRM. A client joins it when a
          coached package is sold, and moves as consultations start and finish.
          Adding a second, manual registration path here is what let the board
          drift out of step with the client record. */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontSize: 12, color: "var(--muted)" }}>
          Front Desk → Health Coach → Fitness · Medical · Diet → Review → Front Desk · the coach returns within 3 minutes at every handover.
        </div>
      </div>

      {/* Board */}
      <div style={{ ...card, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>Walk-in</th>
              <th style={th}>Current stage</th>
              <th style={th}>With</th>
              <th style={th}>Timer</th>
              <th style={{ ...th, textAlign: "right" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td style={td} colSpan={5}><span style={{ color: "var(--muted)" }}>Nobody in the journey right now — clients appear here automatically when a Comprehensive, PT or BluePrint package is sold.</span></td></tr>
            )}
            {rows.map((r) => {
              const meta = stageMeta(r.stage);
              const withWhom = meta.owner === "Health Coach" ? (r.coachName ?? "Health Coach") : meta.owner;
              const assess = assessmentOf(r.stage);
              return (
                <tr key={r.id}>
                  <td style={td}>
                    <div style={{ fontWeight: 700 }}>{r.name}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>
                      {[r.goal, r.source].filter(Boolean).join(" · ")}
                      {r.concerns && r.concerns !== "—" ? <> · <span style={{ color: "var(--red-text)" }}>⚑ {r.concerns}</span></> : null}
                    </div>
                  </td>
                  <td style={td}>{stageChip(r)}</td>
                  <td style={td}><span style={{ fontSize: 12 }}>{withWhom}</span></td>
                  <td style={td}>
                    {r.stage === "front_desk" || r.stage === "done"
                      ? <span style={{ color: "var(--muted)" }}>—</span>
                      : <Timer since={Date.parse(r.stageEnteredAt)} wait={isWaitStage(r.stage)} />}
                  </td>
                  <td style={{ ...td, textAlign: "right" }}>
                    <div style={{ display: "inline-flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      {/* Professional intimation on any assessment stage */}
                      {assess && (r.notified
                        ? <Chip bg="var(--amber-bg)" color="var(--amber-text)">🔔 Coach notified</Chip>
                        : (
                          <form action={notifyAction}>
                            <input type="hidden" name="id" value={r.id} />
                            <input type="hidden" name="stage" value={r.stage} />
                            <SubmitButton style={btn} pendingLabel="…" doneLabel="🔔 Sent" persist>🔔 Notify coach</SubmitButton>
                          </form>
                        ))}

                      {/* Coordinator (coach / front desk) actions */}
                      {canCoordinate && r.stage === "front_desk" && (
                        <button style={btnPrimary} onClick={() => setHandoverId(handoverId === r.id ? null : r.id)}>
                          {handoverId === r.id ? "Close" : "Hand to Coach →"}
                        </button>
                      )}
                      {canCoordinate && r.stage !== "front_desk" && r.stage !== "done" && (
                        <form action={advanceAction}>
                          <input type="hidden" name="id" value={r.id} />
                          <SubmitButton style={btnPrimary} pendingLabel="…" doneLabel="✓">
                            {isWaitStage(r.stage) ? "✔ Coach arrived →" : r.stage === "review" ? "Complete → Front Desk" : r.stage === "briefing" ? "Escort to Fitness →" : "Complete →"}
                          </SubmitButton>
                        </form>
                      )}
                      {r.stage === "done" && <Chip bg="var(--green-bg)" color="var(--green-text)">✓ Handed back</Chip>}
                      {canCoordinate && r.stage !== "done" && (
                        <form action={cancelAction}>
                          <input type="hidden" name="id" value={r.id} />
                          <SubmitButton style={btn} pendingLabel="…" doneLabel="✓" title="Remove from board">✕</SubmitButton>
                        </form>
                      )}
                    </div>

                    {/* Inline handover panel */}
                    {handoverId === r.id && r.stage === "front_desk" && (
                      <form action={handoverAction} style={{ marginTop: 10, textAlign: "left", background: "var(--brand-tint)", border: "1px solid var(--border)", borderRadius: 10, padding: 12, display: "grid", gap: 8 }}>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>Handover to {r.coachName ?? "Health Coach"}</div>
                        <input type="hidden" name="id" value={r.id} />
                        <div><label style={label}>Primary goal</label><input style={input} name="goal" defaultValue={r.goal ?? ""} /></div>
                        <div><label style={label}>Source</label><input style={input} name="source" defaultValue={r.source ?? ""} /></div>
                        <div><label style={label}>Concerns / urgency</label><input style={input} name="concerns" defaultValue={r.concerns ?? ""} /></div>
                        <div style={{ fontSize: 11, color: "var(--muted)" }}>Shared to Fitness, Doctor &amp; Dietitian so the client never repeats their story.</div>
                        <div style={{ display: "flex", justifyContent: "flex-end" }}>
                          <SubmitButton style={btnPrimary}>Confirm handover</SubmitButton>
                        </div>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ fontSize: 12, color: "var(--muted)" }}>
        The Health Coach is the single point of contact. Professionals tap <b>🔔 Notify coach</b> before a session ends; the coach returns within <b>3 minutes</b> (the timer turns red past 3:00) and escorts the client to the next assessment.
      </div>
    </div>
  );
}
