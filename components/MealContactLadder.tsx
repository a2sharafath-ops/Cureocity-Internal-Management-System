"use client";

import { useState } from "react";
import { logMealContact } from "@/lib/actions";
import SubmitButton from "@/components/SubmitButton";

export type Contact = { channel: string; outcome: string; note: string | null; staff: string | null; created_at: string };

const CH_LABEL: Record<string, string> = { portal: "Portal", whatsapp: "WhatsApp", call: "Call", meet: "In-person" };

// The escalation ladder for a client who isn't logging their meals. The
// dietitian works down the rungs — WhatsApp reminder → phone call → visit in
// person — until they reach the client (or the client starts logging). Each
// action is recorded with a timestamp so the chase is auditable.
const STEPS: { channel: string; icon: string; title: string; hint: string; actions: { outcome: string; label: string; primary?: boolean }[] }[] = [
  { channel: "whatsapp", icon: "💬", title: "WhatsApp reminder", hint: "Nudge them to log — then record whether they replied", actions: [{ outcome: "replied", label: "Replied", primary: true }, { outcome: "not_replied", label: "Not replied" }] },
  { channel: "call", icon: "📞", title: "Phone call", hint: "No reply on WhatsApp — call them", actions: [{ outcome: "reached", label: "Reached them", primary: true }, { outcome: "no_response", label: "No answer" }] },
  { channel: "meet", icon: "🧑‍🤝‍🧑", title: "In-person", hint: "Still no response — catch them at the centre", actions: [{ outcome: "reached", label: "Met in person", primary: true }, { outcome: "refused", label: "Refused to meet" }] },
];

// Which outcomes mean we actually got the client's attention.
const POSITIVE = new Set(["reached", "replied"]);
const OUTCOME_LABEL: Record<string, string> = { reached: "reached", replied: "replied", no_response: "no answer", not_replied: "no reply", refused: "refused to meet" };

const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

export default function MealContactLadder({ clientId, date, logged, contacts }: { clientId: string; date: string; logged: boolean; contacts: Contact[] }) {
  const [note, setNote] = useState("");

  const reached = logged || contacts.some((c) => POSITIVE.has(c.outcome));
  const attemptsOn = (ch: string) => contacts.filter((c) => c.channel === ch);
  const done = (ch: string) => attemptsOn(ch).length > 0;
  // The rung to do next: the first step with no attempt yet (only while the
  // client is still unreached).
  const nextChannel = logged || reached ? null : STEPS.find((s) => !done(s.channel))?.channel ?? null;

  // Resolved state — nothing to chase.
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

  return (
    <div style={{ marginTop: 10, borderTop: "1px dashed var(--border)", paddingTop: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 10 }}>Follow-up ladder</div>

      {/* A shared note that rides along with the next action you log. */}
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note to the next step (optional)…" style={{ ...inp, width: "100%", boxSizing: "border-box", marginBottom: 10 }} />

      {/* The rungs */}
      <div style={{ display: "grid", gap: 8 }}>
        {STEPS.map((step, i) => {
          const attempts = attemptsOn(step.channel);
          const isDone = attempts.length > 0;
          const isNext = step.channel === nextChannel;
          const reachedHere = attempts.some((a) => POSITIVE.has(a.outcome));
          return (
            <div key={step.channel} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "9px 11px", borderRadius: 10, border: isNext ? "1px solid var(--brand-fill)" : "1px solid var(--border)", background: isNext ? "var(--brand-tint)" : reachedHere ? "var(--green-bg)" : isDone ? "var(--bg)" : "#fff" }}>
              {/* status dot */}
              <div style={{ width: 24, height: 24, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700, background: reachedHere ? "var(--green-text)" : isDone ? "var(--amber-text)" : "var(--neutral-bg)", color: reachedHere || isDone ? "#fff" : "var(--muted)" }}>
                {reachedHere ? "✓" : isDone ? "•" : i + 1}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{step.icon} {step.title}</span>
                  {isNext && <span style={{ background: "var(--brand-fill)", color: "#fff", borderRadius: 999, padding: "1px 8px", fontSize: 10, fontWeight: 700 }}>DO NEXT</span>}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 1 }}>{step.hint}</div>
                {/* logged attempts on this rung */}
                {attempts.map((a, j) => (
                  <div key={j} style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 3 }}>
                    {fmtTime(a.created_at)} · {OUTCOME_LABEL[a.outcome] ?? a.outcome}{a.note ? ` — ${a.note}` : ""}{a.staff ? ` (${a.staff})` : ""}
                  </div>
                ))}
                {/* actions */}
                <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                  {step.actions.map((act) => (
                    <form key={act.outcome} action={logMealContact}>
                      <input type="hidden" name="client_id" value={clientId} />
                      <input type="hidden" name="date" value={date} />
                      <input type="hidden" name="channel" value={step.channel} />
                      <input type="hidden" name="outcome" value={act.outcome} />
                      <input type="hidden" name="note" value={note} />
                      <SubmitButton persist pendingLabel="Saving…" doneLabel="✓ Logged"
                        style={act.primary && isNext
                          ? { border: "none", background: "var(--brand-fill)", color: "#fff", borderRadius: 8, padding: "5px 11px", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }
                          : { border: "1px solid var(--border)", background: "#fff", color: "var(--ink)", borderRadius: 8, padding: "5px 11px", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                        {act.label}
                      </SubmitButton>
                    </form>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* One-line status of the chase, at the bottom. */}
      <div style={{ marginTop: 10 }}>
        {reached
          ? <span style={{ background: "var(--blue-bg)", color: "var(--blue-text)", borderRadius: 999, padding: "3px 11px", fontSize: 11.5, fontWeight: 700 }}>Reached — waiting for them to log</span>
          : contacts.length
          ? <span style={{ background: "var(--amber-bg)", color: "var(--amber-text)", borderRadius: 999, padding: "3px 11px", fontSize: 11.5, fontWeight: 700 }}>No response yet — keep escalating</span>
          : <span style={{ background: "var(--neutral-bg)", color: "var(--muted)", borderRadius: 999, padding: "3px 11px", fontSize: 11.5, fontWeight: 700 }}>Not contacted yet</span>}
      </div>
    </div>
  );
}
