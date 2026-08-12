import {
  acknowledgeSafetyEvent, addSafetyEventNote, createClinicalReferral,
  createSafetyEvent, resolveSafetyEvent, updateClinicalReferral,
} from "@/lib/actions";
import {
  canCreateClinicalReferral, canOpenSafetyEvent, canResolveSafetyEvent, isAdminish,
} from "@/lib/roles";

export type ClinicalReferralView = {
  id: string;
  reason: string;
  destination_role: string;
  urgency: string;
  requested_action: string | null;
  consent_status: string;
  assigned_to_staff_id: string | null;
  status: string;
  created_by: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
};

export type SafetyEventView = {
  id: string;
  trigger_type: string;
  concern_summary: string;
  immediate_action: string;
  recipient_role: string;
  status: string;
  opened_by_name: string;
  opened_at: string;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
};

const input: React.CSSProperties = {
  width: "100%", border: "1px solid var(--border)", borderRadius: 8,
  padding: "8px 10px", background: "#fff", font: "inherit", fontSize: 13,
};
const label: React.CSSProperties = {
  display: "grid", gap: 4, color: "var(--muted)", fontSize: 11,
  fontWeight: 600,
};
const button: React.CSSProperties = {
  border: 0, borderRadius: 8, padding: "8px 12px", color: "white",
  background: "var(--ink)", cursor: "pointer", fontWeight: 700, fontSize: 12,
};

