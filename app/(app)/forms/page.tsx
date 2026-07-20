import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canSee } from "@/lib/roles";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import { FormBuilder, AssignForm, FormFill } from "@/components/FormComponents";

export const dynamic = "force-dynamic";

type Field = { label: string; kind: string };
type Form = { id: string; name: string; type: string; fields: Field[]; active: boolean };
type Resp = { id: string; status: string; signed_by: string | null; signed_at: string | null; answers: Record<string, string>; clients: { id: string; name: string } | null; forms: { name: string; type: string; fields: Field[] } | null };

export default async function FormsPage() {
  const me = await getProfile();
  if (!me || !canSee(me.role, "/forms")) redirect("/dashboard");

  const supabase = createClient();
  const [{ data: formData }, { data: respData }, { data: clientData }] = await Promise.all([
    supabase.from("forms").select("id, name, type, fields, active").eq("active", true).order("created_at", { ascending: false }),
    supabase.from("form_responses").select("id, status, signed_by, signed_at, answers, clients(id, name), forms(name, type, fields)").order("created_at", { ascending: false }).limit(80),
    supabase.from("clients").select("id, name").order("name"),
  ]);
  const forms = (formData ?? []) as unknown as Form[];
  const responses = (respData ?? []) as unknown as Resp[];
  const clients = (clientData ?? []) as { id: string; name: string }[];
  const pending = responses.filter((r) => r.status === "pending");
  const completed = responses.filter((r) => r.status === "completed");

  const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
  const typeChip = (t: string) => <span style={{ background: t === "consent" ? "var(--amber-bg)" : "#e0f2f1", color: t === "consent" ? "#b45309" : "var(--brand-text)", borderRadius: 999, padding: "1px 8px", fontSize: 11, fontWeight: 600 }}>{t}</span>;

  return (
    <div style={{ maxWidth: 1000 }}>
      <RealtimeRefresh tables={["forms", "form_responses"]} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>Forms &amp; Consent</h1>
        <span style={{ flex: 1 }} />
        <FormBuilder />
      </div>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "6px 0 16px" }}>Dynamic intake &amp; consent forms — assign to a patient, collect answers &amp; signatures.</p>

      {/* forms library */}
      <h2 style={{ fontSize: 15, margin: "0 0 8px" }}>Form templates</h2>
      <div style={{ ...box, overflow: "hidden", marginBottom: 26 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            {forms.map((f) => (
              <tr key={f.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ padding: "12px 16px", fontWeight: 600, fontSize: 14 }}>{f.name} {typeChip(f.type)}</td>
                <td style={{ padding: "12px 16px", color: "var(--muted)", fontSize: 13 }}>{f.fields.length} field{f.fields.length === 1 ? "" : "s"}</td>
                <td style={{ padding: "12px 16px", textAlign: "right" }}><AssignForm formId={f.id} clients={clients} /></td>
              </tr>
            ))}
            {forms.length === 0 && <tr><td style={{ padding: "20px 16px", color: "var(--muted)", fontSize: 13 }}>No forms yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* pending */}
      <h2 style={{ fontSize: 15, margin: "0 0 8px" }}>Awaiting completion ({pending.length})</h2>
      <div style={{ display: "grid", gap: 10, marginBottom: 26 }}>
        {pending.map((r) => (
          <div key={r.id} style={{ ...box, padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <b style={{ fontSize: 14 }}>{r.forms?.name ?? "Form"}</b>{r.forms && typeChip(r.forms.type)}
              <span style={{ color: "var(--muted)", fontSize: 13 }}>· {r.clients ? <Link href={`/clients/${r.clients.id}`} style={{ color: "var(--brand-text)", textDecoration: "none" }}>{r.clients.name}</Link> : "—"}</span>
              <span style={{ flex: 1 }} />
              {r.forms && <FormFill responseId={r.id} name={r.forms.name} type={r.forms.type} fields={r.forms.fields} />}
            </div>
          </div>
        ))}
        {pending.length === 0 && <div style={{ ...box, padding: "18px 16px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>Nothing pending.</div>}
      </div>

      {/* completed */}
      <h2 style={{ fontSize: 15, margin: "0 0 8px" }}>Completed ({completed.length})</h2>
      <div style={{ display: "grid", gap: 10 }}>
        {completed.map((r) => (
          <div key={r.id} style={{ ...box, padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <b style={{ fontSize: 14 }}>{r.forms?.name ?? "Form"}</b>{r.forms && typeChip(r.forms.type)}
              <span style={{ color: "var(--muted)", fontSize: 13 }}>· {r.clients?.name ?? "—"}</span>
              <span style={{ flex: 1 }} />
              {r.signed_by && <span style={{ color: "var(--muted)", fontSize: 12 }}>✍ {r.signed_by} · {r.signed_at?.slice(0, 10)}</span>}
            </div>
            <div style={{ display: "grid", gap: 4, fontSize: 13 }}>
              {Object.entries(r.answers ?? {}).map(([k, v]) => (
                <div key={k}><span style={{ color: "var(--muted)" }}>{k}:</span> <b>{v || "—"}</b></div>
              ))}
            </div>
          </div>
        ))}
        {completed.length === 0 && <div style={{ ...box, padding: "18px 16px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>None completed yet.</div>}
      </div>
    </div>
  );
}
