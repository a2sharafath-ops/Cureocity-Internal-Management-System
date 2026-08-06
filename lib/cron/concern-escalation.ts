// Concerns nobody has answered.
//
// A concern is raised against a client and belongs to their Health Coach from
// that moment — including the ones raised as "general", which used to resolve
// to no discipline at all and sit on the whiteboard as an orange alert nobody
// was asked to answer.
//
// This sweep is the second half of that: after CONCERN_ESCALATION_DAYS the
// concern stops being the coach's alone and the Medical Director hears about
// it. The clinical lead is the backstop, so nothing a client raised can sit
// open indefinitely because one person was on leave.
//
// Escalation is computed from age, not stored. There is no `escalated` column
// to set, forget to set, or leave stale after somebody closes the concern —
// a concern is escalated because it is old, and stops being escalated the
// moment its status changes.

import { notifyRoles } from "@/lib/notify";
import { CONCERN_ESCALATION_OWNER, CONCERN_ESCALATION_DAYS } from "@/lib/work-owners";

type Sb = { from: (t: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any

const daysSince = (iso: string, today: string) =>
  Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${iso.slice(0, 10)}T00:00:00Z`)) / 86_400_000);

export async function runConcernEscalation(supabase: Sb, today: string) {
  const { data } = await supabase
    .from("concerns")
    .select("id, client_id, body, role, created_at, clients(name)")
    .eq("status", "Open");

  const rows = (data ?? []) as unknown as {
    id: string; client_id: string | null; body: string; role: string | null;
    created_at: string | null; clients: { name: string } | null;
  }[];

  const due = rows.filter((c) => c.created_at && daysSince(c.created_at, today) >= CONCERN_ESCALATION_DAYS);
  if (!due.length) return { scanned: rows.length, escalated: 0 };

  // One digest, not one notification per concern. A director who opens their
  // bell to fourteen separate lines reads none of them; a single "4 concerns
  // unanswered" with the oldest named is actionable.
  const oldest = due.reduce((a, b) => (daysSince(a.created_at!, today) > daysSince(b.created_at!, today) ? a : b));
  const oldestDays = daysSince(oldest.created_at!, today);

  await notifyRoles(supabase, CONCERN_ESCALATION_OWNER, {
    title: `${due.length} client concern${due.length === 1 ? "" : "s"} unanswered`,
    body: `Open ${CONCERN_ESCALATION_DAYS}+ days · oldest: ${oldest.clients?.name ?? "a client"} — ${oldestDays} days`,
    href: "/whiteboard",
    icon: "🔔",
  });

  return { scanned: rows.length, escalated: due.length };
}
