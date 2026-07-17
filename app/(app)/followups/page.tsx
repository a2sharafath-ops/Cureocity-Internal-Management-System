import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canSee, canWrite } from "@/lib/roles";
import { todayISO } from "@/lib/today";
import { generateFollowups } from "@/lib/actions";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import FollowupsQueue, { type FuRow } from "@/components/FollowupsQueue";

export const dynamic = "force-dynamic";

export default async function FollowupsPage() {
  const me = await getProfile();
  if (!me || !canSee(me.role, "/followups")) redirect("/dashboard");
  const writer = canWrite(me.role);
  const today = todayISO();
  const supabase = createClient();

  const { data } = await supabase
    .from("followups")
    .select("id, client_id, label, category, day, due_date, mode, stage, token, reminder_sent, no_answer, priority, clients(id, name)")
    .order("due_date")
    .limit(300);

  const items: FuRow[] = ((data ?? []) as unknown as {
    id: string; client_id: string | null; label: string; category: string | null; day: number | null;
    due_date: string; mode: string; stage: string; token: string | null; reminder_sent: boolean; no_answer: boolean;
    priority: string; clients: { id: string; name: string } | null;
  }[]).map((f) => ({
    id: f.id, clientId: f.clients?.id ?? f.client_id, clientName: f.clients?.name ?? null, label: f.label,
    category: f.category, day: f.day, due_date: f.due_date, mode: f.mode ?? "Offline", stage: f.stage ?? "PENDING_CALL",
    token: f.token, reminder_sent: !!f.reminder_sent, no_answer: !!f.no_answer, priority: f.priority,
  }));

  return (
    <div style={{ maxWidth: 1120 }}>
      <RealtimeRefresh tables={["followups"]} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 2 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>Follow-ups</h1>
        <span style={{ flex: 1 }} />
        {writer && (
          <form action={generateFollowups}>
            <button type="submit" style={{ background: "var(--teal)", color: "#fff", border: "none", borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>⚙️ Generate due</button>
          </form>
        )}
      </div>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "6px 0 16px" }}>Smart scheduler — Day 2 / 10 / 21 / 28 protocol &amp; renewals. Call → send link → consultant review → close.</p>

      <FollowupsQueue items={items} today={today} canWrite={writer} />
    </div>
  );
}
