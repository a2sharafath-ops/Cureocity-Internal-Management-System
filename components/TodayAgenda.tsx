import Link from "next/link";
import { markSessionComplete } from "@/lib/actions";
import SubmitButton from "@/components/SubmitButton";
import type { Agenda, AgendaItem } from "@/lib/today-agenda";

// The ops dashboard's single source of "what's on today". Kept deliberately
// quiet: one colored status dot per row (amber = pending, red = overdue, green =
// done) instead of a pill, no per-row rules, and empty sections are hidden — so
// the card scans as a clean list rather than a grid of chips and buttons.
export default function TodayAgenda({ agenda, dateLabel }: { agenda: Agenda; dateLabel: string }) {
  const card: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
  const dotColor = (i: AgendaItem) => (i.done ? "var(--green)" : i.overdue ? "var(--red)" : "var(--amber-text)");

  const row = (item: AgendaItem) => (
    <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "7px 0" }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: dotColor(item), flexShrink: 0 }} />
      {/* Timed items (appointments / sessions) show the clock time; day-level
          items (follow-ups, care deadlines) have no hour, so they read "Today"
          or "Overdue" instead of a bare dash. */}
      <span style={{ width: 62, flexShrink: 0, fontSize: 12.5, color: item.overdue ? "var(--red)" : "var(--muted)", fontWeight: item.overdue || !item.time ? 600 : 400 }}>{item.time ?? (item.overdue ? "Overdue" : "Today")}</span>
      <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "baseline", gap: 6, overflow: "hidden" }}>
        {item.clientId
          ? <Link href={`/clients/${item.clientId}`} style={{ fontWeight: 600, fontSize: 13.5, textDecoration: "none", color: "inherit", whiteSpace: "nowrap", flexShrink: 0 }}>{item.clientName}</Link>
          : <span style={{ fontSize: 13.5, whiteSpace: "nowrap", flexShrink: 0 }}>{item.clientName}</span>}
        <span style={{ color: "var(--muted)", fontSize: 12.5, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
      </div>
      {item.kind === "session" && !item.done && item.sessionId ? (
        <form action={markSessionComplete} style={{ flexShrink: 0 }}>
          <input type="hidden" name="id" value={item.sessionId} />
          <input type="hidden" name="client_id" value={item.clientId ?? ""} />
          <SubmitButton style={{ border: "none", background: "var(--ink)", color: "#fff", borderRadius: 7, padding: "4px 11px", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>Mark done</SubmitButton>
        </form>
      ) : item.done ? (
        <span style={{ color: "var(--green-text)", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>✓</span>
      ) : (
        <Link href={item.href} style={{ color: "var(--brand-text)", fontSize: 12.5, fontWeight: 600, textDecoration: "none", flexShrink: 0, whiteSpace: "nowrap" }}>Open →</Link>
      )}
    </div>
  );

  // Only sections with something in them are shown, so the card doesn't carry
  // three "None due today" placeholders.
  const sections = [
    { title: "Appointments", items: agenda.appointments },
    { title: "Strength sessions", items: agenda.sessions },
    { title: "Follow-ups", items: agenda.followups },
    { title: "Care deadlines", items: agenda.deadlines },
  ].filter((s) => s.items.length);

  return (
    <div style={{ ...card, padding: "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
        <b style={{ fontSize: 15 }}>Today</b>
        <span style={{ color: "var(--muted)", fontSize: 13 }}>· {dateLabel}</span>
        <span style={{ background: "var(--brand-tint)", color: "var(--brand-text)", borderRadius: 999, padding: "1px 9px", fontSize: 11, fontWeight: 600 }}>{agenda.pending} pending</span>
        <span style={{ flex: 1 }} />
        <Link href="/appointments" style={{ color: "var(--brand-text)", fontSize: 12.5, textDecoration: "none", fontWeight: 600 }}>Calendar →</Link>
      </div>

      {sections.length === 0 ? (
        <div style={{ color: "var(--muted)", fontSize: 13, padding: "16px 0 4px" }}>Nothing scheduled today.</div>
      ) : sections.map((s, si) => (
        <div key={s.title} style={{ marginTop: si === 0 ? 12 : 0, paddingTop: si === 0 ? 0 : 12, borderTop: si === 0 ? "none" : "1px solid var(--border)", marginBottom: si === sections.length - 1 ? 0 : 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink)", letterSpacing: ".2px" }}>{s.title}</span>
            <span style={{ display: "inline-grid", placeItems: "center", minWidth: 18, height: 18, padding: "0 5px", borderRadius: 999, background: "var(--neutral-bg)", color: "var(--muted)", fontSize: 11, fontWeight: 700 }}>{s.items.length}</span>
          </div>
          {s.items.map(row)}
        </div>
      ))}
    </div>
  );
}
