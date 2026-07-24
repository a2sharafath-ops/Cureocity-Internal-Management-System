"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { saveConsultSession, addVitals, createOrder, createPrescription } from "@/lib/actions";

type Flag = { text: string; severity: string };

const SEVERITY: Record<string, { bg: string; fg: string; label: string }> = {
  critical: { bg: "var(--red-bg)", fg: "var(--red-text)", label: "Critical" },
  warning: { bg: "var(--amber-bg)", fg: "var(--amber-text)", label: "Warning" },
  info: { bg: "var(--blue-bg, #e0f2fe)", fg: "var(--blue-text, #0369a1)", label: "Note" },
};

export default function ConsoleView({
  id, kind, label, icon, client, questions, answers, flags, summary, status, canTools,
}: {
  id: string;
  kind: string;
  label: string;
  icon: string;
  client: { id: string; name: string; code: string | null };
  questions: string[];
  answers: [string, string][];
  flags: Flag[];
  summary: string | null;
  status: string;
  canTools: boolean;
}) {
  const [sec, setSec] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const mm = String(Math.floor(sec / 60)).padStart(2, "0");
  const ss = String(sec % 60).padStart(2, "0");

  const amap = new Map(answers.map(([q, a]) => [q, a]));
  // Controlled answers → live unfilled tracker.
  const [ans, setAns] = useState<string[]>(questions.map((q) => amap.get(q) ?? ""));
  const filled = ans.filter((a) => a.trim()).length;
  const unfilled = questions.map((q, i) => ({ q, i })).filter(({ i }) => !ans[i]?.trim());

  // Flags raised in-session.
  const [fl, setFl] = useState<Flag[]>(flags ?? []);
  const [fText, setFText] = useState("");
  const [fSev, setFSev] = useState("warning");
  const addFlag = () => { const t = fText.trim(); if (!t) return; setFl((x) => [...x, { text: t, severity: fSev }]); setFText(""); };

  // Quick prescription (single drug) — Doctor tool.
  const [rx, setRx] = useState({ drug: "", dose: "", frequency: "", duration: "" });

  const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
  const inp: React.CSSProperties = { border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", fontSize: 13, background: "#fff", width: "100%", boxSizing: "border-box", resize: "vertical" };
  const sm: React.CSSProperties = { ...inp, padding: "6px 8px", fontSize: 12.5 };
  const toolBtn: React.CSSProperties = { background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "7px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" };

  return (
    <div style={{ maxWidth: 1120 }}>
      {/* Console chrome */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <Link href="/pro" style={{ color: "var(--brand-text)", textDecoration: "none", fontSize: 13, fontWeight: 600 }}>← Consultations</Link>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--ink)", color: "#fff", display: "grid", placeItems: "center", fontSize: 20 }}>{icon}</div>
        <div>
          <h1 style={{ fontSize: 19, margin: 0 }}>{label}</h1>
          <div style={{ color: "var(--muted)", fontSize: 12.5 }}>{client.name}{client.code ? ` · ${client.code}` : ""} · {kind} consultation</div>
        </div>
        <span style={{ flex: 1 }} />
        {status === "completed" && <span style={{ background: "var(--green-bg)", color: "var(--green-text)", borderRadius: 999, padding: "4px 12px", fontSize: 12, fontWeight: 700 }}>✓ Completed</span>}
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "var(--ink)", color: "#fff", borderRadius: 10, padding: "8px 14px" }}>
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--red)", display: "inline-block" }} />
          <b style={{ fontVariantNumeric: "tabular-nums", fontSize: 14 }}>{mm}:{ss}</b>
        </div>
      </div>

      {/* Ambient + AI co-pilot panel — scaffold; wire a real STT + LLM here later. */}
      <div style={{ ...box, padding: "14px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", background: "linear-gradient(180deg, #14141a, #23232c)", color: "#fff", border: "none" }}>
        <div style={{ width: 120, height: 74, borderRadius: 10, background: "#000", display: "grid", placeItems: "center", fontSize: 26 }}>🎥</div>
        <div style={{ minWidth: 0 }}>
          <b style={{ fontSize: 14 }}>Live session with {client.name}</b>
          <div style={{ fontSize: 12, opacity: 0.7 }}>🎙️ Ambient scribe · 🤖 AI co-pilot</div>
        </div>
        <span style={{ flex: 1 }} />
        <button type="button" disabled title="Connect an ambient recorder + AI scribe to enable" style={{ background: "rgba(255,255,255,.12)", color: "rgba(255,255,255,.7)", border: "none", borderRadius: 999, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "not-allowed" }}>✨ Auto-fill from ambient (soon)</button>
        <span style={{ background: "rgba(255,255,255,.12)", borderRadius: 999, padding: "4px 12px", fontSize: 12, fontWeight: 600 }}>Recording (simulated)</span>
      </div>

      <form action={saveConsultSession} style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16, alignItems: "start" }}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="duration_min" value={Math.max(1, Math.round(sec / 60))} />
        <input type="hidden" name="flags" value={JSON.stringify(fl)} />

        {/* Intake questionnaire + unfilled tracker */}
        <div style={{ ...box, padding: "16px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <div style={{ fontWeight: 700 }}>{icon} Intake questionnaire</div>
            <span style={{ flex: 1 }} />
            <span style={{ background: filled === questions.length ? "var(--green-bg)" : "var(--amber-bg)", color: filled === questions.length ? "var(--green-text)" : "var(--amber-text)", borderRadius: 999, padding: "2px 10px", fontSize: 11.5, fontWeight: 700 }}>
              {filled}/{questions.length} answered
            </span>
          </div>
          {unfilled.length > 0 && (
            <div style={{ fontSize: 12, color: "var(--amber-text)", background: "var(--amber-bg)", borderRadius: 8, padding: "7px 10px", marginBottom: 10 }}>
              {unfilled.length} unfilled: {unfilled.map(({ i }) => `Q${i + 1}`).join(", ")}
            </div>
          )}
          {questions.map((q, i) => {
            const empty = !ans[i]?.trim();
            return (
              <div key={i} style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 4 }}>{i + 1}. {q}{empty && <span style={{ color: "var(--amber-text)" }}> ·  unfilled</span>}</label>
                <textarea name={`a_${i}`} rows={2} value={ans[i]} onChange={(e) => setAns((p) => { const n = [...p]; n[i] = e.target.value; return n; })}
                  style={{ ...inp, borderColor: empty ? "var(--amber-text)" : "var(--border)" }} />
              </div>
            );
          })}
        </div>

        {/* Summary + flags + save */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, position: "sticky", top: 12 }}>
          {/* Medical flags */}
          <div style={{ ...box, padding: "16px 18px" }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>🚩 Flags raised {fl.length > 0 && <span style={{ color: "var(--red-text)" }}>· {fl.length}</span>}</div>
            {fl.length === 0 && <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>No flags. Add anything clinically notable.</div>}
            <div style={{ display: "grid", gap: 6, marginBottom: 10 }}>
              {fl.map((f, i) => {
                const s = SEVERITY[f.severity] ?? SEVERITY.info;
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, background: s.bg, borderRadius: 8, padding: "6px 10px" }}>
                    <span style={{ color: s.fg, fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", flexShrink: 0 }}>{s.label}</span>
                    <span style={{ flex: 1, fontSize: 12.5 }}>{f.text}</span>
                    <button type="button" onClick={() => setFl((x) => x.filter((_, j) => j !== i))} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--muted)", fontSize: 13 }} title="Remove">✕</button>
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <input value={fText} onChange={(e) => setFText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addFlag(); } }} placeholder="e.g. BP 160/100 — refer" style={sm} />
              <select value={fSev} onChange={(e) => setFSev(e.target.value)} style={{ ...sm, width: 100 }}><option value="critical">Critical</option><option value="warning">Warning</option><option value="info">Note</option></select>
              <button type="button" onClick={addFlag} style={{ ...toolBtn, padding: "6px 12px" }}>Add</button>
            </div>
          </div>

          <div style={{ ...box, padding: "16px 18px" }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>📝 Consultation summary</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>This becomes the shareable summary that feeds the Blueprint sign-off.</div>
            <textarea name="summary" rows={10} defaultValue={summary ?? ""} placeholder="Session notes, findings, plan…" style={inp} />
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <button type="submit" name="complete" value="false" style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "9px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Save draft</button>
              <button type="submit" name="complete" value="true" style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>✓ Complete &amp; summarize</button>
            </div>
          </div>
          <div style={{ ...box, padding: "12px 16px" }}>
            <Link href={`/clients/${client.id}`} style={{ color: "var(--brand-text)", textDecoration: "none", fontSize: 13, fontWeight: 600 }}>📋 Open full client card →</Link>
          </div>
        </div>
      </form>

      {/* Session tools — Doctor console only (vitals / labs / prescriptions). These
          are separate forms; submitting one keeps the questionnaire in place. */}
      {canTools && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>🧰 Session tools</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {/* Vitals */}
            <form action={addVitals} style={{ ...box, padding: "14px 16px" }}>
              <input type="hidden" name="client_id" value={client.id} />
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>❤️ Record vitals</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 8 }}>
                <input name="systolic" placeholder="Systolic" inputMode="numeric" style={sm} />
                <input name="diastolic" placeholder="Diastolic" inputMode="numeric" style={sm} />
                <input name="pulse" placeholder="Pulse" inputMode="numeric" style={sm} />
                <input name="spo2" placeholder="SpO₂ %" inputMode="numeric" style={sm} />
                <input name="temp_c" placeholder="Temp °C" inputMode="decimal" style={sm} />
                <input name="weight" placeholder="Weight kg" inputMode="decimal" style={sm} />
              </div>
              <button type="submit" style={toolBtn}>Save vitals</button>
            </form>

            {/* Lab order */}
            <form action={createOrder} style={{ ...box, padding: "14px 16px" }}>
              <input type="hidden" name="client_id" value={client.id} />
              <input type="hidden" name="category" value="lab" />
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>🧪 Order lab test</div>
              <input name="test" placeholder="e.g. Lipid profile, HbA1c" required style={{ ...sm, marginBottom: 6 }} />
              <select name="priority" defaultValue="routine" style={{ ...sm, marginBottom: 8 }}><option value="routine">Routine</option><option value="urgent">Urgent</option><option value="stat">STAT</option></select>
              <button type="submit" style={toolBtn}>Place order</button>
            </form>

            {/* Quick prescription */}
            <form action={createPrescription} style={{ ...box, padding: "14px 16px" }}>
              <input type="hidden" name="client_id" value={client.id} />
              <input type="hidden" name="status" value="signed" />
              <input type="hidden" name="items" value={JSON.stringify(rx.drug.trim() ? [rx] : [])} />
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>💊 Prescription</div>
              <input value={rx.drug} onChange={(e) => setRx({ ...rx, drug: e.target.value })} placeholder="Drug" style={{ ...sm, marginBottom: 6 }} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 8 }}>
                <input value={rx.dose} onChange={(e) => setRx({ ...rx, dose: e.target.value })} placeholder="Dose" style={sm} />
                <input value={rx.frequency} onChange={(e) => setRx({ ...rx, frequency: e.target.value })} placeholder="Frequency" style={sm} />
                <input value={rx.duration} onChange={(e) => setRx({ ...rx, duration: e.target.value })} placeholder="Duration" style={{ ...sm, gridColumn: "1 / span 2" }} />
              </div>
              <button type="submit" disabled={!rx.drug.trim()} style={{ ...toolBtn, opacity: rx.drug.trim() ? 1 : 0.5, cursor: rx.drug.trim() ? "pointer" : "not-allowed" }}>Sign &amp; add</button>
              <Link href={`/emr/${client.id}`} style={{ display: "block", marginTop: 8, fontSize: 11.5, color: "var(--brand-text)", textDecoration: "none" }}>Full prescription in EMR →</Link>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
