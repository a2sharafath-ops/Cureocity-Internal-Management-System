"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { saveConsultSession } from "@/lib/actions";

export default function ConsoleView({
  id, kind, label, icon, client, questions, answers, summary, status,
}: {
  id: string;
  kind: string;
  label: string;
  icon: string;
  client: { id: string; name: string; code: string | null };
  questions: string[];
  answers: [string, string][];
  summary: string | null;
  status: string;
}) {
  const [sec, setSec] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const mm = String(Math.floor(sec / 60)).padStart(2, "0");
  const ss = String(sec % 60).padStart(2, "0");

  const amap = new Map(answers.map(([q, a]) => [q, a]));
  const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
  const inp: React.CSSProperties = { border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", fontSize: 13, background: "#fff", width: "100%", resize: "vertical" };

  return (
    <div style={{ maxWidth: 1120 }}>
      {/* Console chrome */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <Link href="/workspace?tab=summaries" style={{ color: "var(--teal-dark)", textDecoration: "none", fontSize: 13, fontWeight: 600 }}>← Workspace</Link>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--ink)", color: "#fff", display: "grid", placeItems: "center", fontSize: 20 }}>{icon}</div>
        <div>
          <h1 style={{ fontSize: 19, margin: 0 }}>{label}</h1>
          <div style={{ color: "var(--muted)", fontSize: 12.5 }}>{client.name}{client.code ? ` · ${client.code}` : ""} · {kind} consultation</div>
        </div>
        <span style={{ flex: 1 }} />
        {status === "completed" && <span style={{ background: "var(--green-bg)", color: "#166534", borderRadius: 999, padding: "4px 12px", fontSize: 12, fontWeight: 700 }}>✓ Completed</span>}
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "var(--ink)", color: "#fff", borderRadius: 10, padding: "8px 14px" }}>
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#ef4444", display: "inline-block" }} />
          <b style={{ fontVariantNumeric: "tabular-nums", fontSize: 14 }}>{mm}:{ss}</b>
        </div>
      </div>

      {/* Simulated A/V + ambient panel */}
      <div style={{ ...box, padding: "14px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", background: "linear-gradient(180deg, #14141a, #23232c)", color: "#fff", border: "none" }}>
        <div style={{ width: 120, height: 74, borderRadius: 10, background: "#000", display: "grid", placeItems: "center", fontSize: 26 }}>🎥</div>
        <div style={{ minWidth: 0 }}>
          <b style={{ fontSize: 14 }}>Live session with {client.name}</b>
          <div style={{ fontSize: 12, opacity: 0.7 }}>🎙️ Ambient scribe listening · AI co-pilot ready</div>
        </div>
        <span style={{ flex: 1 }} />
        <span style={{ background: "rgba(255,255,255,.12)", borderRadius: 999, padding: "4px 12px", fontSize: 12, fontWeight: 600 }}>Recording (simulated)</span>
      </div>

      <form action={saveConsultSession} style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16, alignItems: "start" }}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="duration_min" value={Math.max(1, Math.round(sec / 60))} />

        {/* Intake questionnaire */}
        <div style={{ ...box, padding: "16px 18px" }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>{icon} Intake questionnaire</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>Capture answers during the session.</div>
          {questions.map((q, i) => (
            <div key={i} style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 4 }}>{i + 1}. {q}</label>
              <textarea name={`a_${i}`} rows={2} defaultValue={amap.get(q) ?? ""} style={inp} />
            </div>
          ))}
        </div>

        {/* Scribe / summary + actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, position: "sticky", top: 12 }}>
          <div style={{ ...box, padding: "16px 18px" }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>📝 Consultation summary</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>This becomes the shareable summary that feeds the Blueprint sign-off.</div>
            <textarea name="summary" rows={12} defaultValue={summary ?? ""} placeholder="Session notes, findings, plan…" style={inp} />
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <button type="submit" name="complete" value="false" style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "9px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Save draft</button>
              <button type="submit" name="complete" value="true" style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>✓ Complete &amp; summarize</button>
            </div>
          </div>
          <div style={{ ...box, padding: "12px 16px" }}>
            <Link href={`/clients/${client.id}`} style={{ color: "var(--teal-dark)", textDecoration: "none", fontSize: 13, fontWeight: 600 }}>📋 Open full client card →</Link>
          </div>
        </div>
      </form>
    </div>
  );
}
