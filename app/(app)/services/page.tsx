import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canSee } from "@/lib/roles";
import { toggleService } from "@/lib/actions";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import ServiceForm from "@/components/ServiceForm";

export const dynamic = "force-dynamic";

type Svc = { id: string; name: string; category: string; mode: string; slot_based: boolean; day_offset: number | null; active: boolean };

export default async function ServicesPage() {
  const me = await getProfile();
  if (!me || !canSee(me.role, "/services")) redirect("/dashboard");

  const supabase = createClient();
  const { data } = await supabase.from("services").select("id, name, category, mode, slot_based, day_offset, active").order("category").order("name");
  const services = (data ?? []) as Svc[];

  const byCat = new Map<string, Svc[]>();
  for (const s of services) (byCat.get(s.category) ?? byCat.set(s.category, []).get(s.category)!).push(s);

  const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
  const td: React.CSSProperties = { padding: "10px 16px", fontSize: 14 };

  return (
    <div style={{ maxWidth: 940 }}>
      <RealtimeRefresh tables={["services"]} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>Services</h1>
        <span style={{ flex: 1 }} />
        <ServiceForm />
      </div>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "6px 0 16px" }}>Master service list — the catalogue behind your packages.</p>

      {[...byCat.entries()].map(([cat, list]) => (
        <div key={cat} style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".4px", margin: "0 0 6px" }}>{cat}</div>
          <div style={{ ...box, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                {list.map((s) => (
                  <tr key={s.id} style={{ borderTop: "1px solid var(--border)", opacity: s.active ? 1 : 0.5 }}>
                    <td style={{ ...td, fontWeight: 600 }}>{s.name}</td>
                    <td style={{ ...td, color: "var(--muted)", fontSize: 13 }}>{s.mode}{s.slot_based ? " · slot-based" : ""}{s.day_offset != null ? ` · Day ${s.day_offset}` : ""}</td>
                    <td style={{ ...td, textAlign: "right" }}>
                      <form action={toggleService}>
                        <input type="hidden" name="id" value={s.id} /><input type="hidden" name="to" value={String(!s.active)} />
                        <button type="submit" style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "3px 10px", fontSize: 12, cursor: "pointer", color: s.active ? "var(--muted)" : "var(--brand-text)" }}>{s.active ? "Deactivate" : "Activate"}</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      {services.length === 0 && <div style={{ ...box, padding: "22px 16px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>No services yet.</div>}
    </div>
  );
}
