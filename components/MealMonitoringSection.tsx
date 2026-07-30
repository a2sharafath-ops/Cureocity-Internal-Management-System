import { createClient } from "@/lib/supabase/server";
import { isClinician } from "@/lib/roles";
import { MEALS, type MealLog } from "@/lib/meals";
import MealStaffCell from "@/components/MealStaffCell";
import MealContactLadder, { type Contact } from "@/components/MealContactLadder";
import MealClientCard from "@/components/MealClientCard";
import ClientStatusBadge from "@/components/ClientStatusBadge";
import { loadClientStatuses, clientStatus, disciplineForRole } from "@/lib/client-status";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import { todayISO, todayLabel } from "@/lib/today";

// Dietitian meal-monitoring — reused both as the standalone /meals page and as
// the "Meal Monitoring" tab inside the workspace. Fetches its own data, scoped
// to the viewing clinician (admins/managers see the clinic-wide view).
export default async function MealMonitoringSection({
  me, heading = false,
}: {
  me: { role: string; staffId?: string | null };
  /** show a page-level H1 (standalone page); off inside the workspace tab. */
  heading?: boolean;
}) {
  const TODAY = todayISO();
  const supabase = createClient();

  // Diet clients = clients on an active Comprehensive / BluePrint package.
  const { data: cpRows } = await supabase
    .from("client_packages").select("client_id").eq("status", "active").in("category", ["comprehensive", "blueprint"]);
  let dietIds = new Set(((cpRows ?? []) as { client_id: string }[]).map((r) => r.client_id));

  // A dietitian sees their OWN diet clients (assigned or booked with them);
  // Admin / Manager keep the clinic-wide view.
  const scopedToMe = isClinician(me.role) && Boolean(me.staffId);
  if (scopedToMe) {
    const [{ data: asg }, { data: appt }] = await Promise.all([
      supabase.from("client_assignments").select("client_id").eq("discipline", "dietitian").eq("staff_id", me.staffId),
      supabase.from("appointments").select("client_id").eq("provider_id", me.staffId).neq("status", "cancelled").not("client_id", "is", null),
    ]);
    const mine = new Set<string>([
      ...((asg ?? []) as { client_id: string }[]).map((a) => a.client_id),
      ...((appt ?? []) as { client_id: string | null }[]).map((a) => a.client_id).filter((x): x is string => Boolean(x)),
    ]);
    dietIds = new Set([...dietIds].filter((id) => mine.has(id)));
  }

  const { data: clientData } = dietIds.size
    ? await supabase.from("clients").select("id, name, package_id").in("id", [...dietIds]).order("name")
    : { data: [] };
  const clients = (clientData ?? []) as { id: string; name: string; package_id: string | null }[];

  const ids = clients.map((c) => c.id);
  const { data: logData } = ids.length
    ? await supabase.from("meal_logs").select("*").eq("date", TODAY).in("client_id", ids)
    : { data: [] };
  const logs = (logData ?? []) as MealLog[];
  const key = (cid: string, meal: string) => cid + "|" + meal;
  const map = new Map(logs.map((l) => [key(l.client_id, l.meal), l]));

  const { data: contactData } = ids.length
    ? await supabase.from("meal_contacts").select("client_id, channel, outcome, note, staff, created_at").eq("date", TODAY).in("client_id", ids).order("created_at")
    : { data: [] };
  const contactsByClient = new Map<string, Contact[]>();
  for (const c of (contactData ?? []) as (Contact & { client_id: string })[]) {
    const arr = contactsByClient.get(c.client_id) ?? [];
    arr.push({ channel: c.channel, outcome: c.outcome, note: c.note, staff: c.staff, created_at: c.created_at });
    contactsByClient.set(c.client_id, arr);
  }
  const loggedSet = new Set(logs.filter((l) => l.description).map((l) => l.client_id));

  const statusMap = await loadClientStatuses(supabase, ids, TODAY);
  const viewerDisc = disciplineForRole(me.role);

  const pendingOf = (cid: string) => MEALS.filter((m) => {
    const l = map.get(key(cid, m.key));
    return (!l?.description && !l?.nudged) || (l?.description && !l?.review) || (l?.doubt && !l?.doubt_answer);
  }).length;
  // Clients needing action float to the top so a long list stays scannable.
  const sorted = [...clients].sort((a, b) => pendingOf(b.id) - pendingOf(a.id) || a.name.localeCompare(b.name));
  const needAction = sorted.filter((c) => pendingOf(c.id) > 0).length;

  return (
    <div style={{ maxWidth: 1040 }}>
      <RealtimeRefresh tables={["meal_logs", "meal_contacts"]} />
      {heading && <h1 style={{ fontSize: 20, margin: "0 0 4px" }}>Meal Monitoring{scopedToMe ? "" : " · all diet clients"}</h1>}
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 18px" }}>
        Today {todayLabel()} · {clients.length} client{clients.length === 1 ? "" : "s"}
        {clients.length > 0 && ` · ${needAction} need action`} · review logged meals, log or nudge missing ones, answer questions
      </p>

      {clients.length === 0 ? (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "18px 20px", color: "var(--muted)", fontSize: 13 }}>
          {scopedToMe
            ? "No diet clients assigned to you yet — a client shows here once they're on a Comprehensive / BluePrint plan and assigned or booked with you."
            : "No clients on a Comprehensive / BluePrint package yet."}
        </div>
      ) : (
        sorted.map((c) => {
          const pending = pendingOf(c.id);
          return (
            <MealClientCard
              key={c.id}
              clientId={c.id}
              name={c.name}
              pending={pending}
              defaultOpen={pending > 0}
              badge={<ClientStatusBadge status={clientStatus(statusMap.get(c.id), viewerDisc)} size="sm" />}
            >
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                {MEALS.map((m) => (
                  <MealStaffCell key={m.key} clientId={c.id} meal={m.key} label={m.label} icon={m.icon} log={map.get(key(c.id, m.key)) ?? null} />
                ))}
              </div>
              <MealContactLadder clientId={c.id} date={TODAY} logged={loggedSet.has(c.id)} contacts={contactsByClient.get(c.id) ?? []} />
            </MealClientCard>
          );
        })
      )}
    </div>
  );
}
