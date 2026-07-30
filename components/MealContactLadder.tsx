"use client";

import { useState } from "react";
import { logMealContact, undoMealContact } from "@/lib/actions";
import SubmitButton from "@/components/SubmitButton";

export type Contact = { id?: string | null; channel: string; outcome: string; note: string | null; staff: string | null; created_at: string };

// The escalation ladder for a client who isn't logging their meals. Each rung is
// two stages: first record the attempt (nudged / called / visited), then whether
// they responded. Positive outcomes resolve the chase; negative ones escalate.
type Step = {
  channel: string; icon: string; title: string; hint: string;
  attempt: { outcome: string; label: string };
  resolve: { outcome: string; label: string; positive?: boolean }[];
};
const STEPS: Step[] = [
  { channel: "whatsapp", icon: "💬", title: "WhatsApp reminder", hint: "Send a nudge to log their meals",
    attempt: { outcome: "sent", label: "Reminder sent" },
    resolve: [{ outcome: "replied", label: "Replied", positive: true }, { outcome: "not_replied", label: "Not replied" }] },
  { channel: "call", icon: "📞", title: "Phone call", hint: "No reply on WhatsApp — call them",
    attempt: { outcome: "called", label: "Called" },
    resolve: [{ outcome: "reached", label: "Reached", positive: true }, { outcome: "no_answer", label: "No answer" }] },
  { channel: "meet", icon: "🧑‍🤝‍🧑", title: "In-person", hint: "Still no response — catch them at the centre",
    attempt: { outcome: "visited", label: "Visited" },
    resolve: [{ outcome: "met", label: "Met them", positive: true }, { outcome: "refused", label: "Refused to meet" }] },
];

const POSITIVE = new Set(["replied", "reached", "met"]);
const NEGATIVE = new Set(["not_replied", "no_answer", "no_response", "refused"]);
const OUTCOME_LABEL: Record<string, string> = {
  sent: "reminder sent", called: "called", visited: "visited",
  replied: "replied", reached: "reached", met: "met",
  not_replied: "no reply", no_answer: "no answer", no_response: "no answer", refused: "refused to meet",
};

const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
const CH_LABEL = (ch: string) => (({ portal: "Portal", whatsapp: "WhatsApp", call: "Call", meet: "In-person" } as Record<string, string>)[ch] ?? ch);

