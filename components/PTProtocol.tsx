// The PT protocol board for one client — the trainer-track counterpart of
// ComprehensiveProtocol. Two groups: turnarounds (work owed now) and calendar
// milestones (the reassessment and the session blocks). Server component; the
// clocks are computed once at render.

import { togglePTHold, nudgeRole } from "@/lib/actions";
import SubmitButton from "@/components/SubmitButton";
import { ptSla, formatLeft, SLA_TONE, type Gate } from "@/lib/pt-sla";
import { MILESTONES } from "@/lib/pt";
import { milestoneBookHref } from "@/lib/appt-match";
import type { Hold } from "@/lib/sla-clock";
export type SvcRow = { name: string; category: string; day_offset: number | null };

type View = {
  startDate: string;
  validityDays: number;
  fitnessCompletedAt: string | null;
  fitnessApprovedAt: string | null;
  workoutPlannedAt: string | null;
  sessionsCompleted: number;
  appointments: { type: string | null; date: string | null; status: string }[];
  hold: Hold;
  holdNote: string | null;
};

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "";
const day = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "";

type Chase = { roles: string[]; who: string; label: string; href?: string; clientId: string };

function Row({ g, dateOnly, bookHref, chase }: { g: Gate; dateOnly?: boolean; bookHref?: string | null; chase?: Chase | null }) {
  const tone = SLA_TONE[g.clock.status];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 0", fontSize: 12.5, borderTop: "1px solid var(--border)" }}>
      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.label}</span>
      <span style={{ background: tone.bg, color: tone.color, borderRadius: 999, padding: "2px 9px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>{tone.label}</span>
      <span style={{ color: "var(--muted)", fontSize: 11.5, minWidth: 108, textAlign: "right", whiteSpace: "nowrap" }}>
        {g.clock.status === "waiting" ? "—" : `${formatLeft(g.clock.msLeft)} · ${dateOnly ? day(g.clock.dueAt) : when(g.clock.dueAt)}`}
      </span>
      {chase ? (
        <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
          <form action={nudgeRole}>
            <input type="hidden" name="roles" value={chase.roles.join(",")} />
            <input type="hidden" name="label" value={chase.label} />
            <input type="hidden" name="client_id" value={chase.clientId} />
            {chase.href && <input type="hidden" name="href" value={chase.href} />}
            <SubmitButton persist pendingLabel="Sending…" doneLabel={`✓ ${chase.who} notified`} style={{ border: "none", background: "var(--brand-fill)", color: "#fff", borderRadius: 7, padding: "2px 9px", fontSize: 11, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
              Chase {chase.who}
            </SubmitButton>
          </form>
          {bookHref && <a href={bookHref} style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 7, padding: "2px 9px", fontSize: 11, fontWeight: 600, textDecoration: "none", color: "var(--brand-text)", whiteSpace: "nowrap" }}>Book →</a>}
        </span>
      ) : bookHref
        ? <a href={bookHref} style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 7, padding: "2px 9px", fontSize: 11, fontWeight: 600, textDecoration: "none", color: "var(--brand-text)", whiteSpace: "nowrap" }}>Book →</a>
        : <span style={{ width: 52 }} />}
    </div>
  );
}

export default function PTProtocol({ clientId, view, canHold, canBook, overseer = false, services = [] }: { clientId: string; view: View; canHold: boolean; canBook?: boolean; overseer?: boolean; services?: SvcRow[] }) {
  const r = ptSla(view);
  const held = Boolean(view.hold.holdSince);

  // Overseers chase rather than do: the trainer owes the turnaround work, the
  // front desk owns the bookings.
  const OWED = new Set(["running", "due_soon", "breached"]);
  const turnaroundChase = (g: Gate): Chase | null =>
    overseer && OWED.has(g.clock.status) ? { roles: ["Fitness Trainer"], who: "Trainer", label: g.label, clientId } : null;
  const milestoneChase = (g: Gate, href: string | null): Chase | null =>
    overseer && href ? { roles: ["Front Desk"], who: "Front Desk", label: g.label, href, clientId } : null;

  // The reassessment is an appointment; the session block isn't. Offer a
  // one-click "Book →" that pre-fills the calendar with the client, discipline
  // and the specific milestone service, returning to the Service Timeline after.
  const bookHref = (g: Gate): string | null => {
    if (!canBook || !g.gate.startsWith("milestone:") || ["met", "late"].includes(g.clock.status)) return null;
    const key = g.gate.replace(/^milestone:/, "").replace(/#\d+$/, "");
    const m = MILESTONES.find((x) => x.key === key);
    if (m) return milestoneBookHref(clientId, m.apptType, m.from, services, "timeline");
    return `/appointments?client=${clientId}&disc=Fitness%20Trainer&back=timeline`;
  };

  const section = (title: string, gates: Gate[], dateOnly?: boolean) => (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".5px", textTransform: "uppercase", color: "var(--muted)", marginBottom: 2 }}>{title}</div>
      {gates.map((g) => {
        const href = dateOnly ? bookHref(g) : null;
        const chase = dateOnly ? milestoneChase(g, href) : turnaroundChase(g);
        return <Row key={g.gate} g={g} dateOnly={dateOnly} bookHref={href} chase={chase} />;
      })}
    </div>
  );

  return (
    <div style={{ marginTop: 16, background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
        <div style={{ fontWeight: 700 }}>PT protocol</div>
        {held && (
          <span style={{ background: "var(--purple-bg)", color: "var(--purple-text)", borderRadius: 999, padding: "2px 9px", fontSize: 11, fontWeight: 700 }}>On hold — waiting on client</span>
        )}
        {!held && r.missed && (
          <span style={{ background: "var(--red-bg)", color: "var(--red-text)", borderRadius: 999, padding: "2px 9px", fontSize: 11, fontWeight: 700 }}>Commitment missed</span>
        )}
        <span style={{ flex: 1 }} />
        {canHold && (
          <form action={togglePTHold}>
            <input type="hidden" name="client_id" value={clientId} />
            {!held && <input type="hidden" name="note" value="Waiting on client" />}
            <SubmitButton pendingLabel="Saving…" doneLabel="✓ Done" style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "5px 11px", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "var(--ink)" }}>
              {held ? "Resume clocks" : "Hold — waiting on client"}
            </SubmitButton>
          </form>
        )}
      </div>
      <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 6 }}>
        Started {day(`${view.startDate}T00:00:00Z`)}
        {r.cycles > 1 ? ` · ${r.cycles} cycles` : ""}
        {` · ${view.sessionsCompleted} sessions done`}
        {view.holdNote ? ` · ${view.holdNote}` : ""}
      </div>

      {section("Turnaround — work owed", r.turnarounds)}
      {section("Calendar — bookings & sessions", r.milestones, true)}

      <div style={{ color: "var(--muted)", fontSize: 10.5, marginTop: 8 }}>
        Sign-off & one-week plan 24h from the fitness assessment · reassessment by day 28 · 12 sessions per cycle.
        {view.hold.holdMs > 0 && ` ${Math.round(view.hold.holdMs / 3_600_000)}h held so far.`}
      </div>
    </div>
  );
}
