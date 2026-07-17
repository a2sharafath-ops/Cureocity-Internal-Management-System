// Front-desk follow-up protocol. Onboarding touchpoints at fixed day-offsets
// from a client's join date, plus a renewal nudge 7 days before a subscription
// renews. Pure row builder shared by the server action and the daily cron.

export const ONBOARDING_OFFSETS = [2, 10, 21, 28];
export const RENEWAL_LEAD_DAYS = 7;

function addDaysUTC(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export type FollowupRow = {
  client_id: string; kind: string; label: string; due_date: string;
  priority: string; created_by: string; category: string; day: number | null; mode: string; stage: string;
};

// Protocol day → discipline + label + default mode (mirrors the prototype care plan).
const DAY_PROTOCOL: Record<number, { category: string; label: string; mode: string }> = {
  2:  { category: "Fitness Services",     label: "Day 2 fitness check-in",  mode: "Offline" },
  10: { category: "Diet Consultation",   label: "Day 10 diet follow-up",   mode: "Online" },
  21: { category: "Diet Consultation",   label: "Day 21 diet review",      mode: "Offline" },
  28: { category: "Doctor Consultation", label: "Day 28 doctor follow-up", mode: "Offline" },
};

export function buildFollowupRows(
  clients: { id: string; joined: string | null }[],
  subs: { client_id: string; renews_on: string | null }[],
  createdBy: string,
): FollowupRow[] {
  const rows: FollowupRow[] = [];
  for (const c of clients) {
    if (!c.joined) continue;
    for (const off of ONBOARDING_OFFSETS) {
      const p = DAY_PROTOCOL[off];
      rows.push({
        client_id: c.id, kind: "onboarding", label: p.label,
        due_date: addDaysUTC(c.joined, off), priority: off === 2 ? "mandatory" : "normal", created_by: createdBy,
        category: p.category, day: off, mode: p.mode, stage: "PENDING_CALL",
      });
    }
  }
  for (const s of subs) {
    if (!s.renews_on) continue;
    rows.push({
      client_id: s.client_id, kind: "renewal", label: `Renewal due (${s.renews_on})`,
      due_date: addDaysUTC(s.renews_on, -RENEWAL_LEAD_DAYS), priority: "mandatory", created_by: createdBy,
      category: "Renewal", day: null, mode: "Online", stage: "PENDING_CALL",
    });
  }
  return rows;
}
