"use client";

import { useState } from "react";
import Link from "next/link";
import {
  fuSendQuestionnaire, fuSendReminder, fuNoAnswer, fuBookInPerson, fuNoConsult, fuMarkReceived, fuCompleteReview,
} from "@/lib/actions";
import Chip from "@/components/Chip";

export type FuRow = {
  id: string; clientId: string | null; clientName: string | null; label: string; category: string | null;
  day: number | null; due_date: string; mode: string; stage: string; token: string | null;
  reminder_sent: boolean; no_answer: boolean; priority: string;
};

const STAGE_STYLE: Record<string, [string, string, string]> = {
  PENDING_CALL:   ["var(--amber-bg)", "#92400e", "To call"],
  LINK_SENT:      ["#dbeafe", "#1e40af", "Link sent"],
  PENDING_REVIEW: ["#e0f2f1", "var(--teal-dark)", "To review"],
  BOOKED:         ["var(--green-bg)", "#166534", "Booked"],
  NO_CONSULT:     ["#f1f5f9", "#64748b", "No consult"],
  COMPLETED:      ["var(--green-bg)", "#166534", "Completed"],
};

function fmtDate(iso: string) { return new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" }); }

export default function FollowupsQueue({ items, today, canWrite }: { items: FuRow[]; today: string; canWrite: boolean }) {
  const [cat, setCat] = useState("All");
  const [review, setReview] = useState<string | null>(null);
  const [summary, setSummary] = useState("");

  const cats = ["All", ...Array.from(new Set(items.map((f) => f.category).filter(Boolean) as string[]))];
  const inScope = items.filter((f) => cat === "All" || f.category === cat);
  const calls = inScope.filter((f) => f.stage === "PENDING_CALL").sort((a, b) => a.due_date < b.due_date ? -1 : 1);
  const links = inScope.filter((f) => f.stage === "LINK_SENT");
  const reviews = inScope.filter((f) => f.stage === "PENDING_REVIEW");
  const closed = inScope.filter((f) => ["BOOKED", "NO_CONSULT", "COMPLETED"].includes(f.stage));

  const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
  const th: React.CSSProperties = { padding: "9px 12px", textAlign: "left", color: "var(--muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: ".3px" };
  const td: React.CSSProperties = { padding: "10px 12px", fontSize: 13, verticalAlign: "top" };
  const chip = (bg: string, c: string, t: string) => <Chip bg={bg} color={c}>{t}</Chip>;
  const dueChip = (f: FuRow) => f.due_date < today ? chip("var(--red-bg)", "#991b1b", "Overdue") : f.due_date === today ? chip("var(--amber-bg)", "#92400e", "Today") : chip("#eef2f1", "var(--muted)", fmtDate(f.due_date));
  const modeChip = (m: string) => chip(m === "Online" ? "#dbeafe" : "#ede9fe", m === "Online" ? "#1e40af" : "#6d28d9", m);
  const btn = (bg: string, color = "#fff"): React.CSSProperties => ({ background: bg, color, border: bg === "#fff" ? "1px solid var(--border)" : "none", borderRadius: 8, padding: "5px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" });
  const hid = (f: FuRow) => <input type="hidden" name="id" value={f.id} />;

  const genSummary = (f: FuRow) => `Follow-up summary — ${f.label}${f.day != null ? ` (Day ${f.day})` : ""}\nClient: ${f.clientName ?? "—"}\n\nImpression: Adherence largely on track with minor lapses. Continue the current plan with attention to reported challenges.\nNext step: reinforce hydration and evening routine; confirm the next in-person review per protocol.`;

  const actions = (f: FuRow) => {
    if (!canWrite) return null;
    if (f.stage === "PENDING_CALL") {
      const canOnline = f.mode === "Online" || f.category === "Diet Consultation" || f.category === "Doctor Consultation";
      return (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {f.mode === "Online"
            ? <>
                <form action={fuSendQuestionnaire}>{hid(f)}<button style={btn("var(--teal)")}>Send questionnaire</button></form>
                <form action={fuBookInPerson}>{hid(f)}<button style={btn("#fff", "var(--teal-dark)")}>Book in-person</button></form>
              </>
            : <>
                <form action={fuBookInPerson}>{hid(f)}<button style={btn("var(--teal)")}>Book in-person</button></form>
                {canOnline && <form action={fuSendQuestionnaire}>{hid(f)}<button style={btn("#fff", "var(--teal-dark)")}>Send questionnaire</button></form>}
              </>}
          {canOnline && <form action={fuNoAnswer}>{hid(f)}<button style={btn("#fff", "var(--muted)")}>No answer</button></form>}
          <form action={fuNoConsult}>{hid(f)}<button style={btn("#fff", "#991b1b")}>No consult</button></form>
        </div>
      );
    }
    if (f.stage === "LINK_SENT") {
      return (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {!f.reminder_sent && <form action={fuSendReminder}>{hid(f)}<button style={btn("#fff", "var(--muted)")}>⏳ Reminder</button></form>}
          <form action={fuMarkReceived}>{hid(f)}<button style={btn("var(--teal)")}>Mark received</button></form>
        </div>
      );
    }
    if (f.stage === "PENDING_REVIEW") {
      return <button onClick={() => { setReview(review === f.id ? null : f.id); setSummary(""); }} style={btn("var(--teal)")}>Review + summary</button>;
    }
    return null;
  };

  const table = (list: FuRow[], withActions: boolean, empty: string) => (
    <div style={{ ...box, overflow: "auto", marginBottom: 18 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
        <thead><tr><th style={th}>Client</th><th style={th}>Service</th><th style={th}>Category</th><th style={th}>Day</th><th style={th}>Due</th><th style={th}>Mode</th><th style={th}>Status</th>{withActions && <th style={th}>Actions</th>}</tr></thead>
        <tbody>
          {list.map((f) => {
            const [sb, sc, st] = STAGE_STYLE[f.stage] ?? ["#eef2f1", "#64748b", f.stage];
            return (
              <tr key={f.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ ...td, fontWeight: 700 }}>{f.clientName ? <Link href={`/clients/${f.clientId}`} style={{ color: "var(--teal-dark)", textDecoration: "none" }}>{f.clientName}</Link> : "—"}</td>
                <td style={td}>{f.label}{f.token && <div style={{ fontSize: 11, color: "var(--muted)" }}>token {f.token}</div>}</td>
                <td style={{ ...td, color: "var(--muted)" }}>{f.category ?? "—"}</td>
                <td style={td}>{f.day != null ? `Day ${f.day}` : "—"}</td>
                <td style={td}>{dueChip(f)}</td>
                <td style={td}>{modeChip(f.mode)}</td>
                <td style={{ ...td, whiteSpace: "nowrap" }}>{chip(sb, sc, st)}{f.no_answer && <> {chip("var(--red-bg)", "#991b1b", "No answer")}</>}{f.reminder_sent && <> {chip("#e0f2f1", "var(--teal-dark)", "Reminded")}</>}</td>
                {withActions && <td style={td}>
                  {actions(f)}
                  {review === f.id && (
                    <form action={fuCompleteReview} onSubmit={() => setTimeout(() => setReview(null), 50)} style={{ marginTop: 8, display: "grid", gap: 6, minWidth: 280 }}>
                      <input type="hidden" name="id" value={f.id} />
                      <textarea name="summary" value={summary} onChange={(e) => setSummary(e.target.value)} rows={5} placeholder="Write or generate the summary…" style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", fontSize: 12, resize: "vertical" }} />
                      <div style={{ display: "flex", gap: 6 }}>
                        <button type="button" onClick={() => setSummary(genSummary(f))} style={btn("#fff", "var(--teal-dark)")}>✨ Generate summary</button>
                        <button type="submit" style={btn("var(--teal)")}>Mark complete</button>
                      </div>
                    </form>
                  )}
                </td>}
              </tr>
            );
          })}
          {list.length === 0 && <tr><td colSpan={withActions ? 8 : 7} style={{ ...td, textAlign: "center", color: "var(--muted)", padding: "18px 12px" }}>{empty}</td></tr>}
        </tbody>
      </table>
    </div>
  );

  const sectionTitle = (icon: string, label: string, n: number, color: string, bg: string) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 8px", fontSize: 14, fontWeight: 700 }}>
      {icon} {label} <span style={{ background: bg, color, borderRadius: 999, padding: "1px 9px", fontSize: 12 }}>{n}</span>
    </div>
  );

  return (
    <div>
      {/* toolbar */}
      <div style={{ ...box, display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", marginBottom: 16, flexWrap: "wrap" }}>
        <b style={{ fontSize: 12.5 }}>Category:</b>
        <select value={cat} onChange={(e) => setCat(e.target.value)} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "6px 9px", fontSize: 13, background: "#fff" }}>
          {cats.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <span style={{ flex: 1 }} />
        {chip("var(--amber-bg)", "#92400e", `${calls.length} to call`)}
        {chip("#dbeafe", "#1e40af", `${links.length} awaiting client`)}
        {chip("#e0f2f1", "var(--teal-dark)", `${reviews.length} to review`)}
      </div>

      {sectionTitle("📞", "Clients to Call Today", calls.length, "#92400e", "var(--amber-bg)")}
      {table(calls, true, "No calls due 🎉")}
      {sectionTitle("🔗", "Links Sent — Awaiting Client", links.length, "#1e40af", "#dbeafe")}
      {table(links, true, "Nothing awaiting clients")}
      {sectionTitle("📝", "Pending Consultant Review", reviews.length, "var(--teal-dark)", "#e0f2f1")}
      {table(reviews, true, "Review queue clear")}
      {sectionTitle("✅", "Closed", closed.length, "#64748b", "#f1f5f9")}
      {table(closed, false, "Nothing closed yet")}
    </div>
  );
}
