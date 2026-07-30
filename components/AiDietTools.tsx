"use client";

import { useState } from "react";
import AiSummaryButton from "@/components/AiSummaryButton";
import { aiInbodySummary, aiConsultSummary, aiDietDraft, aiDailyMealSummary } from "@/lib/actions";

// Dietitian AI toolkit: pick a client, then generate summaries / a first-draft
// plan from the data already in Cureocity. Each result is a draft to copy into
// the diet-chart maker or send to the client after review.
export default function AiDietTools({ clients }: { clients: { id: string; name: string }[] }) {
  const [client, setClient] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
  const inp: React.CSSProperties = { border: "1px solid var(--border)", borderRadius: 8, padding: "0 10px", height: 36, fontSize: 13, background: "#fff", boxSizing: "border-box" };

  return (
    <div style={{ ...box, padding: 16, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <b>AI assist</b>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>· summaries &amp; a first-draft plan from this client&apos;s data</span>
      </div>
      <select value={client} onChange={(e) => setClient(e.target.value)} style={{ ...inp, minWidth: 220, marginBottom: 12 }}>
        <option value="">Select client…</option>
        {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      {!client ? (
        <div style={{ color: "var(--muted)", fontSize: 13 }}>Pick a client to enable the AI tools.</div>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          <AiSummaryButton action={aiInbodySummary} label="InBody summary" clientId={client} />
          <AiSummaryButton action={aiConsultSummary} label="Consultation summary" clientId={client} />
          <AiSummaryButton action={aiDietDraft} label="Draft diet plan" clientId={client} />
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ fontSize: 12, color: "var(--muted)" }}>Daily meal summary for </label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inp} />
            <AiSummaryButton action={aiDailyMealSummary} label="Daily meal summary" clientId={client} date={date} />
          </div>
        </div>
      )}
    </div>
  );
}
