import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canSee } from "@/lib/roles";
import { MEALS, type MealLog } from "@/lib/meals";
import MealStaffCell from "@/components/MealStaffCell";

export const dynamic = "force-dynamic";

const TODAY = "2026-07-02";

export default async function MealsPage() {
  const me = await getProfile();
  if (!me || !canSee(me.role, "/meals")) redirect("/dashboard");

  const supabase = createClient();
  // diet clients = Comprehensive or BluePrint packages
  const { data: clientData } = await supabase
    .from("clients")
    .select("id, name, package_id")
    .or("package_id.like.comp%,package_id.eq.bp1")
    .order("name");
  const clients = (clientData ?? []) as { id: string; name: string; package_id: string | null }[];

  const ids = clients.map((c) => c.id);
  const { data: logData } = ids.length
    ? await supabase.from("meal_logs").select("*").eq("date", TODAY).in("client_id", ids)
    : { data: [] };
  const logs = (logData ?? []) as MealLog[];
  const key = (cid: string, meal: string) => cid + "|" + meal;
  const map = new Map(logs.map((l) => [key(l.client_id, l.meal), l]));

  return (
    <div style={{ maxWidth: 1040 }}>
      <h1 style={{ fontSize: 20, margin: "0 0 4px" }}>Meal Monitoring</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 18px" }}>
        Today Thu, Jul 2 · review logged meals, nudge missing ones, answer questions · {clients.length} client{clients.length === 1 ? "" : "s"}
      </p>

      {clients.length === 0 ? (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "18px 20px", color: "var(--muted)", fontSize: 13 }}>
          No diet clients (Comprehensive / BluePrint) yet.
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
                <span style={{ flex: 1 }} />
                {pending > 0
                  ? <span style={{ background: "var(--amber-bg)", color: "#92400e", borderRadius: 999, padding: "2px 10px", fontSize: 12, fontWeight: 600 }}>{pending} to action</span>
                  : <span style={{ background: "var(--green-bg)", color: "#166534", borderRadius: 999, padding: "2px 10px", fontSize: 12, fontWeight: 600 }}>All caught up</span>}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                {MEALS.map((m) => (
                  <MealStaffCell key={m.key} clientId={c.id} meal={m.key} label={m.label} icon={m.icon} log={map.get(key(c.id, m.key)) ?? null} />
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
