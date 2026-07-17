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
  priority: string; created_by: string;
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
      rows.push({
        client_id: c.id, kind: "onboarding", label: `Day ${off} check-in`,
        due_date: addDaysUTC(c.joined, off), priority: off === 2 ? "mandatory" : "normal", created_by: createdBy,
      });
    }
  }
  for (const s of subs) {
    if (!s.renews_on) continue;
    rows.push({
      client_id: s.client_id, kind: "renewal", label: `Renewal due (${s.renews_on})`,
      due_date: addDaysUTC(s.renews_on, -RENEWAL_LEAD_DAYS), priority: "mandatory", created_by: createdBy,
    });
  }
  return rows;
}
