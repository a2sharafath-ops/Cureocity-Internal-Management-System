import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canSee, canManageSops } from "@/lib/roles";
import { deleteSop } from "@/lib/actions";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import SopForm from "@/components/SopForm";

export const dynamic = "force-dynamic";

type Sop = { id: string; title: string; category: string; content: string | null; updated_by: string | null; updated_at: string };

export default async function KbPage() {
  const me = await getProfile();
  if (!me || !canSee(me.role, "/kb")) redirect("/dashboard");
  const canEdit = canManageSops(me.role);

  const supabase = createClient();
  const { data } = await supabase.from("sops").select("id, title, category, content, updated_by, updated_at").order("category").order("title");
  const sops = (data ?? []) as Sop[];

  const catColor: Record<string, [string, string]> = {
    Operations: ["var(--brand-tint)", "var(--brand-text)"], Clinical: ["var(--blue-bg)", "var(--blue)"],
    Compliance: ["var(--amber-bg)", "var(--amber-text-soft)"], HR: ["var(--purple-bg)", "var(--purple-text)"],
  };

  return (
    <div style={{ maxWidth: 900 }}>
      <RealtimeRefresh tables={["sops"]} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>SOP&apos;s</h1>
        <span style={{ flex: 1 }} />
        {canEdit && <SopForm />}
      </div>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "6px 0 16px" }}>Standard operating procedures, policies and internal guides.</p>

      <div style={{ display: "grid", gap: 12 }}>
        {sops.map((s) => {
          const [bg, c] = catColor[s.category] ?? ["var(--neutral-bg)", "var(--muted)"];
          return (
            <div key={s.id} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <b style={{ fontSize: 15 }}>{s.title}</b>
                <span style={{ background: bg, color: c, borderRadius: 999, padding: "2px 9px", fontSize: 11, fontWeight: 600 }}>{s.category}</span>
                <span style={{ flex: 1 }} />
                <span style={{ color: "var(--muted)", fontSize: 12 }}>updated {s.updated_at.slice(0, 10)}{s.updated_by ? ` · ${s.updated_by}` : ""}</span>
                {canEdit && (
                  <form action={deleteSop}><input type="hidden" name="id" value={s.id} /><button type="submit" title="Remove" style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "2px 8px", fontSize: 12, cursor: "pointer", color: "var(--muted)" }}>✕</button></form>
                )}
              </div>
              <div style={{ fontSize: 14, whiteSpace: "pre-wrap", lineHeight: 1.55, color: "#334155" }}>{s.content ?? "—"}</div>
            </div>
          );
        })}
        {sops.length === 0 && <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "22px 16px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>No SOPs yet.</div>}
      </div>
    </div>
  );
}
