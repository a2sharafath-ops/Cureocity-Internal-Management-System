import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canSee, canWrite, canWorkFollowups, isClinician } from "@/lib/roles";
import { todayISO } from "@/lib/today";
import { generateFollowups } from "@/lib/actions";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import FollowupsQueue, { type FuRow } from "@/components/FollowupsQueue";
import { loadClientStatuses, clientStatus, disciplineForRole, type ClientStatus } from "@/lib/client-status";

export const dynamic = "force-dynamic";

export default async function FollowupsPage() {
  const me = await getProfile();
  if (!me || !canSee(me.role, "/followups")) redirect("/dashboard");
  const writer = canWorkFollowups(me.role);
  // Bulk "Generate due" stays an ops action; the coach works the queue but
  // doesn't regenerate it.
  const canGenerate = canWrite(me.role);
  const today = todayISO();
  const supabase = createClient();

  // Scoped to the viewer.
  //
  // This was one unfiltered list of the whole clinic, capped at 300 rows. Two
  // problems: a Health Coach saw — and could action — every other coach's
  // clients, and once the clinic passed 300 open follow-ups the oldest simply
  // vanished off the end, which is exactly the row most likely to be overdue.
  //
  // Ops roles still see everything; that is their job. A Health Professional
  // sees the clients on their own care team.
  const scopeToMe = isClinician(me.role) && Boolean(me.staffId);
  let myClientIds: string[] | null = null;
  if (scopeToMe) {
    const disc = disciplineForRole(me.role);
    const { data: asg } = await supabase
      .from("client_assignments").select("client_id")
      .eq("staff_id", me.staffId!).eq("discipline", disc ?? "");
    myClientIds = ((asg ?? []) as { client_id: string }[]).map((a) => a.client_id);
  }

  let q = supabase
    .from("followups")
    .select("id, client_id, label, category, day, due_date, mode, stage, token, reminder_sent, no_answer, priority, clients(id, name)")
    // Oldest first, and the cap raised: a queue that silently drops its tail
    // hides the very rows it exists to surface.
    .order("due_date")
    .limit(1000);
  if (myClientIds) q = q.in("client_id", myClientIds.length ? myClientIds : ["00000000-0000-0000-0000-000000000000"]);
  const { data } = await q;

  const items: FuRow[] = ((data ?? []) as unknown as {
    id: string; client_id: string | null; label: string; category: string | null; day: number | null;
    due_date: string; mode: string; stage: string; token: string | null; reminder_sent: boolean; no_answer: boolean;
    priority: string; clients: { id: string; name: string } | null;
  }[]).map((f) => ({
    id: f.id, clientId: f.clients?.id ?? f.client_id, clientName: f.clients?.name ?? null, label: f.label,
    category: f.category, day: f.day, due_date: f.due_date, mode: f.mode ?? "Offline", stage: f.stage ?? "PENDING_CALL",
    token: f.token, reminder_sent: !!f.reminder_sent, no_answer: !!f.no_answer, priority: f.priority,
  }));

  const fuIds = Array.from(new Set(items.map((i) => i.clientId).filter(Boolean))) as string[];
  const fuStatuses = await loadClientStatuses(supabase, fuIds, today);
  const fuDisc = disciplineForRole(me.role);
  const statusByClient: Record<string, ClientStatus> = {};
  for (const id of fuIds) statusByClient[id] = clientStatus(fuStatuses.get(id), fuDisc);

  return (
    <div style={{ maxWidth: 1120 }}>
      <RealtimeRefresh tables={["followups"]} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 2 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>Follow-ups</h1>
        <span style={{ flex: 1 }} />
        {canGenerate && (
          <form action={generateFollowups}>
            <button type="submit" style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Generate due</button>
          </form>
        )}
      </div>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "6px 0 16px" }}>Smart scheduler — Day 2 / 10 / 21 / 28 protocol &amp; renewals. Call → send link → consultant review → close.</p>

      <FollowupsQueue items={items} today={today} canWrite={writer} statusByClient={statusByClient} />
    </div>
  );
}
