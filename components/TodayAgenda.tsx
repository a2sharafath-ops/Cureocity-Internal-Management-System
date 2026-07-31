import Link from "next/link";
import { markSessionComplete } from "@/lib/actions";
import SubmitButton from "@/components/SubmitButton";
import type { Agenda, AgendaItem } from "@/lib/today-agenda";

// The ops dashboard's single source of "what's on today", grouped by kind with a
// clear Done/Pending state on every row. Strength sessions can be marked done
// inline; everything else links to where it's actioned.
export default function TodayAgenda({ agenda, dateLabel }: { agenda: Agenda; dateLabel: string }) {
  const card: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
  const sectionTitle: React.CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: ".4px", color: "var(--muted)", textTransform: "uppercase", margin: "16px 0 6px" };

  const statusPill = (item: AgendaItem) => {
    if (item.done) return <span style={{ background: "var(--green-bg)", color: "var(--green-text)", borderRadius: 999, padding: "2px 9px", fontSize: 11, fontWeight: 700 }}>✓ Done</span>;
    if (item.overdue) return <span style={{ background: "var(--red-bg)", color: "var(--red-text)", borderRadius: 999, padding: "2px 9px", fontSize: 11, fontWeight: 700 }}>Overdue</span>;
    return <span style={{ background: "var(--amber-bg)", color: "var(--amber-text)", borderRadius: 999, padding: "2px 9px", fontSize: 11, fontWeight: 700 }}>Pending</span>;
  };

  const row = (item: AgendaItem) => (
    <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderTop: "1px solid var(--border)" }}>
      <span style={{ width: 62, color: "var(--muted)", fontSize: 12.5, flexShrink: 0 }}>{item.time ?? "—"}</span>
      {/* name + label share the flexible middle column and truncate together */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "baseline", gap: 6, overflow: "hidden" }}>
        {item.clientId
          ? <Link href={`/clients/${item.clientId}`} style={{ fontWeight: 600, fontSize: 13.5, textDecoration: "none", color: "inherit", whiteSpace: "nowrap", flexShrink: 0 }}>{item.clientName}</Link>
          : <span style={{ fontSize: 13.5, whiteSpace: "nowrap", flexShrink: 0 }}>{item.clientName}</span>}
        <span style={{ color: "var(--muted)", fontSize: 12.5, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>· {item.label}</span>
      </div>
      {/* fixed-width status column so pills line up down the card */}
      <span style={{ width: 74, flexShrink: 0, display: "flex", justifyContent: "flex-end" }}>{statusPill(item)}</span>
      {/* fixed-width action column so buttons line up too */}
      <span style={{ width: 82, flexShrink: 0, display: "flex", justifyContent: "flex-end" }}>
        {item.kind === "session" && !item.done && item.sessionId ? (
          <form action={markSessionComplete}>
            <input type="hidden" name="id" value={item.sessionId} />
            <input type="hidden" name="client_id" value={item.clientId ?? ""} />
            <SubmitButton style={{ border: "1px solid var(--ink)", background: "var(--ink)", color: "#fff", borderRadius: 8, padding: "4px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>Mark done</SubmitButton>
          </form>
        ) : item.kind !== "session" && !item.done ? (
          <Link href={item.href} style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "4px 12px", fontSize: 12, fontWeight: 600, textDecoration: "none", color: "var(--brand-text)", whiteSpace: "nowrap" }}>Open</Link>
        ) : null}
      </span>
    </div>
  );

  const section = (title: string, items: AgendaItem[], emptyText: string) => (
    <>
      <div style={sectionTitle}>{title} ({items.length})</div>
      {items.length ? items.map(row) : <div style={{ color: "var(--muted)", fontSize: 13, padding: "8px 0" }}>{emptyText}</div>}
    </>
  );

  return (
    <div style={{ ...card, padding: "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
        <b style={{ fontSize: 15 }}>Today — {dateLabel}</b>
        <span style={{ background: "var(--brand-tint)", color: "var(--brand-text)", borderRadius: 999, padding: "1px 9px", fontSize: 11, fontWeight: 600 }}>{agenda.pending} pending</span>
        <span style={{ flex: 1 }} />
        <Link href="/appointments" style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "4px 10px", fontSize: 12, textDecoration: "none", color: "var(--brand-text)", fontWeight: 600 }}>Calendar →</Link>
      </div>

      {section("Appointments", agenda.appointments, "No appointments today")}
      {section("Strength sessions", agenda.sessions, "No sessions today")}
      {section("Follow-ups due", agenda.followups, "Nothing due")}
      {section("Care deadlines due", agenda.deadlines, "None due today")}
    </div>
  );
}
