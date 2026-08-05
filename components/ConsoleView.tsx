"use client";

import { useEffect, useState, useTransition, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import { saveConsultSession, addVitals, createOrder, createPrescription, aiInbodySummary, extractInbodySummary, saveMeasurementSummary, aiConsultSummary, autosaveConsult } from "@/lib/actions";
import FileUploadForm from "@/components/FileUploadForm";
import SummaryEditor from "@/components/SummaryEditor";
import { deriveFlags, labsFromAnswers } from "@/lib/auto-flags";
import MedicalReports, { type ReportRow } from "@/components/MedicalReports";
import ShareToPortal from "@/components/ShareToPortal";
import { sectionsFor, questionBody, answeredIn } from "@/lib/consult-sections";
import AmbientScribe from "@/components/AmbientScribe";

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

// Every control of the questionnaire form carries form="consult-form" instead of
// being nested inside it. That lets the session-tool forms (vitals, lab order,
// prescription — each posting to its own server action) sit in the same sticky
// column as the summary without nesting a <form> inside a <form>, which HTML
// forbids and browsers silently repair by dropping the inner one.
const FORM = "consult-form";

export default function ConsoleView({
  id, kind, label, icon, client, questions, answers, flags, summary, status, canTools, health, draftVitals, savedVitals, savedVitalsAt, draftPending, rxPrintId, rxSharedAt, labSharedAt, reports = [], orders = [], prescriptions = [],
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
  /** Lab order / prescription text typed but never submitted. */
  draftPending?: { order?: Record<string, string>; rx?: Record<string, string>; transcript?: string } | null;
  /** Prescription to print — this session's, else the client's most recent. */
  rxPrintId?: string | null;
  /** When each document reached the client's portal, if it has. */
  rxSharedAt?: string | null;
  labSharedAt?: string | null;
  reports?: ReportRow[];
  orders?: { test: string; priority: string | null; created_at: string }[];
  prescriptions?: { drug: string; dose: string | null; frequency: string | null; duration: string | null }[];
}) {
  // The ambient scribe owns the session clock — it only advances while actually
  // listening, so `duration_min` is consulting time rather than tab-open time.
  const [sec, setSec] = useState(0);
  // The scribe transcript. Autosaved alongside the unsent order/prescription
  // drafts, so a reload mid-consultation can't eat twenty minutes of dictation.
  const [transcript, setTranscript] = useState(String(draftPending?.transcript ?? ""));

  const amap = new Map(answers.map(([q, a]) => [q, a]));
  // Controlled answers → live unfilled tracker.
  const [ans, setAns] = useState<string[]>(questions.map((q) => amap.get(q) ?? ""));
  const filled = ans.filter((a) => a.trim()).length;

  // Sections are derived from the question text ("Labs — Fasting glucose"), so
  // an 85-question intake becomes a dozen navigable groups without the question
  // bank changing. A short questionnaire comes back as one unnamed section and
  // renders exactly as it always did.
  const sections = useMemo(() => sectionsFor(questions), [questions]);
  const grouped = sections.length > 1;

  // Open the first section with unanswered questions; the rest start collapsed.
  // Collapsed sections stay MOUNTED and hidden with CSS — unmounting them would
  // drop their textareas from the form, so a save would wipe those answers.
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    if (sections.length <= 1) return {};
    const firstGap = sections.find((s) => answeredIn(s, questions.map((q) => amap.get(q) ?? "")) < s.indices.length);
    const init: Record<string, boolean> = {};
    for (const s of sections) init[s.title] = s.title === (firstGap ?? sections[0]).title;
    return init;
  });
  const toggle = (t: string) => setOpen((p) => ({ ...p, [t]: !p[t] }));
  const setAll = (v: boolean) => setOpen(Object.fromEntries(sections.map((s) => [s.title, v])));
  const jump = (t: string) => {
    setOpen((p) => ({ ...p, [t]: true }));
    // Index-prefixed so two titles that slugify alike can't collide. Wait a
    // frame so the section has expanded before scrolling to it.
    const si = sections.findIndex((s) => s.title === t);
    requestAnimationFrame(() => document.getElementById(`sec-${si}-${slug(t)}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

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

  // Quick prescription (single drug) — Doctor tool. Both this and the lab-order
  // fields are autosaved as *unsent* text: an order exists only once placed and
  // a prescription only once signed, so restoring them must never look like a
  // record. It exists purely so a stray reload can't eat what someone is typing.
  const [rx, setRx] = useState({
    drug: String(draftPending?.rx?.drug ?? ""), dose: String(draftPending?.rx?.dose ?? ""),
    frequency: String(draftPending?.rx?.frequency ?? ""), duration: String(draftPending?.rx?.duration ?? ""),
  });
  const [ord, setOrd] = useState({
    test: String(draftPending?.order?.test ?? ""),
    priority: String(draftPending?.order?.priority ?? "routine"),
  });
  const rxUnsent = Object.values(rx).some((v) => v.trim());
  const ordUnsent = !!ord.test.trim();

  // Consultation summary — one field, optionally AI-drafted. This same text is
  // what "Save draft" / "Complete & summarize" submit (name="summary"), so there
  // is a single source of truth for the shareable summary.
  const [summaryText, setSummaryText] = useState(summary ?? "");

  // Which right-rail tool is expanded. Only one at a time: they're each a form,
  // and three open at once pushed the summary off the screen.
  const [tool, setTool] = useState<string | null>(canTools ? "vitals" : null);

  const qDate = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

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
  const latest = useRef({ ans, fl, summaryText, vit, ord, rx, transcript });
  latest.current = { ans, fl, summaryText, vit, ord, rx, transcript };

  const flush = useCallback(async () => {
    if (!dirty.current || status === "completed") return;
    dirty.current = false;
    setSaving(true);
    const { ans: a, fl: f, summaryText: s, vit: v, ord: o, rx: x, transcript: tr } = latest.current;
    const r = await autosaveConsult(id, kind, a, f, s, v, questions, { order: o, rx: x, transcript: tr });
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
  }, [ans, fl, summaryText, vit, ord, rx, transcript, flush, status]);

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
  const qSummaryText = `${qHeader}\n${qDate}\n\n${answeredQA.map((x, idx) => `${idx + 1}. ${x.q}\n${x.a}`).join("\n\n")}`;

  const copyQSummary = async () => {
    try { await navigator.clipboard.writeText(qSummaryText); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* clipboard blocked */ }
  };

  // Word export of the answered questionnaire — the one path that produces a
  // formatted document for a client file outside the system.
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

  // ---- shared styling -------------------------------------------------------
  const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
  const inp: React.CSSProperties = { border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", fontSize: 13, background: "#fff", width: "100%", boxSizing: "border-box", resize: "vertical" };
  const sm: React.CSSProperties = { ...inp, padding: "6px 8px", fontSize: 12.5 };
  const toolBtn: React.CSSProperties = { background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "7px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" };
  const ghost: React.CSSProperties = { border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", color: "var(--ink)" };
  const cap: React.CSSProperties = { fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".3px" };

  const [ctxOpen, setCtxOpen] = useState(false);
  const [repOpen, setRepOpen] = useState(reports.length > 0);

  // A one-line read of the client, always visible even when the full card is
  // folded away — the numbers a clinician glances at mid-sentence.
  const glance = health ? [
    health.age != null ? `${health.age}y` : null,
    health.gender,
    health.bmi != null ? `BMI ${health.bmi}` : null,
    health.bodyFat != null ? `body fat ${health.bodyFat}%` : null,
    health.allergies?.length ? `${health.allergies.length} allerg${health.allergies.length === 1 ? "y" : "ies"}` : null,
  ].filter(Boolean).join(" · ") : "";

  return (
    <div style={{ maxWidth: 1440 }}>
      {/* The questionnaire form is declared once and empty; its controls live
          wherever they read best and associate through form="consult-form". */}
      <form id={FORM} action={saveConsultSession} />
      <input form={FORM} type="hidden" name="id" value={id} />
      <input form={FORM} type="hidden" name="kind" value={kind} />
      {/* Only report a duration if the timer actually ran. It used to floor at 1
          minute, so every consultation recorded "1 min" whether or not anyone
          had started it — a number that looked real and never was. */}
      <input form={FORM} type="hidden" name="duration_min" value={sec > 0 ? Math.max(1, Math.round(sec / 60)) : ""} />
      <input form={FORM} type="hidden" name="flags" value={JSON.stringify(fl)} />
      {/* Vitals are typed in the tools rail but belong to the same consultation,
          so mirror them here: one Save records both, and a clinician can't lose
          vitals by saving the questionnaire. */}
      {VITAL_KEYS.map((k) => <input form={FORM} key={k} type="hidden" name={`v_${k}`} value={vit[k] ?? ""} />)}

      {/* ---- header ------------------------------------------------------- */}
      <div style={{ marginBottom: 12 }}>
        <Link href="/pro" style={{ display: "inline-block", color: "var(--brand-text)", textDecoration: "none", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>← Consultations</Link>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontSize: 19, margin: 0, lineHeight: 1.2 }}>{icon ? `${icon} ` : ""}{label}</h1>
            <div style={{ color: "var(--muted)", fontSize: 12.5, marginTop: 2 }}>{client.name}{client.code ? ` · ${client.code}` : ""} · {kind} consultation</div>
          </div>
          <span style={{ flex: 1 }} />
          {status === "completed" && <span style={{ background: "var(--green-bg)", color: "var(--green-text)", borderRadius: 999, padding: "4px 12px", fontSize: 12, fontWeight: 700 }}>✓ Completed</span>}
        </div>
      </div>

      {/* ---- ambient scribe ----------------------------------------------- */}
      <AmbientScribe
        clientName={client.name}
        transcript={transcript}
        onTranscript={setTranscript}
        onSeconds={setSec}
        onInsert={(t) => {
          // Append rather than replace: the summary may already hold a compiled
          // draft, and overwriting it would be the more expensive mistake.
          setSummaryText((prev) => (prev.trim() ? `${prev.trim()}\n\nFROM THE SESSION\n${t.trim()}` : t.trim()));
          setAiMsg("Transcript added to the summary — edit it into shape before completing.");
        }}
        disabled={status === "completed"}
      />

      {/* ---- client context — one line, expandable ------------------------ */}
      {health && (
        <div style={{ ...box, marginBottom: 12 }}>
          <button type="button" onClick={() => setCtxOpen((v) => !v)}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, background: "transparent", border: "none", padding: "11px 16px", cursor: "pointer", textAlign: "left" }}>
            <b style={{ fontSize: 13 }}>Client health</b>
            <span style={{ fontSize: 12.5, color: "var(--muted)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{glance || "No measurements on record yet."}</span>
            {health.measuredOn && <span style={{ fontSize: 11, color: "var(--muted)" }}>InBody {health.measuredOn}</span>}
            <span style={{ fontSize: 12, color: "var(--brand-text)", fontWeight: 600, flexShrink: 0 }}>{ctxOpen ? "Hide" : "Details"}</span>
          </button>
          {ctxOpen && (() => {
            const metric = (l: string, val: string | number | null | undefined, unit = "") =>
              val != null && val !== "" ? <div key={l}><div style={cap}>{l}</div><div style={{ fontSize: 14, fontWeight: 700 }}>{val}{unit}</div></div> : null;
            const metrics = [
              metric("Age", health.age, " yrs"), metric("Gender", health.gender),
              metric("Height", health.height, " cm"), metric("Weight", health.weight, " kg"),
              metric("BMI", health.bmi), metric("Body fat", health.bodyFat, "%"),
              metric("Muscle", health.muscle, " kg"), metric("Visceral", health.visceral),
              metric("Waist", health.waist, " cm"), metric("Hip", health.hip, " cm"),
            ].filter(Boolean);
            const chipRow = (l: string, items: string[], bg: string, fg: string) => items.length ? (
              <div style={{ marginTop: 10 }}>
                <div style={{ ...cap, marginBottom: 4 }}>{l}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>{items.map((t, i) => <span key={i} style={{ background: bg, color: fg, borderRadius: 999, padding: "2px 9px", fontSize: 11.5, fontWeight: 600 }}>{t}</span>)}</div>
              </div>
            ) : null;
            return (
              <div style={{ borderTop: "1px solid var(--border)", padding: "14px 16px", display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 20, alignItems: "start" }}>
                <div>
                  {metrics.length > 0
                    ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(76px, 1fr))", gap: 12 }}>{metrics}</div>
                    : <div style={{ fontSize: 12, color: "var(--muted)" }}>No measurements on record yet.</div>}
                  {health.conditions && <div style={{ marginTop: 10 }}><div style={{ ...cap, marginBottom: 2 }}>Conditions</div><div style={{ fontSize: 12.5 }}>{health.conditions}</div></div>}
                  {chipRow("Allergies", health.allergies, "var(--red-bg)", "var(--red-text)")}
                  {chipRow("Goals", health.goals, "var(--brand-tint)", "var(--brand-text)")}
                  {health.bloodStatus && <div style={{ marginTop: 10, fontSize: 12 }}><span style={{ color: "var(--muted)" }}>Blood report: </span><b>{health.bloodStatus}</b></div>}
                </div>
                <div>
                  {!client.isLead && (
                    <SummaryEditor label="InBody summary" clientId={client.id} initial={health.inbodySummary ?? ""} aiAction={aiInbodySummary} extractAction={extractInbodySummary} saveAction={saveMeasurementSummary} />
                  )}
                  <div style={{ marginTop: 12, borderTop: "1px dashed var(--border)", paddingTop: 10 }}>
                    <div style={{ ...cap, marginBottom: 6 }}>InBody report (PDF)</div>
                    {health.inbodyPdfUrl
                      ? <a href={health.inbodyPdfUrl} target="_blank" rel="noopener" style={{ display: "inline-block", marginBottom: 8, fontSize: 12.5, color: "var(--brand-text)", textDecoration: "none", fontWeight: 600 }}>📄 View InBody PDF →</a>
                      : <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>No InBody PDF uploaded yet.</div>}
                    <FileUploadForm variant="staff" clientId={client.id} kind="inbody" label={health.inbodyPdfUrl ? "Replace PDF" : "Add InBody PDF"} accept="application/pdf" />
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ---- working area ------------------------------------------------- */}
      <div style={{ display: "grid", gridTemplateColumns: grouped ? "184px minmax(0,1fr) 344px" : "minmax(0,1fr) 344px", gap: 14, alignItems: "start" }}>

        {/* Section rail — where am I, and what's left. */}
        {grouped && (
          <aside style={{ ...box, padding: "10px 8px", position: "sticky", top: 12, maxHeight: "calc(100vh - 24px)", overflowY: "auto" }}>
            <div style={{ ...cap, padding: "2px 8px 8px" }}>{filled}/{questions.length} answered</div>
            {sections.map((s) => {
              const done = answeredIn(s, ans);
              const all = done === s.indices.length;
              return (
                <button key={s.title} type="button" onClick={() => jump(s.title)}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 6, background: open[s.title] ? "var(--brand-tint)" : "transparent", border: "none", borderRadius: 8, padding: "6px 8px", cursor: "pointer", textAlign: "left", marginBottom: 1 }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: open[s.title] ? 700 : 500, color: open[s.title] ? "var(--brand-text)" : "var(--ink)", overflow: "hidden", textOverflow: "ellipsis" }}>{s.title}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: all ? "var(--green-text)" : done ? "var(--amber-text)" : "var(--muted)", flexShrink: 0 }}>
                    {all ? "✓" : `${done}/${s.indices.length}`}
                  </span>
                </button>
              );
            })}
            <div style={{ borderTop: "1px solid var(--border)", marginTop: 8, paddingTop: 8, display: "flex", gap: 6, padding: "8px 8px 0" }}>
              <button type="button" onClick={() => setAll(true)} style={{ ...ghost, padding: "4px 8px", fontSize: 11 }}>Expand all</button>
              <button type="button" onClick={() => setAll(false)} style={{ ...ghost, padding: "4px 8px", fontSize: 11 }}>Collapse</button>
            </div>
          </aside>
        )}

        {/* Questionnaire */}
        <main style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          {/* Reports come first because that is the order of the consultation:
              read what the labs said, then ask about it. Folded shut when there
              is nothing to read, so it costs no space on a first visit. */}
          {!client.isLead && (
            <div style={{ ...box }}>
              <button type="button" onClick={() => setRepOpen((v) => !v)}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, background: "transparent", border: "none", padding: "12px 18px", cursor: "pointer", textAlign: "left" }}>
                <span style={{ fontSize: 11, color: "var(--muted)", width: 10, flexShrink: 0 }}>{repOpen ? "\u25be" : "\u25b8"}</span>
                <b style={{ fontSize: 13.5, flex: 1 }}>Medical reports</b>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: reports.length ? "var(--brand-text)" : "var(--muted)" }}>
                  {reports.length ? `${reports.length} on file` : "none yet"}
                </span>
              </button>
              <div style={{ display: repOpen ? "block" : "none", borderTop: "1px solid var(--border)", padding: "12px 18px 14px" }}>
                <MedicalReports clientId={client.id} reports={reports} />
              </div>
            </div>
          )}
          <div style={{ ...box, padding: "14px 18px", display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontWeight: 700 }}>Intake questionnaire</div>
            <span style={{ flex: 1 }} />
            <span style={{ background: filled === questions.length ? "var(--green-bg)" : "var(--amber-bg)", color: filled === questions.length ? "var(--green-text)" : "var(--amber-text)", borderRadius: 999, padding: "2px 10px", fontSize: 11.5, fontWeight: 700 }}>
              {filled}/{questions.length} answered
            </span>
          </div>

          {sections.map((s, si) => {
            const isOpen = !grouped || open[s.title];
            const done = answeredIn(s, ans);
            return (
              <section key={s.title || "all"} id={`sec-${si}-${slug(s.title)}`} style={{ ...box, scrollMarginTop: 12 }}>
                {grouped && (
                  <button type="button" onClick={() => toggle(s.title)}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, background: "transparent", border: "none", padding: "12px 18px", cursor: "pointer", textAlign: "left" }}>
                    <span style={{ fontSize: 11, color: "var(--muted)", width: 10, flexShrink: 0 }}>{isOpen ? "▾" : "▸"}</span>
                    <b style={{ fontSize: 13.5, flex: 1, minWidth: 0 }}>{s.title}</b>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: done === s.indices.length ? "var(--green-text)" : "var(--muted)" }}>
                      {done}/{s.indices.length}
                    </span>
                  </button>
                )}
                {/* Hidden, never unmounted: a collapsed section's textareas must
                    stay in the form or saving would blank those answers. */}
                <div style={{ display: isOpen ? "block" : "none", padding: grouped ? "0 18px 14px" : "14px 18px" }}>
                  {s.indices.map((i) => {
                    const q = questions[i];
                    const empty = !ans[i]?.trim();
                    return (
                      <div key={i} style={{ marginBottom: 12 }}>
                        <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 4 }}>
                          {i + 1}. {questionBody(q, s.title)}
                          {empty && <span style={{ color: "var(--amber-text)", fontWeight: 500 }}> · unfilled</span>}
                        </label>
                        {/* The question travels with its own answer. Index alone
                            is not safe: the server used to re-derive the question
                            list, so if the two lists ever differed — a client's
                            gender edited mid-session, a deploy between opening
                            and saving — every answer silently attached to the
                            wrong question. */}
                        <input form={FORM} type="hidden" name={`q_${i}`} value={q} />
                        <textarea form={FORM} name={`a_${i}`} rows={2} value={ans[i]}
                          onChange={(e) => setAns((p) => { const n = [...p]; n[i] = e.target.value; return n; })}
                          style={{ ...inp, borderColor: empty ? "var(--amber-text)" : "var(--border)" }} />
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}

          {/* Complete the questionnaire → reveals Word export + copyable summary */}
          <div style={{ ...box, padding: "14px 18px", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {!qDone ? (
              <button type="button" onClick={() => setQDone(true)} style={{ ...toolBtn, padding: "8px 14px", fontSize: 13 }}>✓ Complete questionnaire</button>
            ) : (
              <>
                <span style={{ background: "var(--green-bg)", color: "var(--green-text)", borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 700 }}>✓ Completed</span>
                <button type="button" onClick={downloadWord} disabled={!answeredQA.length} style={{ ...ghost, padding: "8px 14px", fontSize: 13, cursor: answeredQA.length ? "pointer" : "default", opacity: answeredQA.length ? 1 : 0.5 }}>⬇ Download as Word</button>
                <button type="button" onClick={() => setQDone(false)} style={{ border: "none", background: "transparent", color: "var(--muted)", fontSize: 12, cursor: "pointer" }}>Edit answers</button>
              </>
            )}
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{answeredQA.length} answered · {questions.length - answeredQA.length} left</span>
          </div>

          {qDone && (
            <div style={{ ...box, padding: "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                <div style={{ fontWeight: 700 }}>Questionnaire summary</div>
                <span style={{ flex: 1 }} />
                <button type="button" onClick={copyQSummary} disabled={!answeredQA.length} style={{ ...ghost, background: copied ? "var(--green-bg)" : "#fff", color: copied ? "var(--green-text)" : "var(--ink)", cursor: answeredQA.length ? "pointer" : "default" }}>{copied ? "✓ Copied" : "Copy"}</button>
                {/* Saves the questionnaire right here, without scrolling to the
                    summary panel. Same submit as the rail's "Save draft". */}
                <button form={FORM} type="submit" name="complete" value="false" disabled={!answeredQA.length} title="Save these answers as a draft — the consultation stays open" style={{ ...ghost, cursor: answeredQA.length ? "pointer" : "default" }}>Save draft</button>
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>The answered questionnaire, ready to copy &amp; paste. <b>Save draft</b> stores the answers and keeps the consultation open.</div>
              <textarea readOnly value={qSummaryText} rows={12} style={inp} />
            </div>
          )}
        </main>

        {/* ---- right rail: flags, summary, tools --------------------------- */}
        <aside style={{ display: "flex", flexDirection: "column", gap: 12, position: "sticky", top: 12, maxHeight: "calc(100vh - 24px)", overflowY: "auto" }}>

          {/* Flags */}
          <div style={{ ...box, padding: "14px 16px" }}>
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
                          style={{ ...ghost, padding: "3px 9px", fontSize: 11.5, borderRadius: 7, flexShrink: 0 }}>Add</button>
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
              <select value={fSev} onChange={(e) => setFSev(e.target.value)} style={{ ...sm, width: 92 }}><option value="critical">Critical</option><option value="warning">Warning</option><option value="info">Note</option></select>
              <button type="button" onClick={addFlag} style={{ ...toolBtn, padding: "6px 12px" }}>Add</button>
            </div>
          </div>

          {/* Consultation summary + the two submits */}
          <div style={{ ...box, padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
              <div style={{ fontWeight: 700 }}>Consultation summary</div>
              <span style={{ flex: 1 }} />
              {!client.isLead && (
                <>
                  {/* Compile = assemble from what's already recorded (no AI).
                      Generate = ask the model. Both write into the same box, so
                      autosave keeps whichever the clinician ends up with. */}
                  <button type="button" onClick={compileSummary} title="Draft the summary from the health card, vitals, InBody, reports, flags, orders and prescription" style={{ ...ghost, padding: "5px 10px", fontSize: 12 }}>🧾 Compile</button>
                  <button type="button" onClick={generateSummary} disabled={aiBusy} style={{ ...ghost, background: "var(--brand-tint)", color: "var(--brand-text)", padding: "5px 10px", fontSize: 12, cursor: aiBusy ? "default" : "pointer" }}>{aiBusy ? "Working…" : "✨ AI draft"}</button>
                </>
              )}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 8 }}>This becomes the shareable summary that feeds the BluePrint sign-off. Generate a draft from the client&apos;s data, or write your own.</div>
            <textarea form={FORM} name="summary" rows={9} value={summaryText} onChange={(e) => setSummaryText(e.target.value)} placeholder="Session notes, findings, plan…" style={inp} />
            {aiMsg && <div style={{ marginTop: 6, fontSize: 12, color: "var(--brand-text)" }}>{aiMsg}</div>}
            {/* Autosave status — a long intake is only trustworthy if the
                clinician can see it's being kept. */}
            {status !== "completed" && (
              <div style={{ fontSize: 11.5, color: autoErr ? "var(--red-text)" : "var(--muted)", marginTop: 8 }}>
                {autoErr ? `Autosave failed — ${autoErr}` : saving ? "Saving…" : savedAt ? `Autosaved ${savedAt}` : "Autosave on"}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              <button form={FORM} type="submit" name="complete" value="false" style={{ ...ghost, padding: "9px 14px", fontSize: 13 }}>Save draft</button>
              <button form={FORM} type="submit" name="complete" value="true" style={{ ...toolBtn, padding: "9px 16px", fontSize: 13 }}>✓ Complete &amp; summarize</button>
            </div>
            {!client.isLead && (
              <div style={{ marginTop: 10, fontSize: 11.5, color: "var(--muted)" }}>
                <a href={`/consult/${id}/print`} target="_blank" rel="noopener" style={{ color: "var(--brand-text)", textDecoration: "none", fontWeight: 600 }}>Preview PDF →</a> · reflects the last saved summary. Save first, review, edit if needed, then share from the consultations list.
              </div>
            )}
          </div>

          {/* Session tools — Doctor console only. Each is its own form posting to
              its own action, so submitting one leaves the questionnaire alone.
              Collapsed by default: they're needed a few times a session, not
              continuously, and open they crowd out the summary. */}
          {canTools && (
            <div style={{ ...box, overflow: "hidden" }}>
              <div style={{ padding: "12px 16px 9px" }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>Session tools</div>
                <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>Vitals · lab tests · prescription</div>
              </div>

              <ToolRow label="Record vitals" hint={anyVitals ? "typed" : savedVitalsAt ? `on file ${savedVitalsAt}` : undefined} openNow={tool === "vitals"} onToggle={() => setTool(tool === "vitals" ? null : "vitals")}>
                <form action={addVitals}>
                  <input type="hidden" name="client_id" value={client.id} />
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
                  {anyVitals && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>Also saved by <b>Save draft</b> / <b>Complete</b> — and autosaved as you type.</div>}
                </form>
              </ToolRow>

              <ToolRow label="Order lab test" hint={ordUnsent ? "unsent" : orders.length ? `${orders.length} ordered` : undefined} tone={ordUnsent ? "warn" : undefined} openNow={tool === "lab"} onToggle={() => setTool(tool === "lab" ? null : "lab")}>
                <form action={createOrder}>
                  <input type="hidden" name="client_id" value={client.id} />
                  <input type="hidden" name="consultation_id" value={id} />
                  <input type="hidden" name="category" value="lab" />
                  <input name="test" placeholder="e.g. Lipid profile, HbA1c" required value={ord.test}
                    onChange={(e) => setOrd({ ...ord, test: e.target.value })} style={{ ...sm, marginBottom: 6 }} />
                  <select name="priority" value={ord.priority} onChange={(e) => setOrd({ ...ord, priority: e.target.value })} style={{ ...sm, marginBottom: 8 }}>
                    <option value="routine">Routine</option><option value="urgent">Urgent</option><option value="stat">STAT</option>
                  </select>
                  <button type="submit" onClick={() => setOrd({ test: "", priority: "routine" })} style={toolBtn}>Place order</button>
                  {ordUnsent && (
                    <div style={{ fontSize: 11, color: "var(--amber-text)", marginTop: 6 }}>
                      Typed but <b>not yet placed</b> — kept if you reload, but no order exists until you press Place order.
                    </div>
                  )}
                  {/* One requisition for every test advised in this session — the
                      sheet the client hands to the lab. */}
                  {orders.length > 0 && (
                    <a href={`/lab/${id}/print`} target="_blank" rel="noopener"
                       style={{ display: "inline-block", marginTop: 8, fontSize: 12, fontWeight: 600, color: "var(--brand-text)", textDecoration: "none" }}>
                      Print lab requisition ({orders.length}) →
                    </a>
                  )}
                  {orders.length > 0 && <ShareToPortal kind="lab" id={id} sharedAt={labSharedAt ?? null} label="Share to portal" />}
                </form>
              </ToolRow>

              <ToolRow label="Prescription" hint={rxUnsent ? "unsigned" : undefined} tone={rxUnsent ? "warn" : undefined} openNow={tool === "rx"} onToggle={() => setTool(tool === "rx" ? null : "rx")} last>
                <form action={createPrescription}>
                  <input type="hidden" name="client_id" value={client.id} />
                  <input type="hidden" name="consultation_id" value={id} />
                  <input type="hidden" name="status" value="signed" />
                  <input type="hidden" name="items" value={JSON.stringify(rx.drug.trim() ? [rx] : [])} />
                  <input value={rx.drug} onChange={(e) => setRx({ ...rx, drug: e.target.value })} placeholder="Drug" style={{ ...sm, marginBottom: 6 }} />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 8 }}>
                    <input value={rx.dose} onChange={(e) => setRx({ ...rx, dose: e.target.value })} placeholder="Dose" style={sm} />
                    <input value={rx.frequency} onChange={(e) => setRx({ ...rx, frequency: e.target.value })} placeholder="Frequency" style={sm} />
                    <input value={rx.duration} onChange={(e) => setRx({ ...rx, duration: e.target.value })} placeholder="Duration" style={{ ...sm, gridColumn: "1 / span 2" }} />
                  </div>
                  <button type="submit" disabled={!rx.drug.trim()} onClick={() => setRx({ drug: "", dose: "", frequency: "", duration: "" })}
                    style={{ ...toolBtn, opacity: rx.drug.trim() ? 1 : 0.5, cursor: rx.drug.trim() ? "pointer" : "not-allowed" }}>Sign &amp; add</button>
                  {rxUnsent && (
                    <div style={{ fontSize: 11, color: "var(--amber-text)", marginTop: 6 }}>
                      Typed but <b>not yet signed</b> — kept if you reload, but nothing is prescribed until you press Sign &amp; add.
                    </div>
                  )}
                  {rxPrintId && (
                    <a href={`/rx/${rxPrintId}/print`} target="_blank" rel="noopener"
                       style={{ display: "block", marginTop: 8, fontSize: 12, fontWeight: 600, color: "var(--brand-text)", textDecoration: "none" }}>
                      Print prescription →
                    </a>
                  )}
                  {rxPrintId && <ShareToPortal kind="rx" id={rxPrintId} sharedAt={rxSharedAt ?? null} label="Share to portal" />}
                  <Link href={`/emr/${client.id}`} style={{ display: "block", marginTop: 6, fontSize: 11.5, color: "var(--muted)", textDecoration: "none" }}>Full prescription in the client&apos;s record →</Link>
                </form>
              </ToolRow>
            </div>
          )}

          <div style={{ ...box, padding: "11px 16px" }}>
            <Link href={client.isLead ? `/leads/${client.id}` : `/clients/${client.id}`} style={{ color: "var(--brand-text)", textDecoration: "none", fontSize: 13, fontWeight: 600 }}>{client.isLead ? "Open lead record →" : "Open full client card →"}</Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

/** One collapsible tool in the right rail, with a status word on the header so a
 *  half-typed order is visible without opening it. */
function ToolRow({ label, hint, tone, openNow, onToggle, last, children }: {
  label: string; hint?: string; tone?: "warn"; openNow: boolean; onToggle: () => void; last?: boolean; children: React.ReactNode;
}) {
  return (
    <div style={{ borderTop: "1px solid var(--border)", borderBottom: last && openNow ? "none" : undefined }}>
      <button type="button" onClick={onToggle}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, background: "transparent", border: "none", padding: "10px 16px", cursor: "pointer", textAlign: "left" }}>
        <span style={{ fontSize: 11, color: "var(--muted)", width: 10, flexShrink: 0 }}>{openNow ? "▾" : "▸"}</span>
        <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600 }}>{label}</span>
        {hint && <span style={{ fontSize: 11, fontWeight: 700, color: tone === "warn" ? "var(--amber-text)" : "var(--muted)" }}>{hint}</span>}
      </button>
      {openNow && <div style={{ padding: "0 16px 14px" }}>{children}</div>}
    </div>
  );
}

/** Stable DOM id from a section title, for the jump rail's scroll target. */
function slug(t: string): string {
  return (t || "all").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "all";
}
