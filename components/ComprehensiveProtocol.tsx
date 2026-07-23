// The Comprehensive protocol board for one client.
//
// Two groups, because the two kinds of commitment fail differently and a
// clinician needs to tell them apart at a glance:
//
//   TURNAROUNDS are work owed right now — a summary to sign, a chart to draft.
//   Being overdue here is someone's inbox.
//
//   MILESTONES are dates in the calendar. Being overdue here is usually a
//   booking that never got made, which is front desk, not the clinician.
//
// Server component: the clocks are computed once at render. A ticking
// countdown on a 24-hour — let alone 28-day — commitment would be false
// precision and a needless client bundle, and the page already refreshes on
// Realtime changes.

import { toggleComprehensiveHold } from "@/lib/actions";
import { comprehensiveSla, formatLeft, SLA_TONE, type Gate } from "@/lib/comprehensive-sla";
import type { Hold } from "@/lib/sla-clock";

type View = {
  startDate: string;
  validityDays: number;
  consults: { kind: string; completedAt: string | null; approvedAt: string | null; prescriptionNeeded: boolean | null }[];
  consolidatedAt: string | null;
  approvedAt: string | null;
  dietDraftedAt: string | null;
  workoutPlannedAt: string | null;
  prescriptionSharedAt: string | null;
  sessionsCompleted: number;
  appointments: { type: string | null; date: string | null; status: string }[];
  hold: Hold;
  holdNote: string | null;
};

const when = (iso: string | null) => {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
};
const day = (iso: string | null) => {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

function Row({ g, dateOnly, bookHref }: { g: Gate; dateOnly?: boolean; bookHref?: string | null }) {
  const tone = SLA_TONE[g.clock.status];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 0", fontSize: 12.5, borderTop: "1px solid var(--border)" }}>
      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.label}</span>
      <span style={{ background: tone.bg, color: tone.color, borderRadius: 999, padding: "2px 9px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
        {tone.label}
      </span>
      <span style={{ color: "var(--muted)", fontSize: 11.5, minWidth: 108, textAlign: "right", whiteSpace: "nowrap" }}>
        {g.clock.status === "waiting"
          ? "—"
          : `${formatLeft(g.clock.msLeft)} · ${dateOnly ? day(g.clock.dueAt) : when(g.clock.dueAt)}`}
      </span>
      {bookHref
        ? <a href={bookHref} style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 7, padding: "2px 9px", fontSize: 11, fontWeight: 600, textDecoration: "none", color: "var(--brand-text)", whiteSpace: "nowrap" }}>Book →</a>
        : <span style={{ width: 52 }} />}
    </div>
  );
}

const OWNER_DISC: Record<string, string> = { doctor: "Doctor", dietitian: "Dietitian", trainer: "Fitness Trainer", coach: "Health Coach" };

export default function ComprehensiveProtocol({
  clientId, view, canHold, canBook,
}: { clientId: string; view: View; canHold: boolean; canBook?: boolean }) {
  const r = comprehensiveSla(view);
  const held = Boolean(view.hold.holdSince);

  // A milestone that's an appointment (not the strength-session block) and isn't
  // done yet gets a one-click "Book →" that pre-fills the calendar with this
  // client and the owning discipline.
  const bookHref = (g: Gate): string | null =>
    canBook && g.gate.startsWith("milestone:") && !["met", "late"].includes(g.clock.status)
      ? `/appointments?client=${clientId}&disc=${encodeURIComponent(OWNER_DISC[g.owner] ?? "")}`
      : null;

  const section = (title: string, gates: Gate[], dateOnly?: boolean) => (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".5px", textTransform: "uppercase", color: "var(--muted)", marginBottom: 2 }}>
        {title}
      </div>
      {gates.map((g) => <Row key={g.gate} g={g} dateOnly={dateOnly} bookHref={dateOnly ? bookHref(g) : null} />)}
    </div>
  );

  return (
    <div style={{ marginTop: 16, background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
        <div style={{ fontWeight: 700 }}>🗓 Comprehensive protocol</div>
        {held && (
          <span style={{ background: "var(--purple-bg)", color: "var(--purple-text)", borderRadius: 999, padding: "2px 9px", fontSize: 11, fontWeight: 700 }}>
            On hold — waiting on client
          </span>
        )}
        {!held && r.missed && (
          <span style={{ background: "var(--red-bg)", color: "var(--red-text)", borderRadius: 999, padding: "2px 9px", fontSize: 11, fontWeight: 700 }}>
            Commitment missed
          </span>
        )}
        <span style={{ flex: 1 }} />
        {canHold && (
          <form action={toggleComprehensiveHold}>
            <input type="hidden" name="client_id" value={clientId} />
            {!held && <input type="hidden" name="note" value="Waiting on client" />}
            <button type="submit" style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "5px 11px", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "var(--ink)" }}>
              {held ? "Resume clocks" : "Hold — waiting on client"}
            </button>
          </form>
        )}
      </div>
      <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 6 }}>
        Started {day(`${view.startDate}T00:00:00Z`)}
        {r.cycles > 1 ? ` · ${r.cycles} cycles` : ""}
        {view.holdNote ? ` · ${view.holdNote}` : ""}
      </div>

      {section("Turnaround — work owed", r.turnarounds)}
      {section("Calendar — bookings due", r.milestones, true)}

      <div style={{ color: "var(--muted)", fontSize: 10.5, marginTop: 8 }}>
        Sign-off 24h from each appointment · consolidated summary 48h from the last of the three ·
        diet chart, workout plan and prescription 24h from their consult.
        {view.hold.holdMs > 0 && ` ${Math.round(view.hold.holdMs / 3_600_000)}h held so far.`}
      </div>
    </div>
  );
}
