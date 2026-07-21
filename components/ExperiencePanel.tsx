"use client";

// Free experience sessions on the lead detail page.
//
// A lead gets one fitness assessment and one trial training session before
// they buy anything. This is the only place bookings exist pre-sale, and it's
// what makes "assess, then sell" recordable at all.
//
// The one-each limit lives in the database as a partial unique index. This
// component greys out what's already used rather than offering a button that
// errors — but the server action still returns the index's error verbatim if
// two people book at once, because the UI can't be the limit.
//
// React 18 / Next 14: useFormState from react-dom, pending via useFormStatus
// inside a child of the form.

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { bookExperienceSession, setExperienceStatus } from "@/lib/actions";
import { experienceState, type ExperienceRow } from "@/lib/experience";

type Appt = { id: string; type: string | null; date: string | null; hour: number | null; status: string; is_experience: boolean | null; providerName?: string | null };
type Sess = { id: string; date: string | null; hour: number | null; status: string; is_experience: boolean | null; providerName?: string | null };

const box: React.CSSProperties = {
  background: "var(--card)", border: "1px solid var(--border)",
  borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "16px 18px", marginTop: 16,
};
const btn: React.CSSProperties = {
  border: "1px solid var(--border)", background: "#fff", borderRadius: 8,
  padding: "6px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", color: "var(--ink)",
};
const field: React.CSSProperties = {
  border: "1px solid var(--border)", borderRadius: 8, padding: "6px 9px",
  fontSize: 12.5, background: "#fff",
};

const hh = (h: number | null) => {
  if (h == null) return "";
  const am = h < 12, x = h % 12 === 0 ? 12 : h % 12;
  return `${x}:00 ${am ? "AM" : "PM"}`;
};

const TONE: Record<string, { bg: string; color: string; label: string }> = {
  scheduled: { bg: "var(--blue-bg)", color: "var(--blue-text)", label: "Booked" },
  completed: { bg: "var(--green-bg)", color: "var(--green-text)", label: "Attended" },
  cancelled: { bg: "var(--neutral-bg)", color: "var(--muted)", label: "Cancelled" },
  no_show: { bg: "var(--red-bg)", color: "var(--red-text)", label: "No-show" },
};

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} style={{ ...btn, background: "var(--ink)", color: "#fff", border: "none", opacity: pending ? 0.6 : 1 }}>
      {pending ? "Booking…" : label}
    </button>
  );
}

function Booked({ row, leadId }: { row: ExperienceRow; leadId: string }) {
  const tone = TONE[row.status] ?? TONE.scheduled;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 12.5 }}>
      <span style={{ background: tone.bg, color: tone.color, borderRadius: 999, padding: "2px 9px", fontSize: 11, fontWeight: 700 }}>
        {tone.label}
      </span>
      <span>{row.date} {hh(row.hour)}</span>
      {row.providerName && <span style={{ color: "var(--muted)" }}>· {row.providerName}</span>}
      <span style={{ flex: 1 }} />
      {row.status === "scheduled" && (
        <>
          {(["completed", "no_show", "cancelled"] as const).map((s) => (
            <form key={s} action={setExperienceStatus}>
              <input type="hidden" name="lead_id" value={leadId} />
              <input type="hidden" name="kind" value={row.kind} />
              <input type="hidden" name="id" value={row.id} />
              <input type="hidden" name="status" value={s} />
              <button type="submit" style={{ ...btn, padding: "3px 9px", fontSize: 11.5 }}>
                {s === "completed" ? "Attended" : s === "no_show" ? "No-show" : "Cancel"}
              </button>
            </form>
          ))}
        </>
      )}
    </div>
  );
}

export default function ExperiencePanel({
  leadId, appointments, sessions, trainers, today, canBook,
}: {
  leadId: string;
  appointments: Appt[];
  sessions: Sess[];
  trainers: { id: string; name: string }[];
  today: string;
  canBook: boolean;
}) {
  const s = experienceState(appointments, sessions);
  const [state, action] = useFormState(bookExperienceSession, {} as { ok?: string; error?: string });
  const [open, setOpen] = useState<"assessment" | "training" | null>(null);

  const slot = (
    title: string,
    kind: "assessment" | "training",
    row: ExperienceRow | null,
    can: boolean,
    needsTrainer: boolean,
  ) => (
    <div style={{ borderTop: "1px solid var(--border)", padding: "10px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: row || open === kind ? 7 : 0 }}>
        <b style={{ fontSize: 13 }}>{title}</b>
        <span style={{ flex: 1 }} />
        {!row && canBook && open !== kind && (
          <button type="button" onClick={() => setOpen(kind)} style={btn}>Book</button>
        )}
        {!row && !canBook && <span style={{ color: "var(--muted)", fontSize: 12 }}>—</span>}
        {row && !can && open === kind && null}
      </div>

      {row && <Booked row={row} leadId={leadId} />}

      {!row && open === kind && (
        <form action={action} style={{ display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center" }}>
          <input type="hidden" name="lead_id" value={leadId} />
          <input type="hidden" name="kind" value={kind} />
          <input type="date" name="date" defaultValue={today} min={today} required style={field} />
          <select name="hour" defaultValue="9" style={field}>
            {Array.from({ length: 14 }, (_, i) => i + 6).map((h) => (
              <option key={h} value={h}>{hh(h)}</option>
            ))}
          </select>
          <select name="staff_id" required={needsTrainer} defaultValue="" style={field}>
            <option value="">{needsTrainer ? "Trainer…" : "Staff (optional)"}</option>
            {trainers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <Submit label="Confirm" />
          <button type="button" onClick={() => setOpen(null)} style={{ ...btn, border: "none", background: "transparent", color: "var(--muted)" }}>
            Cancel
          </button>
        </form>
      )}
    </div>
  );

  return (
    <div style={box}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ fontWeight: 700 }}>🎟 Free experience sessions</div>
        {s.completed && (
          <span style={{ background: "var(--green-bg)", color: "var(--green-text)", borderRadius: 999, padding: "2px 9px", fontSize: 11, fontWeight: 700 }}>
            Both attended
          </span>
        )}
      </div>
      <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 3 }}>
        One assessment and one training session, free, before they buy. Both carry
        over to their client record on conversion.
      </div>

      {state.error && (
        <div style={{ marginTop: 9, background: "var(--red-bg)", color: "var(--red-text)", borderRadius: 8, padding: "6px 9px", fontSize: 12 }}>
          {state.error}
        </div>
      )}
      {state.ok && (
        <div style={{ marginTop: 9, background: "var(--green-bg)", color: "var(--green-text)", borderRadius: 8, padding: "6px 9px", fontSize: 12 }}>
          {state.ok}
        </div>
      )}

      <div style={{ marginTop: 6 }}>
        {slot("Fitness assessment", "assessment", s.assessment, s.canBookAssessment, false)}
        {slot("Trial training session", "training", s.training, s.canBookTraining, true)}
      </div>

      <div style={{ color: "var(--muted)", fontSize: 10.5, marginTop: 8 }}>
        Cancelling frees the entitlement — a no-show doesn&apos;t. Cancel a no-show
        if you want to give someone a second chance.
      </div>
    </div>
  );
}