export default function MealContactLadder({ clientId, date, logged, contacts, readOnly = false }: { clientId: string; date: string; logged: boolean; contacts: Contact[]; readOnly?: boolean }) {
  const [note, setNote] = useState("");

  const attemptsOn = (ch: string) => contacts.filter((c) => c.channel === ch);
  const reached = logged || contacts.some((c) => POSITIVE.has(c.outcome));

  // Read-only (a past day): show only what was recorded, no controls.
  if (readOnly) {
    if (logged) return (
      <div style={{ marginTop: 10, borderTop: "1px dashed var(--border)", paddingTop: 10, fontSize: 12, color: "var(--green-text)" }}>✓ Logged via the portal that day</div>
    );
    if (!contacts.length) return (
      <div style={{ marginTop: 10, borderTop: "1px dashed var(--border)", paddingTop: 10, fontSize: 12, color: "var(--muted)" }}>No follow-up recorded this day.</div>
    );
    return (
      <div style={{ marginTop: 10, borderTop: "1px dashed var(--border)", paddingTop: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 6 }}>Follow-up that day</div>
        <div style={{ display: "grid", gap: 3 }}>
          {[...contacts].sort((a, b) => a.created_at.localeCompare(b.created_at)).map((a, i) => (
            <div key={i} style={{ fontSize: 12, color: "var(--muted)" }}>
              {fmtTime(a.created_at)} · {CH_LABEL(a.channel)} · {OUTCOME_LABEL[a.outcome] ?? a.outcome}{a.note ? ` — ${a.note}` : ""}{a.staff ? ` (${a.staff})` : ""}
            </div>
          ))}
        </div>
      </div>
    );
  }

  let current: string | null = null;
  if (!logged && !reached) {
    for (const s of STEPS) {
      const a = attemptsOn(s.channel);
      if (a.some((x) => POSITIVE.has(x.outcome))) { current = null; break; }
      if (a.length === 0) { current = s.channel; break; }
      if (a.some((x) => NEGATIVE.has(x.outcome))) continue;
      current = s.channel; break;
    }
  }

  if (logged) {
    return (
      <div style={{ marginTop: 10, borderTop: "1px dashed var(--border)", paddingTop: 10 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "var(--green-bg)", color: "var(--green-text)", borderRadius: 8, padding: "8px 12px", fontSize: 12.5, fontWeight: 600 }}>
          ✓ Logging via the portal — no follow-up needed
        </div>
      </div>
    );
  }

  const inp: React.CSSProperties = { border: "1px solid var(--border)", borderRadius: 8, padding: "6px 9px", fontSize: 12.5, background: "#fff" };
  const btnStyle = (primary: boolean): React.CSSProperties => ({
    border: primary ? "none" : "1px solid var(--border)", background: primary ? "var(--brand-fill)" : "#fff",
    color: primary ? "#fff" : "var(--ink)", borderRadius: 8, padding: "5px 11px", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
  });
  const action = (channel: string, outcome: string, label: string, primary: boolean) => (
    <form key={outcome} action={logMealContact}>
      <input type="hidden" name="client_id" value={clientId} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="channel" value={channel} />
      <input type="hidden" name="outcome" value={outcome} />
      <input type="hidden" name="note" value={note} />
      <SubmitButton pendingLabel="Saving…" doneLabel="✓ Logged" style={btnStyle(primary)}>{label}</SubmitButton>
    </form>
  );

  return (
    <div style={{ marginTop: 10, borderTop: "1px dashed var(--border)", paddingTop: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 10 }}>Follow-up ladder</div>

      <div style={{ display: "grid", gap: 8 }}>
        {STEPS.map((step, i) => {
          const attempts = attemptsOn(step.channel);
          const attempted = attempts.length > 0;
          const positive = attempts.some((a) => POSITIVE.has(a.outcome));
          const negative = attempts.some((a) => NEGATIVE.has(a.outcome));
          const isNext = step.channel === current;
          const bg = positive ? "var(--green-bg)" : isNext ? "var(--brand-tint)" : attempted ? "var(--bg)" : "#fff";
          return (
            <div key={step.channel} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "9px 11px", borderRadius: 10, border: isNext ? "1px solid var(--brand-fill)" : "1px solid var(--border)", background: bg }}>
              <div style={{ width: 24, height: 24, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700, background: positive ? "var(--green-text)" : negative ? "var(--muted)" : attempted ? "var(--amber-text)" : "var(--neutral-bg)", color: attempted || positive || negative ? "#fff" : "var(--muted)" }}>
                {positive ? "✓" : negative ? "✕" : attempted ? "•" : i + 1}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{step.icon} {step.title}</span>
                  {isNext && <span style={{ background: "var(--brand-fill)", color: "#fff", borderRadius: 999, padding: "1px 8px", fontSize: 10, fontWeight: 700 }}>DO NEXT</span>}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 1 }}>{step.hint}</div>
                {attempts.map((a, j) => (
                  <div key={a.id ?? j} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--muted)", marginTop: 3 }}>
                    <span>{fmtTime(a.created_at)} · {OUTCOME_LABEL[a.outcome] ?? a.outcome}{a.note ? ` — ${a.note}` : ""}{a.staff ? ` (${a.staff})` : ""}</span>
                    {a.id && (
                      <form action={undoMealContact} style={{ display: "inline" }}>
                        <input type="hidden" name="id" value={a.id} />
                        <SubmitButton pendingLabel="…" doneLabel="✓" style={{ border: "none", background: "transparent", color: "var(--brand-text)", fontSize: 11, fontWeight: 600, cursor: "pointer", padding: 0 }}>Undo</SubmitButton>
                      </form>
                    )}
                  </div>
                ))}
                <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap", alignItems: "center" }}>
                  {!attempted && action(step.channel, step.attempt.outcome, step.attempt.label, isNext)}
                  {attempted && !positive && !negative && (
                    <>
                      <span style={{ fontSize: 11.5, color: "var(--muted)" }}>Did they respond?</span>
                      {step.resolve.map((r) => action(step.channel, r.outcome, r.label, Boolean(r.positive)))}
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Note + one-line status, at the bottom. The note rides along with the
          next action you log. */}
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note to the next step (optional)…" style={{ ...inp, width: "100%", boxSizing: "border-box", marginTop: 10 }} />
      <div style={{ marginTop: 8 }}>
        {reached
          ? <span style={{ background: "var(--blue-bg)", color: "var(--blue-text)", borderRadius: 999, padding: "3px 11px", fontSize: 11.5, fontWeight: 700 }}>Reached — waiting for them to log</span>
          : contacts.length
          ? <span style={{ background: "var(--amber-bg)", color: "var(--amber-text)", borderRadius: 999, padding: "3px 11px", fontSize: 11.5, fontWeight: 700 }}>No response yet — keep escalating</span>
          : <span style={{ background: "var(--neutral-bg)", color: "var(--muted)", borderRadius: 999, padding: "3px 11px", fontSize: 11.5, fontWeight: 700 }}>Not contacted yet</span>}
      </div>
    </div>
  );
}
