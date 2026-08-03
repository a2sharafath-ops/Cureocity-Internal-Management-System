"use client";
import { IST } from "@/lib/datetime";

import { useState } from "react";
import type { Contact } from "@/components/MealContactLadder";

const CH: Record<string, string> = { portal: "Portal", whatsapp: "WhatsApp", call: "Call", meet: "In-person" };
const OUT: Record<string, string> = {
  sent: "reminder sent", called: "called", visited: "visited",
  replied: "replied", reached: "reached", met: "met",
  not_replied: "no reply", no_answer: "no answer", no_response: "no answer", refused: "refused to meet",
};

// Past-days follow-up attempts for one client, grouped by date. Collapsed by
// default so it doesn't clutter the day's board.
export default function MealFollowupHistory({ entries }: { entries: Contact[] }) {
  const [open, setOpen] = useState(false);
  if (!entries.length) return null;

  const byDate = new Map<string, Contact[]>();
  for (const e of entries) {
    // created_at carries the day; the row's `date` field would be ideal but the
    // list is already filtered to past days, so group by the calendar date.
    const d = new Date(e.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: IST });
    (byDate.get(d) ?? byDate.set(d, []).get(d)!).push(e);
  }

  return (
    <div style={{ marginTop: 8 }}>
      <button type="button" onClick={() => setOpen((o) => !o)} style={{ border: "none", background: "transparent", color: "var(--brand-text)", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0 }}>
        {open ? "Hide" : "View"} past follow-ups ({entries.length}) {open ? "▲" : "▼"}
      </button>
      {open && (
        <div style={{ marginTop: 8, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px" }}>
          {[...byDate.entries()].map(([d, list]) => (
            <div key={d} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".3px", marginBottom: 3 }}>{d}</div>
              {list.map((e, i) => (
                <div key={i} style={{ fontSize: 12, color: "var(--ink)", padding: "2px 0" }}>
                  <span style={{ color: "var(--muted)" }}>{new Date(e.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: IST })}</span>
                  {" · "}{CH[e.channel] ?? e.channel} · {OUT[e.outcome] ?? e.outcome}
                  {e.note ? ` — ${e.note}` : ""}{e.staff ? ` (${e.staff})` : ""}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
