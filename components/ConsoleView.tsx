"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { saveConsultSession, addVitals, createOrder, createPrescription, aiInbodySummary, saveMeasurementSummary, aiConsultSummary } from "@/lib/actions";
import FileUploadForm from "@/components/FileUploadForm";
import SummaryEditor from "@/components/SummaryEditor";

type Flag = { text: string; severity: string };

export type ConsoleHealth = {
  age: number | null; gender: string | null; height: number | null; weight: number | null;
  bmi: number | null; bodyFat: number | null; muscle: number | null; visceral: number | null;
  waist: number | null; hip: number | null; measuredOn: string | null;
  inbodySummary: string | null; inbodyPdfUrl: string | null;
  conditions: string | null; goals: string[]; allergies: string[]; bloodStatus: string | null;
};

const SEVERITY: Record<string, { bg: string; fg: string; label: string }> = {
  critical: { bg: "var(--red-bg)", fg: "var(--red-text)", label: "Critical" },
  warning: { bg: "var(--amber-bg)", fg: "var(--amber-text)", label: "Warning" },
  info: { bg: "var(--blue-bg, #e0f2fe)", fg: "var(--blue-text, #0369a1)", label: "Note" },
};

export default function ConsoleView({
  id, kind, label, icon, client, questions, answers, flags, summary, status, canTools, health,
}: {
  id: string;
  kind: string;
  label: string;
  icon: string;
  client: { id: string; name: string; code: string | null; isLead?: boolean };
  questions: string[];
  answers: [string, string][];
  flags: Flag[];
  summary: string | null;
  status: string;
  canTools: boolean;
  health?: ConsoleHealth;
}) {
  // Ambient scribe / AI co-pilot is opt-in: the clock only runs while recording,
  // so the duration reflects real session time, not the tab being left open.
  const [recording, setRecording] = useState(false);
  const [sec, setSec] = useState(0);
  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);
  const mm = String(Math.floor(sec / 60)).padStart(2, "0");
  const ss = String(sec % 60).padStart(2, "0");

  const amap = new Map(answers.map(([q, a]) => [q, a]));
  // Controlled answers → live unfilled tracker.
  const [ans, setAns] = useState<string[]>(questions.map((q) => amap.get(q) ?? ""));
  const filled = ans.filter((a) => a.trim()).length;

  // Flags raised in-session.
  const [fl, setFl] = useState<Flag[]>(flags ?? []);
  const [fText, setFText] = useState("");
  const [fSev, setFSev] = useState("warning");
  const addFlag = () => { const t = fText.trim(); if (!t) return; setFl((x) => [...x, { text: t, severity: fSev }]); setFText(""); };

  // Quick prescription (single drug) — Doctor tool.
  const [rx, setRx] = useState({ drug: "", dose: "", frequency: "", duration: "" });

  // Consultation summary — one field, optionally AI-drafted. This same text is
  // what "Save draft" / "Complete & summarize" submit (name="summary"), so there
  // is a single source of truth for the shareable summary.
  const [summaryText, setSummaryText] = useState(summary ?? "");
  const [aiBusy, startAi] = useTransition();
  const [aiMsg, setAiMsg] = useState<string | null>(null);
  const generateSummary = () => {
    if (client.isLead) return;
    setAiMsg(null);
    startAi(async () => {
      const fd = new FormData();
      fd.set("client_id", client.id);
      const r = await aiConsultSummary({}, fd);
      if (r.error) setAiMsg(r.error);
      else { setSummaryText(r.text ?? ""); setAiMsg("Drafted — review and edit, then Complete & summarize."); }
    });
  };

  // Questionnaire completion → reveals a Word export + a copy-paste summary.
  const [qDone, setQDone] = useState(false);
  const [copied, setCopied] = useState(false);
  const answeredQA = questions.map((q, i) => ({ q, a: (ans[i] ?? "").trim() })).filter((x) => x.a);
  const qHeader = `${label || `${kind} consultation`} — ${client.name}${client.code ? ` (${client.code})` : ""}`;
  const qDate = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const qSummaryText = `${qHeader}\n${qDate}\n\n${answeredQA.map((x, idx) => `${idx + 1}. ${x.q}\n${x.a}`).join("\n\n")}`;

  const copyQSummary = async () => {
    try { await navigator.clipboard.writeText(qSummaryText); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* clipboard blocked */ }
  };

  const downloadWord = () => {
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const body = answeredQA
      .map((x, idx) => `<p style="margin:0 0 3px;font-weight:bold">${idx + 1}. ${esc(x.q)}</p><p style="margin:0 0 12px">${esc(x.a).replace(/\n/g, "<br/>")}</p>`)
      .join("");
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"></head>`
      + `<body style="font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#14141a">`
      + `<h2 style="margin:0 0 2px">${esc(label || `${kind} consultation`)}</h2>`
      + `<p style="margin:0 0 2px;color:#555">${esc(client.name)}${client.code ? ` · ${esc(client.code)}` : ""}</p>`
      + `<p style="margin:0 0 14px;color:#555">${qDate}</p>`
      + body + `</body></html>`;
    const blob = new Blob(["﻿", html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `Questionnaire - ${client.name}.doc`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
  const inp: React.CSSProperties = { border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", fontSize: 13, background: "#fff", width: "100%", boxSizing: "border-box", resize: "vertical" };
  const sm: React.CSSProperties = { ...inp, padding: "6px 8px", fontSize: 12.5 };
  const toolBtn: React.CSSProperties = { background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "7px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" };

  return (
    <div style={{ maxWidth: 1120 }}>
      {/* Console chrome — back link on its own row, then a clean title row with
          status + timer aligned to the right. */}
      <div style={{ marginBottom: 16 }}>
        <Link href="/pro" style={{ display: "inline-block", color: "var(--brand-text)", textDecoration: "none", fontSize: 13, fontWeight: 600, marginBottom: 10 }}>← Consultations</Link>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontSize: 19, margin: 0, lineHeight: 1.2 }}>{label}</h1>
            <div style={{ color: "var(--muted)", fontSize: 12.5, marginTop: 2 }}>{client.name}{client.code ? ` · ${client.code}` : ""} · {kind} consultation</div>
          </div>
          <span style={{ flex: 1 }} />
          {status === "completed" && <span style={{ background: "var(--green-bg)", color: "var(--green-text)", borderRadius: 999, padding: "4px 12px", fontSize: 12, fontWeight: 700 }}>✓ Completed</span>}
          {(recording || sec > 0) && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "var(--ink)", color: "#fff", borderRadius: 10, padding: "8px 14px", opacity: recording ? 1 : 0.55 }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: recording ? "var(--red)" : "rgba(255,255,255,.5)", display: "inline-block" }} />
              <b style={{ fontVariantNumeric: "tabular-nums", fontSize: 14 }}>{mm}:{ss}</b>
            </div>
          )}
        </div>
      </div>

      {/* Ambient + AI co-pilot — optional; the clinician starts/stops it. Scaffold
          for a real STT + LLM; nothing records until they press Start. */}
      <div style={{ ...box, padding: "14px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", background: "linear-gradient(180deg, #14141a, #23232c)", color: "#fff", border: "none" }}>
        <div style={{ minWidth: 0 }}>
          <b style={{ fontSize: 14 }}>Ambient scribe · AI co-pilot <span style={{ fontWeight: 400, opacity: 0.6 }}>· optional</span></b>
          <div style={{ fontSize: 12, opacity: 0.7 }}>{recording ? `Recording ${client.name}… (simulated)` : "Off — start to capture this session"}</div>
        </div>
        <span style={{ flex: 1 }} />
        <button type="button" disabled={!recording} title="Connect an ambient recorder + AI scribe to enable" style={{ background: "rgba(255,255,255,.12)", color: "rgba(255,255,255,.6)", border: "none", borderRadius: 999, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: recording ? "not-allowed" : "not-allowed", opacity: recording ? 1 : 0.5 }}>Auto-fill from ambient (soon)</button>
        {recording ? (
          <button type="button" onClick={() => setRecording(false)} style={{ background: "#fff", color: "#14141a", border: "none", borderRadius: 999, padding: "6px 16px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>■ Stop</button>
        ) : (
          <button type="button" onClick={() => setRecording(true)} style={{ background: "var(--red)", color: "#fff", border: "none", borderRadius: 999, padding: "6px 16px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>● Start recording</button>
        )}
      </div>

      {/* Client context — full width so the metrics and InBody read clearly and
          sit above the working area, visible to every discipline. */}
      {health && (() => {
        const metric = (label: string, val: string | number | null | undefined, unit = "") =>
          val != null && val !== "" ? <div key={label}><div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".3px" }}>{label}</div><div style={{ fontSize: 14, fontWeight: 700 }}>{val}{unit}</div></div> : null;
        const metrics = [
          metric("Age", health.age, " yrs"), metric("Gender", health.gender),
          metric("Height", health.height, " cm"), metric("Weight", health.weight, " kg"),
          metric("BMI", health.bmi), metric("Body fat", health.bodyFat, "%"),
          metric("Muscle", health.muscle, " kg"), metric("Visceral", health.visceral),
          metric("Waist", health.waist, " cm"), metric("Hip", health.hip, " cm"),
        ].filter(Boolean);
        const chipRow = (label: string, items: string[], bg: string, fg: string) => items.length ? (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".3px", marginBottom: 4 }}>{label}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>{items.map((t, i) => <span key={i} style={{ background: bg, color: fg, borderRadius: 999, padding: "2px 9px", fontSize: 11.5, fontWeight: 600 }}>{t}</span>)}</div>
          </div>
        ) : null;
        return (
          <div style={{ ...box, padding: "16px 18px", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <div style={{ fontWeight: 700 }}>Client health</div>
              <span style={{ flex: 1 }} />
              {health.measuredOn && <span style={{ fontSize: 11, color: "var(--muted)" }}>InBody {health.measuredOn}</span>}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 20, alignItems: "start" }}>
              {/* Left: the numbers + flags of this client */}
              <div>
                {metrics.length > 0
                  ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(76px, 1fr))", gap: 12 }}>{metrics}</div>
                  : <div style={{ fontSize: 12, color: "var(--muted)" }}>No measurements on record yet.</div>}
                {health.conditions && <div style={{ marginTop: 10 }}><div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".3px", marginBottom: 2 }}>Conditions</div><div style={{ fontSize: 12.5 }}>{health.conditions}</div></div>}
                {chipRow("Allergies", health.allergies, "var(--red-bg)", "var(--red-text)")}
                {chipRow("Goals", health.goals, "var(--brand-tint)", "var(--brand-text)")}
                {health.bloodStatus && <div style={{ marginTop: 10, fontSize: 12 }}><span style={{ color: "var(--muted)" }}>Blood report: </span><b>{health.bloodStatus}</b></div>}
              </div>
              {/* Right: InBody summary + the uploaded machine report */}
              <div>
                {!client.isLead && (
                  <SummaryEditor label="InBody summary" clientId={client.id} initial={health.inbodySummary ?? ""} aiAction={aiInbodySummary} saveAction={saveMeasurementSummary} />
                )}
                <div style={{ marginTop: 12, borderTop: "1px dashed var(--border)", paddingTop: 10 }}>
                  <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".3px", marginBottom: 6 }}>InBody report (PDF)</div>
                  {health.inbodyPdfUrl
                    ? <a href={health.inbodyPdfUrl} target="_blank" rel="noopener" style={{ display: "inline-block", marginBottom: 8, fontSize: 12.5, color: "var(--brand-text)", textDecoration: "none", fontWeight: 600 }}>📄 View InBody PDF →</a>
                    : <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>No InBody PDF uploaded yet.</div>}
                  <FileUploadForm variant="staff" clientId={client.id} kind="inbody" label={health.inbodyPdfUrl ? "Replace PDF" : "Add InBody PDF"} accept="application/pdf" />
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      <form action={saveConsultSession} style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16, alignItems: "start" }}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="duration_min" value={Math.max(1, Math.round(sec / 60))} />
        <input type="hidden" name="flags" value={JSON.stringify(fl)} />

        {/* Left column stacks the questionnaire and its exportable summary. */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Intake questionnaire + unfilled tracker */}
        <div style={{ ...box, padding: "16px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <div style={{ fontWeight: 700 }}>Intake questionnaire</div>
            <span style={{ flex: 1 }} />
            <span style={{ background: filled === questions.length ? "var(--green-bg)" : "var(--amber-bg)", color: filled === questions.length ? "var(--green-text)" : "var(--amber-text)", borderRadius: 999, padding: "2px 10px", fontSize: 11.5, fontWeight: 700 }}>
              {filled}/{questions.length} answered
            </span>
          </div>
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

          {/* Complete the questionnaire → reveals Word export + copyable summary */}
          <div style={{ borderTop: "1px solid var(--border)", marginTop: 4, paddingTop: 12, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {!qDone ? (
              <button type="button" onClick={() => setQDone(true)} style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>✓ Complete questionnaire</button>
            ) : (
              <>
                <span style={{ background: "var(--green-bg)", color: "var(--green-text)", borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 700 }}>✓ Completed</span>
                <button type="button" onClick={downloadWord} disabled={!answeredQA.length} style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: answeredQA.length ? "pointer" : "default", opacity: answeredQA.length ? 1 : 0.5 }}>⬇ Download as Word</button>
                <button type="button" onClick={() => setQDone(false)} style={{ border: "none", background: "transparent", color: "var(--muted)", fontSize: 12, cursor: "pointer" }}>Edit answers</button>
              </>
            )}
          </div>
        </div>

        {qDone && (
          <div style={{ ...box, padding: "16px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <div style={{ fontWeight: 700 }}>Questionnaire summary</div>
              <span style={{ flex: 1 }} />
              <button type="button" onClick={copyQSummary} disabled={!answeredQA.length} style={{ border: "1px solid var(--border)", background: copied ? "var(--green-bg)" : "#fff", color: copied ? "var(--green-text)" : "var(--ink)", borderRadius: 8, padding: "6px 12px", fontSize: 12.5, fontWeight: 600, cursor: answeredQA.length ? "pointer" : "default" }}>{copied ? "✓ Copied" : "Copy"}</button>
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>The answered questionnaire, ready to copy &amp; paste.</div>
            <textarea readOnly value={qSummaryText} rows={12} style={inp} />
          </div>
        )}
        </div>

        {/* Flags + consultation summary (the working outputs) */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, position: "sticky", top: 12 }}>
          {/* Medical flags */}
          <div style={{ ...box, padding: "16px 18px" }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Flags raised {fl.length > 0 && <span style={{ color: "var(--red-text)" }}>· {fl.length}</span>}</div>
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
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <div style={{ fontWeight: 700 }}>Consultation summary</div>
              <span style={{ flex: 1 }} />
              {!client.isLead && (
                <button type="button" onClick={generateSummary} disabled={aiBusy} style={{ border: "1px solid var(--border)", background: "var(--brand-tint)", color: "var(--brand-text)", borderRadius: 8, padding: "6px 12px", fontSize: 12.5, fontWeight: 600, cursor: aiBusy ? "default" : "pointer" }}>{aiBusy ? "Working…" : "✨ Generate with AI"}</button>
              )}
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>This becomes the shareable summary that feeds the Blueprint sign-off. Generate a draft from the client&apos;s data, or write your own.</div>
            <textarea name="summary" rows={10} value={summaryText} onChange={(e) => setSummaryText(e.target.value)} placeholder="Session notes, findings, plan…" style={inp} />
            {aiMsg && <div style={{ marginTop: 6, fontSize: 12, color: "var(--brand-text)" }}>{aiMsg}</div>}
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <button type="submit" name="complete" value="false" style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "9px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Save draft</button>
              <button type="submit" name="complete" value="true" style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>✓ Complete &amp; summarize</button>
            </div>
            {!client.isLead && (
              <div style={{ marginTop: 10, fontSize: 11.5, color: "var(--muted)" }}>
                <a href={`/consult/${id}/print`} target="_blank" rel="noopener" style={{ color: "var(--brand-text)", textDecoration: "none", fontWeight: 600 }}>Preview PDF →</a> · reflects the last saved summary. Save first, review, edit if needed, then share from the consultations list.
              </div>
            )}
          </div>
          <div style={{ ...box, padding: "12px 16px" }}>
            <Link href={client.isLead ? `/leads/${client.id}` : `/clients/${client.id}`} style={{ color: "var(--brand-text)", textDecoration: "none", fontSize: 13, fontWeight: 600 }}>{client.isLead ? "Open lead record →" : "Open full client card →"}</Link>
          </div>
        </div>
      </form>

      {/* Session tools — Doctor console only (vitals / labs / prescriptions). These
          are separate forms; submitting one keeps the questionnaire in place. */}
      {canTools && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Session tools</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {/* Vitals */}
            <form action={addVitals} style={{ ...box, padding: "14px 16px" }}>
              <input type="hidden" name="client_id" value={client.id} />
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Record vitals</div>
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
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Order lab test</div>
              <input name="test" placeholder="e.g. Lipid profile, HbA1c" required style={{ ...sm, marginBottom: 6 }} />
              <select name="priority" defaultValue="routine" style={{ ...sm, marginBottom: 8 }}><option value="routine">Routine</option><option value="urgent">Urgent</option><option value="stat">STAT</option></select>
              <button type="submit" style={toolBtn}>Place order</button>
            </form>

            {/* Quick prescription */}
            <form action={createPrescription} style={{ ...box, padding: "14px 16px" }}>
              <input type="hidden" name="client_id" value={client.id} />
              <input type="hidden" name="status" value="signed" />
              <input type="hidden" name="items" value={JSON.stringify(rx.drug.trim() ? [rx] : [])} />
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Prescription</div>
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
