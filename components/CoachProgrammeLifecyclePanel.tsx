"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { transitionCoachProgrammeLifecycle, type CoachProgrammeLifecycleState } from "@/lib/actions";
import {
  COACH_PROGRAMME_STATUSES, coachProgrammeTransitionAllowed,
  type CoachProgrammeLifecycle, type CoachProgrammeLifecycleEvent,
  type CoachProgrammeStatus,
} from "@/lib/coach-programme-lifecycle";
import { COACH_OVERRIDE_REASON_MIN_LENGTH } from "@/lib/coach-access";

const field: React.CSSProperties = { width: "100%", boxSizing: "border-box", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", background: "#fff", font: "inherit", fontSize: 12 };
const label: React.CSSProperties = { display: "grid", gap: 4, color: "var(--muted)", fontSize: 11.5, fontWeight: 650 };
const button: React.CSSProperties = { border: 0, borderRadius: 8, padding: "8px 12px", background: "var(--ink)", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 12 };

function statusTone(status: CoachProgrammeStatus): React.CSSProperties {
  if (status === "Active") return { background: "var(--green-bg)", color: "var(--green-text)" };
  if (status === "Disengaged") return { background: "var(--red-bg)", color: "var(--red-text)" };
  if (status === "Paused") return { background: "var(--amber-bg)", color: "var(--amber-text)" };
  return { background: "var(--neutral-bg)", color: "var(--muted)" };
}

export default function CoachProgrammeLifecyclePanel({ clientId, lifecycle, events, canManage, supervisorOverride, today }: {
  clientId: string;
  lifecycle: CoachProgrammeLifecycle | null;
  events: CoachProgrammeLifecycleEvent[];
  canManage: boolean;
  supervisorOverride: boolean;
  today: string;
}) {
  const current = lifecycle?.status ?? "Active";
  const initialising = !lifecycle;
  const [target, setTarget] = useState<CoachProgrammeStatus | "">(initialising ? "Active" : "");
  const [state, action] = useActionState<CoachProgrammeLifecycleState, FormData>(transitionCoachProgrammeLifecycle, {});
  const needsNextContact = ["Active", "Paused", "Disengaged"].includes(target);
  const options = COACH_PROGRAMME_STATUSES.filter((status) => coachProgrammeTransitionAllowed(current, status));
  const bookHref = lifecycle?.next_contact_date
    ? `/appointments?client=${encodeURIComponent(clientId)}&disc=${encodeURIComponent("Health Coach")}&type=${encodeURIComponent("Follow-up")}&date=${encodeURIComponent(lifecycle.next_contact_date)}&back=overview`
    : null;

  return <section id="programme-lifecycle" style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "16px 18px", marginBottom: 16 }}>
    <div style={{ display: "flex", alignItems: "start", gap: 10, flexWrap: "wrap" }}>
      <div style={{ flex: 1 }}><div style={{ fontWeight: 750 }}>Coaching programme lifecycle</div><div style={{ color: "var(--muted)", fontSize: 11.5, marginTop: 2 }}>Care engagement only. Package, subscription and billing statuses are unchanged.</div></div>
      <span style={{ ...statusTone(current), borderRadius: 999, padding: "3px 9px", fontSize: 11, fontWeight: 750 }}>{current}</span>
    </div>

    {lifecycle?.effective_date && <div style={{ marginTop: 10, fontSize: 12 }}><b>Since {lifecycle.effective_date}:</b> {lifecycle.status_reason}{lifecycle.next_contact_date && <div style={{ marginTop: 4, color: "var(--brand-text)" }}><b>Next contact {lifecycle.next_contact_date}:</b> {lifecycle.next_contact_plan}</div>}<div style={{ color: "var(--muted)", fontSize: 10.5, marginTop: 4 }}>Recorded by {lifecycle.changed_by_name} ({lifecycle.changed_by_role})</div>{canManage && bookHref && <Link href={bookHref} style={{ display: "inline-block", marginTop: 8, border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px", background: "#fff", color: "var(--brand-text)", textDecoration: "none", fontSize: 11.5, fontWeight: 700 }}>Book next Health Coach session →</Link>}</div>}

    {canManage && <details style={{ marginTop: 12, border: "1px solid var(--border)", borderRadius: 9, padding: "9px 11px" }}>
      <summary style={{ cursor: "pointer", fontSize: 12.5, fontWeight: 700 }}>{initialising ? "Start coaching programme" : current === "Active" ? "Change programme status" : "Record next lifecycle transition"}</summary>
      <form action={action} style={{ display: "grid", gap: 9, marginTop: 10 }}>
        <input type="hidden" name="client_id" value={clientId} />
        <input type="hidden" name="from_status" value={current} />
        <input type="hidden" name="initialise_programme" value={String(initialising)} />
        <input type="hidden" name="current_effective_date" value={lifecycle?.effective_date ?? ""} />
        {state.error && <div style={{ background: "var(--red-bg)", color: "var(--red-text)", borderRadius: 7, padding: 8, fontSize: 11.5 }}>{state.error}</div>}
        {state.ok && <div style={{ background: "var(--green-bg)", color: "var(--green-text)", borderRadius: 7, padding: 8, fontSize: 11.5 }}>{state.ok}</div>}
        {supervisorOverride && <label style={label}>Supervisor override reason<input name="override_reason" required minLength={COACH_OVERRIDE_REASON_MIN_LENGTH} style={field} placeholder="Why the assigned coach cannot record this transition" /></label>}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {initialising ? <><input type="hidden" name="to_status" value="Active" /><label style={label}>Programme status<input value="Active" readOnly style={{ ...field, color: "var(--muted)" }} /></label></> : <label style={label}>New status<select name="to_status" required value={target} onChange={(event) => setTarget(event.target.value as CoachProgrammeStatus)} style={field}><option value="" disabled>Choose status</option>{options.map((status) => <option key={status}>{status}</option>)}</select></label>}
          <label style={label}>Effective date<input name="effective_date" type="date" required min={lifecycle?.effective_date ?? undefined} max={today} defaultValue={today} style={field} /></label>
        </div>
        <label style={label}>{initialising ? "Start rationale" : "Reason"}<textarea name="reason" required minLength={12} maxLength={1000} rows={3} style={{ ...field, resize: "vertical" }} placeholder={initialising ? "Record why coaching is starting and the agreed focus." : "Record the client context and agreed decision."} /></label>
        {needsNextContact && <div style={{ display: "grid", gridTemplateColumns: "minmax(150px, .4fr) 1fr", gap: 8 }}><label style={label}>Next-contact date<input name="next_contact_date" type="date" required min={today} style={field} /></label><label style={label}>Next-contact plan<input name="next_contact_plan" required minLength={12} maxLength={1000} style={field} placeholder="Who will do what at the next contact?" /></label></div>}
        <div style={{ color: "var(--muted)", fontSize: 10.5 }}>{initialising ? "Starting records the Active care-engagement plan and next contact. It does not change package, subscription or billing status." : "Transitions are permanent events. Corrections are recorded as another allowed transition."}</div>
        <button type="submit" style={{ ...button, justifySelf: "start" }}>{initialising ? "Start programme" : "Record transition"}</button>
      </form>
    </details>}

    {events.length > 0 && <details style={{ marginTop: 10 }}><summary style={{ cursor: "pointer", fontSize: 12, fontWeight: 700 }}>Lifecycle history ({events.length})</summary><div style={{ display: "grid", gap: 6, marginTop: 7 }}>{events.map((event) => <div key={event.id} style={{ borderTop: "1px solid var(--border)", paddingTop: 6, fontSize: 11.5 }}><b>{event.effective_date} · {event.from_status ? `${event.from_status} → ${event.to_status}` : "Programme started · Active"}</b><div>{event.reason}</div>{event.next_contact_date && <div style={{ color: "var(--muted)" }}>Next contact {event.next_contact_date} · {event.next_contact_plan}</div>}<div style={{ color: "var(--muted)", fontSize: 10.5 }}>{event.actor_name} ({event.actor_role})</div></div>)}</div></details>}
  </section>;
}
