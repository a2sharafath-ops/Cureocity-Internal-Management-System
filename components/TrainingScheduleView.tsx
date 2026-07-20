"use client";

import { useState } from "react";
import Link from "next/link";
import {
  setTrainerSlot, assignTrainerSlot, unassignTrainerSlot,
  createAssessment, markAssessmentBooked, completeAssessment, toggleAssessmentShared, addRecoverySession, completeRecoverySession,
} from "@/lib/actions";
import SegTabs from "@/components/SegTabs";

export type Trainer = { id: string; name: string; color: string };
export type Slot = { trainer_id: string; hour: number; status: string; client_id: string | null; clientName: string | null; tag: string | null };
export type AssessmentRow = { id: string; clientName: string | null; kind: string; due_date: string; status: string; scheduled_date?: string | null; shared?: boolean; trainerName: string | null };

function assessLabel(kind: string) { return kind === "reassessment" ? "Fitness Reassessment" : "Fitness Assessment"; }
export type RecoveryRow = { id: string; clientName: string | null; kind: string; date: string; hour: number | null; staffName: string | null; status: string };
export type ClassRow = { id: string; title: string; trainerName: string | null; date: string; hour: number; capacity: number; booked: number };

const TAGS = ["PT", "Initial Assessment", "Re-assessment"];
const TAG_STYLE: Record<string, [string, string]> = {
  "PT": ["var(--purple-bg)", "var(--purple-text)"], "Initial Assessment": ["var(--amber-bg)", "var(--amber-text)"], "Re-assessment": ["var(--blue-bg)", "var(--blue-text)"],
};
function hourLabel(h: number) { const am = h < 12; const hr = h % 12 === 0 ? 12 : h % 12; return `${hr} ${am ? "AM" : "PM"}`; }
function fmtDate(iso: string) { return new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" }); }

const input: React.CSSProperties = { padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, background: "#fff" };

export default function TrainingScheduleView({
  today, trainers, hours, slots, clients, staff, assessments, assessmentRecords, recovery, classes, canWrite,
}: {
  today: string; trainers: Trainer[]; hours: number[]; slots: Slot[]; clients: { id: string; name: string }[];
  staff: { id: string; name: string }[]; assessments: AssessmentRow[]; assessmentRecords: AssessmentRow[]; recovery: RecoveryRow[]; classes: ClassRow[]; canWrite: boolean;
}) {
  const [tab, setTab] = useState<"slots" | "studio" | "recovery">("slots");
  const [assigning, setAssigning] = useState<{ trainer_id: string; hour: number } | null>(null);
  const [manualAssign, setManualAssign] = useState(false);
  const [newAssess, setNewAssess] = useState(false);
  const [newRecovery, setNewRecovery] = useState(false);

  const slotMap = new Map(slots.map((s) => [`${s.trainer_id}|${s.hour}`, s]));
  const total = trainers.length * hours.length;
  const assigned = slots.filter((s) => s.client_id).length;
  const available = slots.filter((s) => s.status === "available" && !s.client_id).length;
  const unavailable = total - assigned - available;

  const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
  const tagChip = (tag: string | null) => {
    const [bg, fg] = TAG_STYLE[tag ?? "PT"] ?? ["var(--neutral-bg)", "#64748b"];
    return <span style={{ background: bg, color: fg, borderRadius: 999, padding: "1px 7px", fontSize: 10, fontWeight: 600 }}>{tag ?? "PT"}</span>;
  };

  const countBadge = (n: number) => <span style={{ background: "var(--amber-bg)", color: "var(--amber-text)", borderRadius: 999, minWidth: 20, textAlign: "center", padding: "1px 7px", fontSize: 12, fontWeight: 700 }}>{n}</span>;

  // Assessments-due status badge (Due today / Overdue / Upcoming / Booked).
  const dueBadge = (a: AssessmentRow) => {
    if (a.status === "booked") return <span style={{ background: "var(--blue-bg)", color: "var(--blue-text)", borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>Booked</span>;
    if (a.due_date === today) return <span style={{ background: "var(--red-bg)", color: "var(--red-text)", borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>Due today</span>;
    if (a.due_date < today) return <span style={{ background: "var(--red-bg)", color: "var(--red-text)", borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>Overdue</span>;
    return <span style={{ background: "var(--neutral-bg)", color: "var(--muted)", borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>Upcoming</span>;
  };
  const th: React.CSSProperties = { textAlign: "left", padding: "10px 14px", color: "var(--muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: ".4px" };
  const td: React.CSSProperties = { padding: "11px 14px", fontSize: 13 };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <SegTabs active={tab} onSelect={(k) => setTab(k as typeof tab)} items={[
          { key: "slots", label: "🏋 Slots & Assessments" },
          { key: "studio", label: "🧘 Group Studio" },
          { key: "recovery", label: "💆 Recovery" },
        ]} />
        <span style={{ flex: 1 }} />
        {canWrite && <button type="button" onClick={() => { setTab("slots"); setNewAssess(true); }} style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "8px 13px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ New Assessment</button>}
        {canWrite && <button type="button" onClick={() => { setTab("slots"); setManualAssign(true); }} style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 13px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ Assign client</button>}
      </div>

      {/* ================= SLOTS & ASSESSMENTS ================= */}
      {tab === "slots" && (
        <>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>📝 Weekly trainer schedule</div>
            <span style={{ color: "var(--muted)", fontSize: 12 }}>1:1 PT &amp; fitness assessments · click a cell to assign / set availability</span>
          </div>
          <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 10px" }}>
            Personal-training and fitness-assessment sessions — which client is with which trainer, at what hour. Recurring weekly.
          </p>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
            {trainers.map((t) => <span key={t.id} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--muted)" }}><span style={{ width: 10, height: 10, borderRadius: "50%", background: t.color }} />{t.name}</span>)}
            <span style={{ width: 1, height: 18, background: "var(--border)" }} />
            {TAGS.map((t) => <span key={t}>{tagChip(t)}</span>)}
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <span style={{ background: "var(--neutral-bg)", borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>{assigned} assigned</span>
            <span style={{ background: "var(--green-bg)", color: "var(--green-text)", borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>{available} available</span>
            <span style={{ background: "#f1f5f9", color: "#64748b", borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>{unavailable} unavailable</span>
            <span style={{ color: "var(--muted)", fontSize: 12, alignSelf: "center" }}>Name + tag = assigned · dashed + Assign = available · grey = unavailable</span>
          </div>

          {/* assign bar */}
          {assigning && (
            <form action={assignTrainerSlot} onSubmit={() => setTimeout(() => setAssigning(null), 50)} style={{ ...box, padding: 12, marginBottom: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <input type="hidden" name="trainer_id" value={assigning.trainer_id} />
              <input type="hidden" name="hour" value={assigning.hour} />
              <b style={{ fontSize: 13 }}>{trainers.find((t) => t.id === assigning.trainer_id)?.name} · {hourLabel(assigning.hour)}</b>
              <select name="client_id" required defaultValue="" style={input}><option value="" disabled>Client…</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              <select name="tag" defaultValue="PT" style={input}>{TAGS.map((t) => <option key={t}>{t}</option>)}</select>
              <button type="submit" style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Assign</button>
              <button type="button" onClick={() => setAssigning(null)} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", fontSize: 13, cursor: "pointer" }}>Cancel</button>
            </form>
          )}

          {/* manual assign (from + Assign client) — pick trainer + time + client */}
          {manualAssign && (
            <form action={assignTrainerSlot} onSubmit={() => setTimeout(() => setManualAssign(false), 50)} style={{ ...box, padding: 12, marginBottom: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <b style={{ fontSize: 13 }}>Assign client</b>
              <select name="trainer_id" required defaultValue="" style={input}><option value="" disabled>Trainer…</option>{trainers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
              <select name="hour" defaultValue="9" style={input}>{hours.map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}</select>
              <select name="client_id" required defaultValue="" style={input}><option value="" disabled>Client…</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              <select name="tag" defaultValue="PT" style={input}>{TAGS.map((t) => <option key={t}>{t}</option>)}</select>
              <button type="submit" style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Assign</button>
              <button type="button" onClick={() => setManualAssign(false)} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", fontSize: 13, cursor: "pointer" }}>Cancel</button>
            </form>
          )}

          <div style={{ ...box, overflow: "auto", marginBottom: 18 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 780 }}>
              <thead>
                <tr>
                  <th style={{ width: 60, padding: "10px 8px", borderBottom: "1px solid var(--border)" }} />
                  {trainers.map((t) => <th key={t.id} style={{ padding: "10px 8px", borderBottom: "1px solid var(--border)", borderLeft: "1px solid var(--border)", textAlign: "center", fontSize: 13 }}>{t.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {hours.map((h) => (
                  <tr key={h}>
                    <td style={{ padding: "6px 8px", color: "var(--muted)", fontSize: 12, textAlign: "right", borderTop: "1px solid var(--border)" }}>{hourLabel(h)}</td>
                    {trainers.map((t) => {
                      const s = slotMap.get(`${t.id}|${h}`);
                      const assignedCell = s?.client_id;
                      const openCell = s?.status === "available" && !s?.client_id;
                      return (
                        <td key={t.id} style={{ borderTop: "1px solid var(--border)", borderLeft: "1px solid var(--border)", padding: 5, height: 46, textAlign: "center", background: assignedCell ? t.color + "12" : "transparent" }}>
                          {assignedCell ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "center" }}>
                              <span style={{ fontSize: 12, fontWeight: 600 }}>{s?.clientName ?? "—"}</span>
                              {tagChip(s?.tag ?? null)}
                              {canWrite && <form action={unassignTrainerSlot}><input type="hidden" name="trainer_id" value={t.id} /><input type="hidden" name="hour" value={h} /><button style={{ border: "none", background: "transparent", color: "var(--muted)", fontSize: 10, cursor: "pointer" }}>✕ clear</button></form>}
                            </div>
                          ) : openCell ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: "center" }}>
                              <button type="button" disabled={!canWrite} onClick={() => setAssigning({ trainer_id: t.id, hour: h })} style={{ border: "1px dashed var(--brand-fill)", background: "#fff", color: "var(--brand-text)", borderRadius: 8, padding: "4px 10px", fontSize: 12, fontWeight: 600, cursor: canWrite ? "pointer" : "default" }}>+ Assign</button>
                              {canWrite && <form action={setTrainerSlot}><input type="hidden" name="trainer_id" value={t.id} /><input type="hidden" name="hour" value={h} /><input type="hidden" name="status" value="unavailable" /><button style={{ border: "none", background: "transparent", color: "var(--muted)", fontSize: 10, cursor: "pointer" }}>set unavailable</button></form>}
                            </div>
                          ) : (
                            canWrite ? (
                              <form action={setTrainerSlot}><input type="hidden" name="trainer_id" value={t.id} /><input type="hidden" name="hour" value={h} /><input type="hidden" name="status" value="available" /><button style={{ border: "none", background: "transparent", color: "#94a3b8", fontSize: 12, cursor: "pointer", width: "100%" }}>Unavailable</button></form>
                            ) : <span style={{ color: "#94a3b8", fontSize: 12 }}>Unavailable</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Assessments due */}
          <div style={{ ...box, padding: "16px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <div style={{ fontWeight: 700 }}>📋 Assessments due</div>
              {countBadge(assessments.length)}
              <span style={{ flex: 1 }} />
              {canWrite && <button type="button" onClick={() => setNewAssess((v) => !v)} style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>{newAssess ? "Cancel" : "+ New Assessment"}</button>}
            </div>
            <p style={{ color: "var(--muted)", fontSize: 12, margin: "0 0 10px" }}>Fitness assessments &amp; re-assessments coming up per each client&apos;s service schedule — book them into the Appointment Calendar.</p>
            {newAssess && (
              <form action={createAssessment} onSubmit={() => setTimeout(() => setNewAssess(false), 50)} style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                <select name="client_id" required defaultValue="" style={input}><option value="" disabled>Client…</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                <select name="trainer_id" defaultValue="" style={input}><option value="">— trainer —</option>{trainers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
                <select name="kind" defaultValue="initial" style={input}><option value="initial">Fitness Assessment</option><option value="reassessment">Fitness Reassessment</option></select>
                <input type="date" name="due_date" defaultValue={today} style={input} />
                <button type="submit" style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Add</button>
              </form>
            )}
            <div style={{ overflow: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
                <thead><tr><th style={th}>Client</th><th style={th}>Assessment</th><th style={th}>Target date</th><th style={th}>Status</th><th style={th} /></tr></thead>
                <tbody>
                  {assessments.map((a) => (
                    <tr key={a.id} style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={{ ...td, fontWeight: 700 }}>{a.clientName ?? "—"}</td>
                      <td style={td}>{assessLabel(a.kind)}{a.trainerName ? <span style={{ color: "var(--muted)" }}> · {a.trainerName}</span> : ""}</td>
                      <td style={td}>{fmtDate(a.due_date)}</td>
                      <td style={td}>{dueBadge(a)}</td>
                      <td style={{ ...td, textAlign: "right" }}>
                        {a.status === "booked" ? (
                          canWrite && <form action={completeAssessment}><input type="hidden" name="id" value={a.id} /><button style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "5px 10px", fontSize: 12, cursor: "pointer" }}>Mark done</button></form>
                        ) : (
                          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                            <Link href="/appointments" style={{ background: "var(--ink)", color: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 12, textDecoration: "none", fontWeight: 600 }}>Book</Link>
                            {canWrite && <form action={markAssessmentBooked}><input type="hidden" name="id" value={a.id} /><button style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "5px 10px", fontSize: 12, cursor: "pointer" }}>Mark booked</button></form>}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {assessments.length === 0 && <tr><td colSpan={5} style={{ ...td, textAlign: "center", color: "var(--muted)" }}>No assessments due.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent assessment records */}
          <div style={{ ...box, padding: "16px 18px", marginTop: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <div style={{ fontWeight: 700 }}>🗂 Recent assessment records</div>
              {countBadge(assessmentRecords.length)}
            </div>
            <div style={{ overflow: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
                <thead><tr><th style={th}>Client</th><th style={th}>Assessment</th><th style={th}>Professional</th><th style={th}>Date</th><th style={th}>Visibility</th></tr></thead>
                <tbody>
                  {assessmentRecords.map((a) => (
                    <tr key={a.id} style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={{ ...td, fontWeight: 700 }}>{a.clientName ?? "—"}</td>
                      <td style={td}>{assessLabel(a.kind)}</td>
                      <td style={td}>{a.trainerName ?? "—"}</td>
                      <td style={td}>{a.scheduled_date ? fmtDate(a.scheduled_date) : fmtDate(a.due_date)}</td>
                      <td style={td}>
                        {canWrite ? (
                          <form action={toggleAssessmentShared}>
                            <input type="hidden" name="id" value={a.id} /><input type="hidden" name="shared" value={String(!!a.shared)} />
                            <button style={{ border: "1px solid var(--border)", background: a.shared ? "var(--green-bg)" : "#fff", color: a.shared ? "var(--green-text)" : "var(--muted)", borderRadius: 999, padding: "3px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>{a.shared ? "🔓 Shared" : "🔒 Private"}</button>
                          </form>
                        ) : <span style={{ color: "var(--muted)", fontSize: 12 }}>{a.shared ? "Shared" : "Private"}</span>}
                      </td>
                    </tr>
                  ))}
                  {assessmentRecords.length === 0 && <tr><td colSpan={5} style={{ ...td, textAlign: "center", color: "var(--muted)" }}>No assessment records yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ================= GROUP STUDIO ================= */}
      {tab === "studio" && (
        <div style={{ ...box, padding: "16px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontWeight: 700 }}>🧘 Group Studio</div>
            <span style={{ flex: 1 }} />
            <Link href="/classes" style={{ background: "var(--ink)", color: "#fff", borderRadius: 8, padding: "7px 12px", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>Manage classes →</Link>
          </div>
          <p style={{ color: "var(--muted)", fontSize: 12, margin: "0 0 10px" }}>Group classes &amp; studio bookings (yoga, HIIT, mobility). Full scheduling on the Group Classes page.</p>
          {classes.length === 0 ? <div style={{ color: "var(--muted)", fontSize: 13 }}>No upcoming classes.</div> : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead><tr style={{ color: "var(--muted)", fontSize: 12, textAlign: "left" }}><th style={{ padding: "8px 6px" }}>Class</th><th style={{ padding: "8px 6px" }}>Trainer</th><th style={{ padding: "8px 6px" }}>Date</th><th style={{ padding: "8px 6px" }}>Time</th><th style={{ padding: "8px 6px" }}>Booked</th></tr></thead>
              <tbody>
                {classes.map((c) => (
                  <tr key={c.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "8px 6px", fontWeight: 600 }}>{c.title}</td>
                    <td style={{ padding: "8px 6px", color: "var(--muted)" }}>{c.trainerName ?? "—"}</td>
                    <td style={{ padding: "8px 6px" }}>{fmtDate(c.date)}</td>
                    <td style={{ padding: "8px 6px" }}>{hourLabel(c.hour)}</td>
                    <td style={{ padding: "8px 6px" }}><span style={{ color: c.booked >= c.capacity ? "var(--red-text)" : "var(--muted)" }}>{c.booked}/{c.capacity}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ================= RECOVERY ================= */}
      {tab === "recovery" && (
        <div style={{ ...box, padding: "16px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontWeight: 700 }}>💆 Recovery</div>
            <span style={{ flex: 1 }} />
            {canWrite && <button type="button" onClick={() => setNewRecovery((v) => !v)} style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>{newRecovery ? "Cancel" : "+ Book recovery"}</button>}
          </div>
          <p style={{ color: "var(--muted)", fontSize: 12, margin: "0 0 10px" }}>Physio, mobility, sauna &amp; ice-bath recovery bookings.</p>
          {newRecovery && (
            <form action={addRecoverySession} onSubmit={() => setTimeout(() => setNewRecovery(false), 50)} style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              <select name="client_id" required defaultValue="" style={input}><option value="" disabled>Client…</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              <select name="kind" defaultValue="Physio" style={input}><option>Physio</option><option>Mobility</option><option>Sauna</option><option>Ice bath</option><option>Massage</option></select>
              <select name="staff_id" defaultValue="" style={input}><option value="">— staff —</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
              <input type="date" name="date" defaultValue={today} style={input} />
              <select name="hour" defaultValue="10" style={input}>{hours.map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}</select>
              <button type="submit" style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Add</button>
            </form>
          )}
          {recovery.length === 0 ? <div style={{ color: "var(--muted)", fontSize: 13 }}>No recovery sessions booked.</div> : recovery.map((r) => (
            <div key={r.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 0", borderTop: "1px solid var(--border)", fontSize: 13 }}>
              <span style={{ background: "var(--brand-tint)", color: "var(--brand-text)", borderRadius: 999, padding: "2px 9px", fontSize: 11, fontWeight: 600 }}>{r.kind}</span>
              <b>{r.clientName ?? "—"}</b>
              <span style={{ color: "var(--muted)" }}>{fmtDate(r.date)}{r.hour != null ? ` · ${hourLabel(r.hour)}` : ""}{r.staffName ? ` · ${r.staffName}` : ""}</span>
              <span style={{ flex: 1 }} />
              {r.status === "completed" ? <span style={{ background: "var(--green-bg)", color: "var(--green-text)", borderRadius: 999, padding: "2px 9px", fontSize: 11, fontWeight: 600 }}>completed</span> : (canWrite && <form action={completeRecoverySession}><input type="hidden" name="id" value={r.id} /><button style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "5px 10px", fontSize: 12, cursor: "pointer" }}>Mark done</button></form>)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
