// Nightly "leads with no next step" digest.
//
// The sibling sweep (lead-followups.ts) chases callbacks somebody scheduled.
// This one covers the opposite and larger case: leads nobody has committed to
// at all. When this was written that was 847 of 999 leads, none of which any
// automation could see.
//
// Deliberately a DIGEST, one per owner per day, not a per-lead alert. A
// per-lead sweep would have fired ~818 times on the first night; the second
// night nobody would be reading notifications any more. See lib/lead-coverage.ts
// for the banding rationale.

import { byOwner, digestBody, digestTitle, shouldNotify, type CoverageLead } from "@/lib/lead-coverage";
import { notifyStaff } from "@/lib/notify";

type AnyClient = { from: (t: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any

/** Once-only guard. Uses automation_events (0084), not blueprint_sla_events —
 *  the latter's client_id is an FK to clients and a staff id is not a client. */
const PROTOCOL = "lead";
const GATE = "coverage-digest";
const KIND = "digest";

export async function runLeadCoverage(supabase: AnyClient, todayISO: string) {
  const { data: leadRows } = await supabase
    .from("leads")
    .select("id, owner_id, stage, created_at, next_follow_up, disqualified_at");

  const leads = (leadRows ?? []) as CoverageLead[];
  const groups = byOwner(leads, todayISO);
  if (!groups.size) return { owners: 0, sent: 0, leads: 0 };

  // One digest per owner per DAY — the gate carries the date, so a re-run of
  // the cron on the same day is a no-op but tomorrow starts fresh.
  const gate = `${GATE}:${todayISO}`;
  const ownerIds = [...groups.keys()];
  const { data: seen } = await supabase
    .from("automation_events")
    .select("subject_id")
    .eq("protocol", PROTOCOL).eq("gate", gate).eq("kind", KIND)
    .in("subject_id", ownerIds);
  const already = new Set(((seen ?? []) as { subject_id: string }[]).map((e) => e.subject_id));

  let sent = 0, covered = 0;
  for (const [ownerId, summary] of groups) {
    covered += summary.total;
    if (!shouldNotify(summary) || already.has(ownerId)) continue;

    // Land them on the filtered list, not the whole book — a digest that opens
    // 999 rows makes the reader do the filtering again.
    const delivered = await notifyStaff(supabase, ownerId, {
      title: digestTitle(summary),
      body: digestBody(summary),
      // view=open matches the digest's own definition (not won, lost or
      // disqualified) so the count in the notification equals the rows shown.
      href: "/leads?view=open&due=none&mine=1",
      icon: "📋",
    });
    if (!delivered) continue;   // no linked login — don't burn the once-only gate

    await supabase.from("automation_events").upsert(
      { subject_id: ownerId, subject_kind: "staff", protocol: PROTOCOL, gate, kind: KIND,
        due_at: `${todayISO}T00:00:00Z` },
      { onConflict: "subject_id,protocol,gate,kind" },
    );
    sent++;
  }

  return { owners: groups.size, sent, leads: covered };
}
