import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canSee } from "@/lib/roles";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import ServiceForm from "@/components/ServiceForm";
import ServiceRow, { type Svc } from "@/components/ServiceRow";

export const dynamic = "force-dynamic";

export default async function ServicesPage() {
  const me = await getProfile();
  if (!me || !canSee(me.role, "/services")) redirect("/dashboard");

  const supabase = await createClient();
  const { data } = await supabase.from("services").select("id, name, category, mode, slot_based, day_offset, active").order("category").order("name");
  const services = (data ?? []) as Svc[];

  const byCat = new Map<string, Svc[]>();
  for (const s of services) (byCat.get(s.category) ?? byCat.set(s.category, []).get(s.category)!).push(s);

  const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };

  return (
    <div style={{ maxWidth: 940 }}>
      <RealtimeRefresh tables={["services"]} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>Services</h1>
        <span style={{ flex: 1 }} />
        <ServiceForm />
      </div>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "6px 0 16px" }}>Master service list — the catalogue behind your packages.</p>

      {/* One datalist for the whole page: the add form and every edit row share
          it. Seeded with the categories already in use so the list grows with
          the catalogue rather than going stale in the markup. */}
      <datalist id="svc-cats">
        {[...new Set([...byCat.keys(), "Doctor Consultation", "Diet Consultation", "Fitness Services", "Counselling", "Assessment"])]
          .sort().map((c) => <option key={c} value={c} />)}
      </datalist>

      {[...byCat.entries()].map(([cat, list]) => (
        <div key={cat} style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".4px", margin: "0 0 6px" }}>{cat}</div>
          <div style={{ ...box, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                {list.map((s) => <ServiceRow key={s.id} s={s} />)}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      {services.length === 0 && <div style={{ ...box, padding: "22px 16px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>No services yet.</div>}
    </div>
  );
}