function when(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

export default function HealthCoachCarePanel({
  clientId, referrals, safetyEvents, role, userId, staffId, readOnly = false,
}: {
  clientId: string;
  referrals: ClinicalReferralView[];
  safetyEvents: SafetyEventView[];
  role: string;
  userId: string;
  staffId: string | null;
  readOnly?: boolean;
}) {
  const openSafety = safetyEvents.filter((x) => x.status !== "Resolved");
  const closedSafety = safetyEvents.filter((x) => x.status === "Resolved");
  const mayRefer = !readOnly && canCreateClinicalReferral(role);
  const mayOpen = !readOnly && canOpenSafetyEvent(role);
  const mayResolve = !readOnly && canResolveSafetyEvent(role);

  return (
    <section id="care-coordination" style={{ display: "grid", gap: 12 }}>
      {openSafety.map((event) => (
        <div key={event.id} style={{ background: "#fff1f2", border: "2px solid #ef4444", borderRadius: 12, padding: 16 }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
            <b style={{ color: "#991b1b" }}>🔴 Safety escalation — {event.status}</b>
            <span style={{ color: "#991b1b", fontSize: 12 }}>Opened {when(event.opened_at)} by {event.opened_by_name}</span>
          </div>
          <div style={{ marginTop: 8, fontWeight: 700 }}>{event.trigger_type}</div>
          <div style={{ marginTop: 4, fontSize: 13 }}>{event.concern_summary}</div>
          <div style={{ marginTop: 6, color: "#7f1d1d", fontSize: 12 }}>
            Immediate action recorded: {event.immediate_action} · Routed to {event.recipient_role}
          </div>
          {event.acknowledged_by && (
            <div style={{ marginTop: 6, fontSize: 12, color: "#7f1d1d" }}>
              Acknowledged by {event.acknowledged_by} at {when(event.acknowledged_at)}
            </div>
          )}
          {!readOnly && (
            <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-start" }}>
              {mayOpen && (
                <form action={addSafetyEventNote} style={{ display: "flex", gap: 6, flex: "1 1 320px" }}>
                  <input type="hidden" name="event_id" value={event.id} />
                  <input type="hidden" name="client_id" value={clientId} />
                  <input name="note" required placeholder="Record what happened while the client remained engaged" style={input} />
                  <button type="submit" style={button}>Add note</button>
                </form>
              )}
              {mayResolve && event.status === "Open" && (
                <form action={acknowledgeSafetyEvent}>
                  <input type="hidden" name="id" value={event.id} />
                  <input type="hidden" name="client_id" value={clientId} />
                  <button type="submit" style={{ ...button, background: "#b91c1c" }}>Acknowledge</button>
                </form>
              )}
              {mayResolve && (
                <form action={resolveSafetyEvent} style={{ display: "flex", gap: 6, flex: "1 1 340px" }}>
                  <input type="hidden" name="id" value={event.id} />
                  <input type="hidden" name="client_id" value={clientId} />
                  <input name="resolution_note" required placeholder="Clinical resolution and follow-up" style={input} />
                  <button type="submit" style={{ ...button, background: "#166534" }}>Resolve</button>
                </form>
              )}
            </div>
          )}
        </div>
      ))}

      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "18px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 700 }}>Clinical referrals &amp; safety</div>
            <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 2 }}>
              Warm hand-offs and permanent safety records. Customer referrals are kept separately.
            </div>
          </div>
          <span style={{ flex: 1 }} />
          {mayRefer && (
            <details style={{ position: "relative" }}>
              <summary style={{ ...button, listStyle: "none" }}>+ Clinical referral</summary>
              <form action={createClinicalReferral} style={{ position: "absolute", right: 28, zIndex: 5, width: "min(440px, calc(100vw - 48px))", background: "white", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "var(--shadow-lg, 0 16px 40px rgba(0,0,0,.16))", padding: 14, display: "grid", gap: 10 }}>
                <input type="hidden" name="client_id" value={clientId} />
                <label style={label}>Destination
                  <select name="destination_role" required style={input} defaultValue="Doctor">
                    <option>Doctor</option><option>Dietitian</option><option>Fitness Trainer</option>
                    <option>Psychologist</option><option>Medical Director</option>
                  </select>
                </label>
                <label style={label}>Urgency
                  <select name="urgency" style={input} defaultValue="Routine">
                    <option>Routine</option><option>Priority</option><option>Urgent</option>
                  </select>
                </label>
                <label style={label}>Reason
                  <textarea name="reason" required rows={3} style={input} placeholder="What changed, and why this hand-off is needed" />
                </label>
                <label style={label}>Requested action
                  <input name="requested_action" style={input} placeholder="What the receiving professional should do" />
                </label>
                <label style={label}>Client consent
                  <select name="consent_status" style={input} defaultValue="Not recorded">
                    <option>Not recorded</option><option>Obtained</option><option>Declined</option><option>Not required</option>
                  </select>
                </label>
                <button type="submit" style={button}>Send referral</button>
              </form>
            </details>
          )}
          {mayOpen && (
            <details style={{ position: "relative" }}>
              <summary style={{ ...button, background: "#b91c1c", listStyle: "none" }}>🔴 Raise safety concern</summary>
              <form action={createSafetyEvent} style={{ position: "absolute", right: 28, zIndex: 6, width: "min(460px, calc(100vw - 48px))", background: "white", border: "2px solid #ef4444", borderRadius: 12, boxShadow: "var(--shadow-lg, 0 16px 40px rgba(0,0,0,.18))", padding: 14, display: "grid", gap: 10 }}>
                <input type="hidden" name="client_id" value={clientId} />
                <div style={{ color: "#991b1b", fontSize: 12, fontWeight: 700 }}>
                  This opens a persistent record and alerts the assigned Doctor and Medical Director.
                </div>
                <label style={label}>Trigger
                  <select name="trigger_type" required style={input} defaultValue="Positive self-harm response">
                    <option>Positive self-harm response</option><option>New exercise symptom</option>
                    <option>Substance or withdrawal concern</option><option>Other urgent concern</option>
                  </select>
                </label>
                <label style={label}>What was observed or reported?
                  <textarea name="concern_summary" required rows={3} style={input} />
                </label>
                <label style={label}>Immediate action already taken
                  <textarea name="immediate_action" required rows={2} style={input} placeholder="For example: kept client engaged and contacted the senior" />
                </label>
                <button type="submit" style={{ ...button, background: "#b91c1c" }}>Open and escalate</button>
              </form>
            </details>
          )}
        </div>

        {referrals.length === 0 ? (
          <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 14 }}>No clinical referrals recorded.</div>
        ) : (
          <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
            {referrals.map((referral) => {
              const mayUpdate = !readOnly && (
                isAdminish(role) || referral.created_by === userId
                || referral.destination_role === role
                || (!!staffId && referral.assigned_to_staff_id === staffId)
              );
              return (
                <div key={referral.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12, display: "grid", gap: 5 }}>
                  <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                    <b>{referral.destination_role}</b>
                    <span style={{ borderRadius: 999, padding: "2px 7px", fontSize: 11, fontWeight: 700, background: referral.urgency === "Urgent" ? "#fee2e2" : referral.urgency === "Priority" ? "#fef3c7" : "#e0f2fe", color: referral.urgency === "Urgent" ? "#991b1b" : referral.urgency === "Priority" ? "#92400e" : "#075985" }}>{referral.urgency}</span>
                    <span style={{ borderRadius: 999, padding: "2px 7px", fontSize: 11, background: "var(--neutral-bg)", color: "var(--muted)" }}>{referral.status}</span>
                    <span style={{ flex: 1 }} />
                    <span style={{ color: "var(--muted)", fontSize: 11 }}>{when(referral.created_at)}</span>
                  </div>
                  <div style={{ fontSize: 13 }}>{referral.reason}</div>
                  {referral.requested_action && <div style={{ color: "var(--muted)", fontSize: 12 }}>Requested: {referral.requested_action}</div>}
                  <div style={{ color: "var(--muted)", fontSize: 11 }}>Raised by {referral.created_by_name} · Consent: {referral.consent_status}</div>
                  {mayUpdate && (
                    <form action={updateClinicalReferral} style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                      <input type="hidden" name="id" value={referral.id} />
                      <input type="hidden" name="client_id" value={clientId} />
                      <select name="status" defaultValue={referral.status} style={{ ...input, width: "auto" }}>
                        <option>Sent</option><option>Acknowledged</option><option>Scheduled</option>
                        <option>Completed</option><option>Declined</option><option>Unable to contact</option><option>Cancelled</option>
                      </select>
                      <input name="note" placeholder="Update note" style={{ ...input, flex: "1 1 220px" }} />
                      <button type="submit" style={button}>Update</button>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {closedSafety.length > 0 && (
          <details style={{ marginTop: 14 }}>
            <summary style={{ cursor: "pointer", color: "var(--muted)", fontSize: 12 }}>
              Resolved safety history ({closedSafety.length})
            </summary>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              {closedSafety.map((event) => (
                <div key={event.id} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 10, fontSize: 12 }}>
                  <b>{event.trigger_type}</b> · opened {when(event.opened_at)} · resolved by {event.resolved_by} at {when(event.resolved_at)}
                  {event.resolution_note && <div style={{ color: "var(--muted)", marginTop: 4 }}>{event.resolution_note}</div>}
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </section>
  );
}
