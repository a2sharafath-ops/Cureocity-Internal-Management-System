"use client";

import { useEffect, useState, useTransition, useRef, useCallback } from "react";
import Link from "next/link";
import { saveConsultSession, addVitals, createOrder, createPrescription, aiInbodySummary, extractInbodySummary, saveMeasurementSummary, aiConsultSummary, autosaveConsult } from "@/lib/actions";
import FileUploadForm from "@/components/FileUploadForm";
import SummaryEditor from "@/components/SummaryEditor";
import { deriveFlags, labsFromAnswers } from "@/lib/auto-flags";
import MedicalReports, { type ReportRow } from "@/components/MedicalReports";
import ShareToPortal from "@/components/ShareToPortal";

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
  id, kind, label, icon, client, questions, answers, flags, summary, status, canTools, health, draftVitals, savedVitals, savedVitalsAt, rxPrintId, rxSharedAt, labSharedAt, reports = [], orders = [], prescriptions = [],
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
  /** Vitals typed but not yet saved, restored from consultations.draft. */
  draftVitals?: Record<string, string> | null;
  /** Today's vitals row, if one has already been recorded. */
  savedVitals?: Record<string, string> | null;
  savedVitalsAt?: string | null;
  /** Prescription to print — this session's, else the client's most recent. */
  rxPrintId?: string | null;
  /** When each document reached the client's portal, if it has. */
  rxSharedAt?: string | null;
  labSharedAt?: string | null;
  reports?: ReportRow[];
  orders?: { test: string; priority: string | null; created_at: string }[];
  prescriptions?: { drug: string; dose: string | null; frequency: string | null; duration: string | null }[];
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

  // Vitals live in React state so they survive a questionnaire save (which
  // re-renders the page and used to blank these boxes) and can be autosaved.
  const VITAL_KEYS = ["systolic", "diastolic", "pulse", "spo2", "temp_c", "weight"] as const;
  // Seed order: unsaved draft first, then today's saved reading. Without the
  // second, saving cleared the draft and the boxes came back empty — the record
  // was fine, but it read as though the vitals had been lost.
  const [vit, setVit] = useState<Record<string, string>>(() => {
    const seed: Record<string, string> = {};
    for (const k of VITAL_KEYS) seed[k] = String(draftVitals?.[k] ?? savedVitals?.[k] ?? "");
    return seed;
  });
  const setV = (k: string, v: string) => setVit((p) => ({ ...p, [k]: v }));
  const anyVitals = Object.values(vit).some((v) => v.trim());

  // Suggested flags from the data already on screen — vitals being typed, the
  // InBody figures, and lab values answered in the questionnaire. Suggestions
  // only: nothing reaches the record until the clinician accepts it.
  const suggestions = (() => {
    const answered = questions.map((q, idx) => [q, (ans[idx] ?? "").trim()] as [string, string]).filter(([, a]) => a);
    const num = (s: string) => { const v = Number(String(s).trim()); return Number.isFinite(v) ? v : null; };
    return deriveFlags({
      vitals: { systolic: num(vit.systolic), diastolic: num(vit.diastolic), pulse: num(vit.pulse), spo2: num(vit.spo2), temp_c: num(vit.temp_c) },
      inbody: { bmi: health?.bmi ?? null, bodyFat: health?.bodyFat ?? null, visceral: health?.visceral ?? null },
      labs: labsFromAnswers(answered),
      gender: health?.gender ?? null,
    }).filter((s) => !fl.some((f) => f.text === s.text));   // hide once accepted
  })();

  // Quick prescription (single drug) — Doctor tool.
  const [rx, setRx] = useState({ drug: "", dose: "", frequency: "", duration: "" });

  // Consultation summary — one field, optionally AI-drafted. This same text is
  // what "Save draft" / "Complete & summarize" submit (name="summary"), so there
  // is a single source of truth for the shareable summary.
  const [summaryText, setSummaryText] = useState(summary ?? "");

  // Draft the consultation summary from everything already captured, so the
  // clinician edits rather than retypes. It's a digest, not a dump: the intake
  // contributes its clinically salient answers, not all 85. Writes into the same
  // box, so the existing autosave persists it like anything else typed there.
  const compileSummary = () => {
    const S: string[] = [];
    const sec = (title: string, lines: (string | null)[]) => {
      const body = lines.filter((x): x is string => !!x && !!x.trim());
      if (!body.length) return;
      if (S.length) S.push("");
      S.push(title.toUpperCase());
      S.push(...body);
    };
    // "2026-07-28" reads as a database field; "28 Jul 2026" reads as a date.
    const dt = (iso?: string | null) => {
      if (!iso) return null;
      const d = new Date(iso.length <= 10 ? `${iso}T00:00:00Z` : iso);
      return Number.isNaN(+d) ? iso : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: iso.length <= 10 ? "UTC" : "Asia/Kolkata" });
    };
    const field = (k: string, v: string | null) => (v ? `${k}: ${v}` : null);
    const answerTo = (re: RegExp) => {
      const i = questions.findIndex((q) => re.test(q));
      return i >= 0 ? (ans[i] ?? "").trim() || null : null;
    };

    // ---- header --------------------------------------------------------
    const who = [health?.age ? `${health.age}y` : null, health?.gender].filter(Boolean).join(" ");
    S.push(`${(label || `${kind} consultation`).toUpperCase()} — ${qDate}`);
    S.push(`${client.name}${client.code ? ` · ${client.code}` : ""}${who ? ` · ${who}` : ""}`);

    // ---- why they're here ----------------------------------------------
    sec("Presenting", [answerTo(/primary goal|reason for visit/i), health?.goals?.length ? `Goals: ${health.goals.join(", ")}.` : null]);

    // ---- background ----------------------------------------------------
    sec("History", [
      field("Conditions", health?.conditions || answerTo(/medical conditions/i)),
      field("Medications", answerTo(/ongoing medications|supplements/i)),
      field("Allergies", health?.allergies?.length ? health.allergies.join(", ") : answerTo(/allergies \(food/i)),
      field("Sleep", answerTo(/sleep/i)),
      field("Recent workup", answerTo(/recent illness|checkups/i)),
      field("Family history", answerTo(/family history/i)),
    ]);

    // ---- measured today -------------------------------------------------
    const vitals = [vit.systolic && vit.diastolic ? `BP ${vit.systolic}/${vit.diastolic}` : null, vit.pulse ? `pulse ${vit.pulse}` : null,
                    vit.spo2 ? `SpO₂ ${vit.spo2}%` : null, vit.temp_c ? `temp ${vit.temp_c} °C` : null].filter(Boolean).join(" · ");
    const anthro = [health?.height ? `${health.height} cm` : null, (vit.weight || health?.weight) ? `${vit.weight || health?.weight} kg` : null, health?.bmi ? `BMI ${health.bmi}` : null].filter(Boolean).join(" · ");
    const comp = [health?.bodyFat ? `body fat ${health.bodyFat}%` : null, health?.muscle ? `skeletal muscle ${health.muscle} kg` : null,
                  health?.visceral ? `visceral ${health.visceral}` : null].filter(Boolean).join(" · ");
    sec("Examination", [
      field("Anthropometry", anthro || null),
      field("Vitals", vitals || null),
      comp ? `Body composition: ${comp}${health?.measuredOn ? ` (InBody ${dt(health.measuredOn)})` : ""}.` : null,
    ]);

    // ---- what the labs say ----------------------------------------------
    const labLines: (string | null)[] = [];
    for (const r of reports.filter((r) => r.summary).slice(0, 4)) {
      const name = r.report_label || r.name || "Report";
      const when = dt(r.report_date) ?? dt(r.created_at);
      labLines.push(`${name}${when ? ` — ${when}` : ""}`);
      // The stored summary repeats the file name and date in its first line;
      // drop that so the heading isn't printed twice.
      for (const ln of String(r.summary).split("\n").map((x) => x.trim()).filter(Boolean)) {
        if (ln.startsWith(name) || /^Auto-extracted/i.test(ln)) continue;
        labLines.push(`  ${ln}`);
      }
    }
    if (!labLines.length && health?.bloodStatus) labLines.push(`Blood report: ${health.bloodStatus}.`);
    sec("Investigations", labLines);

    // ---- what worried the clinician -------------------------------------
    sec("Flags raised", fl.map((f) => `[${(SEVERITY[f.severity]?.label ?? f.severity).toUpperCase()}] ${f.text}`));

    // ---- what was done ---------------------------------------------------
    sec("Orders & prescription", [
      orders.length ? `Tests ordered: ${orders.map((o) => o.test).join(", ")}.` : null,
      prescriptions.length ? `Prescribed: ${prescriptions.map((r) => [r.drug, r.dose, r.frequency, r.duration].filter(Boolean).join(" ")).join("; ")}.` : null,
    ]);

    // ---- for the clinician to write --------------------------------------
    // Placeholders, not empty headings: the previous draft ended on a bare
    // "Assessment & plan:" and read as though it had been cut off.
    S.push("", "ASSESSMENT", "— ", "", "PLAN", "— ");
    S.push("", `Compiled from the record on ${qDate} · ${filled} of ${questions.length} intake questions answered. Review and edit before sharing.`);

    setSummaryText(S.join("\n"));
    setAiMsg("Drafted from the record — fill in Assessment and Plan, then Complete & summarize.");
  };

  // ---- autosave -----------------------------------------------------------
  // A long intake used to live only in the browser until someone pressed Save
  // draft, so a closed tab lost the lot. Answers, flags and the summary are now
  // written back a few seconds after typing stops, plus on tab-hide. The first
  // render is skipped so simply opening a consult doesn't write.
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [autoErr, setAutoErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const dirty = useRef(false);
  const first = useRef(true);
  const latest = useRef({ ans, fl, summaryText, vit });
  latest.current = { ans, fl, summaryText, vit };

  const flush = useCallback(async () => {
    if (!dirty.current || status === "completed") return;
    dirty.current = false;
    setSaving(true);
    const { ans: a, fl: f, summaryText: s, vit: v } = latest.current;
    const r = await autosaveConsult(id, kind, a, f, s, v, questions);
    setSaving(false);
    if (r?.error) { setAutoErr(r.error); dirty.current = true; }   // keep it dirty so the next tick retries
    else { setAutoErr(null); setSavedAt(new Date().toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true })); }
  }, [id, kind, status, questions]);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (status === "completed") return;
    dirty.current = true;
    const t = setTimeout(flush, 4000);          // settle after typing stops
    return () => clearTimeout(t);
  }, [ans, fl, summaryText, vit, flush, status]);

  // Save when the tab is hidden (covers switching tabs, closing, and mobile
  // backgrounding — which never fire a reliable unload).
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === "hidden") void flush(); };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [flush]);

  // Last resort: if work is still unsaved, make the browser ask before leaving.
  useEffect(() => {
    const onLeave = (e: BeforeUnloadEvent) => {
      if (!dirty.current || status === "completed") return;
      e.preventDefault(); e.returnValue = "";
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [status]);
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

  // Word export of the answered questionnaire. Currently not surfaced — the
  // panel offers Copy and Save draft instead. Kept because it's the one path
  // that produces a formatted document for a client file; wire it to a button
  // if that's wanted again.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
                  <SummaryEditor label="InBody summary" clientId={client.id} initial={health.inbodySummary ?? ""} aiAction={aiInbodySummary} extractAction={extractInbodySummary} saveAction={saveMeasurementSummary} />
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
        {/* Medical reports — upload a blood panel or scan and summarise it
            without leaving the consultation. */}
        {!client.isLead && (
          <div style={{ marginBottom: 16 }}>
            <MedicalReports clientId={client.id} reports={reports} />
          </div>
        )}

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
                {/* The question travels with its own answer. Index alone is not
                    safe: the server used to re-derive the question list, so if
                    the two lists ever differed — a client's gender edited
                    mid-session, a deploy between opening and saving — every
                    answer silently attached to the wrong question. */}
                <input type="hidden" name={`q_${i}`} value={q} />
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
              {/* Saves the questionnaire right here, without scrolling to the
                  bottom of the console. Same submit as the footer "Save draft"
                  (this whole view is one form), so it stores the answers behind
                  this summary and leaves the consult open. */}
              <button type="submit" name="complete" value="false" disabled={!answeredQA.length} title="Save these answers as a draft — the consultation stays open" style={{ border: "1px solid var(--border)", background: "#fff", color: "var(--ink)", borderRadius: 8, padding: "6px 12px", fontSize: 12.5, fontWeight: 600, cursor: answeredQA.length ? "pointer" : "default" }}>Save draft</button>
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>The answered questionnaire, ready to copy &amp; paste. <b>Save draft</b> stores the answers and keeps the consultation open.</div>
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
            {suggestions.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".4px", textTransform: "uppercase", color: "var(--muted)", marginBottom: 5 }}>
                  Suggested from this client&apos;s data · {suggestions.length}
                </div>
                <div style={{ display: "grid", gap: 5 }}>
                  {suggestions.map((s, i) => {
                    const sv = SEVERITY[s.severity] ?? SEVERITY.info;
                    return (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, border: "1px dashed var(--border)", borderRadius: 8, padding: "6px 10px" }}>
                        <span style={{ color: sv.fg, fontSize: 10, fontWeight: 700, textTransform: "uppercase", flexShrink: 0 }}>{sv.label}</span>
                        <span style={{ flex: 1, fontSize: 12.5 }}>{s.text}</span>
                        <span style={{ fontSize: 10.5, color: "var(--muted)", flexShrink: 0 }}>{s.source}</span>
                        <button type="button" onClick={() => setFl((x) => [...x, { text: s.text, severity: s.severity }])}
                          style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 7, padding: "3px 9px", fontSize: 11.5, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>Add</button>
                      </div>
                    );
                  })}
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 5 }}>Suggestions only — nothing is recorded until you add it.</div>
              </div>
            )}
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
                <>
                  {/* Compile = assemble from what's already recorded (no AI).
                      Generate = ask the model. Both write into the same box, so
                      autosave keeps whichever the clinician ends up with. */}
                  <button type="button" onClick={compileSummary} title="Draft the summary from the health card, vitals, InBody, reports, flags, orders and prescription" style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", marginRight: 6 }}>🧾 Compile from record</button>
                  <button type="button" onClick={generateSummary} disabled={aiBusy} style={{ border: "1px solid var(--border)", background: "var(--brand-tint)", color: "var(--brand-text)", borderRadius: 8, padding: "6px 12px", fontSize: 12.5, fontWeight: 600, cursor: aiBusy ? "default" : "pointer" }}>{aiBusy ? "Working…" : "✨ Generate with AI"}</button>
                </>
              )}
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>This becomes the shareable summary that feeds the Blueprint sign-off. Generate a draft from the client&apos;s data, or write your own.</div>
            <textarea name="summary" rows={10} value={summaryText} onChange={(e) => setSummaryText(e.target.value)} placeholder="Session notes, findings, plan…" style={inp} />
            {aiMsg && <div style={{ marginTop: 6, fontSize: 12, color: "var(--brand-text)" }}>{aiMsg}</div>}
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              {/* Autosave status — a long intake is only trustworthy if the
                  clinician can see it's being kept. */}
              {status !== "completed" && (
                <span style={{ fontSize: 12, color: autoErr ? "var(--red-text)" : "var(--muted)", marginRight: 4 }}>
                  {autoErr ? `Autosave failed — ${autoErr}` : saving ? "Saving…" : savedAt ? `Autosaved ${savedAt}` : "Autosave on"}
                </span>
              )}
              {/* Vitals are typed in Session tools but belong to the same
                  consultation, so mirror them here: one Save records both, and
                  a clinician can't lose vitals by saving the questionnaire. */}
              {VITAL_KEYS.map((k) => <input key={k} type="hidden" name={`v_${k}`} value={vit[k] ?? ""} />)}
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
                <input name="systolic" placeholder="Systolic" inputMode="numeric" value={vit.systolic} onChange={(e) => setV("systolic", e.target.value)} style={sm} />
                <input name="diastolic" placeholder="Diastolic" inputMode="numeric" value={vit.diastolic} onChange={(e) => setV("diastolic", e.target.value)} style={sm} />
                <input name="pulse" placeholder="Pulse" inputMode="numeric" value={vit.pulse} onChange={(e) => setV("pulse", e.target.value)} style={sm} />
                <input name="spo2" placeholder="SpO₂ %" inputMode="numeric" value={vit.spo2} onChange={(e) => setV("spo2", e.target.value)} style={sm} />
                <input name="temp_c" placeholder="Temp °C" inputMode="decimal" value={vit.temp_c} onChange={(e) => setV("temp_c", e.target.value)} style={sm} />
                <input name="weight" placeholder="Weight kg" inputMode="decimal" value={vit.weight} onChange={(e) => setV("weight", e.target.value)} style={sm} />
              </div>
              <input type="hidden" name="once_per_day" value="true" />
              <button type="submit" style={toolBtn}>Save vitals</button>
              {savedVitalsAt && (
                <div style={{ fontSize: 11, color: "var(--green-text)", marginTop: 6 }}>
                  On file for today — recorded {savedVitalsAt}. Saving again updates that reading.
                </div>
              )}
              {anyVitals && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>Also saved by <b>Save draft</b> / <b>Complete</b> below — and autosaved as you type.</div>}
            </form>

            {/* Lab order */}
            <form action={createOrder} style={{ ...box, padding: "14px 16px" }}>
              <input type="hidden" name="client_id" value={client.id} />
              <input type="hidden" name="consultation_id" value={id} />
              <input type="hidden" name="category" value="lab" />
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Order lab test</div>
              <input name="test" placeholder="e.g. Lipid profile, HbA1c" required style={{ ...sm, marginBottom: 6 }} />
              <select name="priority" defaultValue="routine" style={{ ...sm, marginBottom: 8 }}><option value="routine">Routine</option><option value="urgent">Urgent</option><option value="stat">STAT</option></select>
              <button type="submit" style={toolBtn}>Place order</button>
              {/* One requisition for every test advised in this session — the
                  sheet the patient hands to the lab. */}
              {orders.length > 0 && (
                <a href={`/lab/${id}/print`} target="_blank" rel="noopener"
                   style={{ display: "inline-block", marginTop: 8, fontSize: 12, fontWeight: 600, color: "var(--brand-text)", textDecoration: "none" }}>
                  Print lab requisition ({orders.length}) →
                </a>
              )}
              {orders.length > 0 && <ShareToPortal kind="lab" id={id} sharedAt={labSharedAt ?? null} label="Share to portal" />}
            </form>

            {/* Quick prescription */}
            <form action={createPrescription} style={{ ...box, padding: "14px 16px" }}>
              <input type="hidden" name="client_id" value={client.id} />
              <input type="hidden" name="consultation_id" value={id} />
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
              {rxPrintId && (
                <a href={`/rx/${rxPrintId}/print`} target="_blank" rel="noopener"
                   style={{ display: "block", marginTop: 8, fontSize: 12, fontWeight: 600, color: "var(--brand-text)", textDecoration: "none" }}>
                  Print prescription →
                </a>
              )}
              {rxPrintId && <ShareToPortal kind="rx" id={rxPrintId} sharedAt={rxSharedAt ?? null} label="Share to portal" />}
              <Link href={`/emr/${client.id}`} style={{ display: "block", marginTop: 6, fontSize: 11.5, color: "var(--muted)", textDecoration: "none" }}>Full prescription in EMR →</Link>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
