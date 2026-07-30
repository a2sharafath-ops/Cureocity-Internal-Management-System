"use client";

import { useState } from "react";
import { logMealContact } from "@/lib/actions";

export type Contact = { channel: string; outcome: string; note: string | null; staff: string | null; created_at: string };

const CH_LABEL: Record<string, string> = { portal: "Portal", whatsapp: "WhatsApp", call: "Call", meet: "In-person" };

export default function MealContactLadder({ clientId, date, logged, contacts }: { clientId: string; date: string; logged: boolean; contacts: Contact[] }) {
  const [note, setNote] = useState("");

  const reached = logged || contacts.some((c) => c.outcome === "reached");
  const has = (ch: string) => contacts.some((c) => c.channel === ch);
  // Suggested next escalation step when the client hasn't responded.
  const next = logged ? null
    : reached ? null
    : !has("whatsapp") ? "whatsapp"
    : !has("call") ? "call"
    : !has("meet") ? "meet"
    : null;

  const status = logged
    ? { t: "Logging via portal", bg: "var(--green-bg)", c: "var(--green-text)" }
    : reached
    ? { t: "Reached — awaiting logs", bg: "var(--blue-bg)", c: "var(--blue-text)" }
    : contacts.length
    ? { t: "No response yet", bg: "var(--amber-bg)", c: "var(--amber-text)" }
    : { t: "Not contacted", bg: "var(--neutral-bg)", c: "var(--muted)" };

  const inp: React.CSSProperties = { border: "1px solid var(--border)", borderRadius: 8, padding: "6px 9px", fontSize: 12.5, background: "#fff" };
  const Btn = ({ channel, outcome, label, hl }: { channel: string; outcome: string; label: string; hl?: boolean }) => (
    <form action={logMealContact} style={{ display: "inline" }}>
      <input type="hidden" name="client_id" value={clientId} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="channel" value={channel} />
      <input type="hidden" name="outcome" value={outcome} />
      <input type="hidden" name="note" value={note} />
      <button style={{ border: hl ? "none" : "1px solid var(--border)", background: hl ? "var(--brand-fill)" : "#fff", color: hl ? "#fff" : "var(--ink)", borderRadius: 8, padding: "5px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>{label}</button>
    </form>
  );

  return (
    <div style={{ marginTop: 10, borderTop: "1px dashed var(--border)", paddingTop: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".4px" }}>Follow-up</span>
        <span style={{ background: status.bg, color: status.c, borderRadius: 999, padding: "2px 9px", fontSize: 11, fontWeight: 600 }}>{status.t}</span>
        {next && <span style={{ fontSize: 11.5, color: "var(--muted)" }}>Next: {CH_LABEL[next]}</span>}
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" style={{ ...inp, width: 150 }} />
        <Btn channel="whatsapp" outcome="no_response" label="WhatsApp sent" hl={next === "whatsapp"} />
        <Btn channel="call" outcome="reached" label="Called ✓" hl={next === "call"} />
        <Btn channel="call" outcome="no_response" label="Called — no answer" />
        <Btn channel="meet" outcome="reached" label="Met in person" hl={next === "meet"} />
      </div>
      {contacts.length > 0 && (
        <div style={{ marginTop: 8, display: "grid", gap: 3 }}>
          {contacts.map((c, i) => (
            <div key={i} style={{ fontSize: 11.5, color: "var(--muted)" }}>
              {new Date(c.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} · {CH_LABEL[c.channel] ?? c.channel} · {c.outcome === "reached" ? "reached" : "no response"}{c.note ? ` — ${c.note}` : ""}{c.staff ? ` (${c.staff})` : ""}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
