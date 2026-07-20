import BackLink from "@/components/BackLink";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canSee } from "@/lib/roles";
import { toggleExercise } from "@/lib/actions";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import { ExerciseForm, TemplateForm } from "@/components/ExerciseForms";
import AssignWorkout from "@/components/AssignWorkout";

export const dynamic = "force-dynamic";

type Ex = { id: string; name: string; mode: string; type: string; active: boolean };
type Tpl = { id: string; name: string; mode: string; type: string; items: { exercise: string; sets?: string; reps?: string; rest?: string }[] };

export default async function ExlibPage() {
  const me = await getProfile();
  if (!me || !canSee(me.role, "/exlib")) redirect("/dashboard");

  const supabase = createClient();
  const [{ data: exData }, { data: tplData }, { data: clientData }] = await Promise.all([
    supabase.from("exercises").select("id, name, mode, type, active").order("type").order("name"),
    supabase.from("workout_templates").select("id, name, mode, type, items").order("created_at", { ascending: false }),
    supabase.from("clients").select("id, name").order("name"),
  ]);
  const exercises = (exData ?? []) as Ex[];
  const templates = (tplData ?? []) as unknown as Tpl[];
  const clients = (clientData ?? []) as { id: string; name: string }[];

  const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
  const td: React.CSSProperties = { padding: "8px 14px", fontSize: 14 };
  const typeChip = (t: string) => {
    const map: Record<string, [string, string]> = { Strength: ["var(--brand-tint)", "var(--brand-text)"], Cardio: ["var(--blue-bg)", "var(--blue)"], Mobility: ["var(--purple-bg)", "var(--purple-text)"] };
    const [bg, c] = map[t] ?? ["var(--neutral-bg)", "var(--muted)"];
    return <span style={{ background: bg, color: c, borderRadius: 999, padding: "1px 8px", fontSize: 11, fontWeight: 600 }}>{t}</span>;
  };

  return (
    <div style={{ maxWidth: 1000 }}>
      <RealtimeRefresh tables={["exercises", "workout_templates"]} />
      <BackLink />
      <h1 style={{ fontSize: 20, margin: "0 0 4px" }}>Exercise Library</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 16px" }}>Online/offline exercises &amp; reusable workout templates.</p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 16, alignItems: "start" }}>
        {/* exercises */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <h2 style={{ fontSize: 15, margin: 0 }}>Exercises</h2><span style={{ flex: 1 }} /><ExerciseForm />
          </div>
          <div style={{ ...box, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                {exercises.map((e) => (
                  <tr key={e.id} style={{ borderTop: "1px solid var(--border)", opacity: e.active ? 1 : 0.5 }}>
                    <td style={{ ...td, fontWeight: 600 }}>{e.name}</td>
                    <td style={td}>{typeChip(e.type)}</td>
                    <td style={{ ...td, color: "var(--muted)", fontSize: 12 }}>{e.mode}</td>
                    <td style={{ ...td, textAlign: "right" }}>
                      <form action={toggleExercise}><input type="hidden" name="id" value={e.id} /><input type="hidden" name="to" value={String(!e.active)} /><button type="submit" style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "2px 8px", fontSize: 11, cursor: "pointer", color: "var(--muted)" }}>{e.active ? "Off" : "On"}</button></form>
                    </td>
                  </tr>
                ))}
                {exercises.length === 0 && <tr><td style={{ ...td, color: "var(--muted)", padding: "16px" }}>No exercises yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {/* templates */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <h2 style={{ fontSize: 15, margin: 0 }}>Workout templates</h2><span style={{ flex: 1 }} /><TemplateForm exercises={exercises.filter((e) => e.active).map((e) => e.name)} />
          </div>
          <div style={{ display: "grid", gap: 12 }}>
            {templates.map((t) => (
              <div key={t.id} style={{ ...box, padding: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <b style={{ fontSize: 14 }}>{t.name}</b>{typeChip(t.type)}
                  <span style={{ color: "var(--muted)", fontSize: 12 }}>· {t.mode} · {t.items.length} exercises</span>
                  <span style={{ flex: 1 }} />
                  <AssignWorkout templateId={t.id} clients={clients} />
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <tbody>
                    {t.items.map((it, i) => (
                      <tr key={i} style={{ borderTop: i ? "1px solid var(--border)" : "none" }}>
                        <td style={{ ...td, fontWeight: 600 }}>{it.exercise}</td>
                        <td style={{ ...td, color: "var(--muted)", fontSize: 13 }}>{it.sets ?? ""} × {it.reps ?? ""}{it.rest ? ` · rest ${it.rest}` : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
            {templates.length === 0 && <div style={{ ...box, padding: "18px 16px", color: "var(--muted)", fontSize: 13, textAlign: "center" }}>No templates yet.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
