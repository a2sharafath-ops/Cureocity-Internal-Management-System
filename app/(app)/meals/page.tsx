import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canSee, isClinician } from "@/lib/roles";
import { MEALS, type MealLog } from "@/lib/meals";
import MealStaffCell from "@/components/MealStaffCell";
import MealContactLadder, { type Contact } from "@/components/MealContactLadder";
import ClientStatusBadge from "@/components/ClientStatusBadge";
import { loadClientStatuses, clientStatus, disciplineForRole } from "@/lib/client-status";

import RealtimeRefresh from "@/components/RealtimeRefresh";

import { todayISO, todayLabel } from "@/lib/today";

export const dynamic = "force-dynamic";

const TODAY = todayISO();

export default async function MealsPage() {
  const me = await getProfile();
  if (!me || !canSee(me.role, "/meals")) redirect("/dashboard");

  const supabase = createClient();
  // Diet clients = clients on an active Comprehensive / BluePrint package (from
  // client_packages — the source of truth, not the legacy clients.package_id).
  const { data: cpRows } = await supabase
    .from("client_packages").select("client_id").eq("status", "active").in("category", ["comprehensive", "blueprint"]);
  let dietIds = new Set(((cpRows ?? []) as { client_id: string }[]).map((r) => r.client_id));

  // A dietitian sees their OWN diet clients: those assigned to them for the diet
  // discipline, plus anyone they have a booked appointment with. Admin / Manager
  // keep the clinic-wide view.
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

  // Today's follow-up contact attempts (the escalation ladder), per client.
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

  return (
    <div style={{ maxWidth: 1040 }}>
      <RealtimeRefresh tables={["meal_logs", "meal_contacts"]} />
      <h1 style={{ fontSize: 20, margin: "0 0 4px" }}>Meal Monitoring{scopedToMe ? "" : " · all diet clients"}</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 18px" }}>
        Today {todayLabel()} · review logged meals, nudge missing ones, answer questions · {clients.length} client{clients.length === 1 ? "" : "s"}
      </p>

      {clients.length === 0 ? (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "18px 20px", color: "var(--muted)", fontSize: 13 }}>
          {scopedToMe
            ? "No diet clients assigned to you yet — a client shows here once they're on a Comprehensive / BluePrint plan and assigned or booked with you."
            : "No clients on a Comprehensive / BluePrint package yet."}
        </div>
      ) : (
        clients.map((c) => {
          const pending = MEALS.filter((m) => {
            const l = map.get(key(c.id, m.key));
            return (!l?.description && !l?.nudged) || (l?.description && !l?.review) || (l?.doubt && !l?.doubt_answer);
          }).length;
          return (
            <div key={c.id} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "16px 18px", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
                <Link href={`/clients/${c.id}`} style={{ fontWeight: 700, fontSize: 15, color: "var(--ink)", textDecoration: "none" }}>{c.name}</Link>
                <span style={{ marginLeft: 8 }}><ClientStatusBadge status={clientStatus(statusMap.get(c.id), viewerDisc)} size="sm" /></span>
                <span style={{ flex: 1 }} />
                {pending > 0
                  ? <span style={{ background: "var(--amber-bg)", color: "var(--amber-text)", borderRadius: 999, padding: "2px 10px", fontSize: 12, fontWeight: 600 }}>{pending} to action</span>
                  : <span style={{ background: "var(--green-bg)", color: "var(--green-text)", borderRadius: 999, padding: "2px 10px", fontSize: 12, fontWeight: 600 }}>All caught up</span>}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                {MEALS.map((m) => (
                  <MealStaffCell key={m.key} clientId={c.id} meal={m.key} label={m.label} icon={m.icon} log={map.get(key(c.id, m.key)) ?? null} />
                ))}
              </div>
              <MealContactLadder clientId={c.id} date={TODAY} logged={loggedSet.has(c.id)} contacts={contactsByClient.get(c.id) ?? []} />
            </div>
          );
        })
      )}
    </div>
  );
}
