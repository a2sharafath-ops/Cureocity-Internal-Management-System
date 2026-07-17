import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ClientsTable, { type ClientRow } from "@/components/ClientsTable";
import { getProfile } from "@/lib/auth";
import { canWrite } from "@/lib/roles";
import RealtimeRefresh from "@/components/RealtimeRefresh";

export const dynamic = "force-dynamic";

type Raw = {
  id: string; code: string | null; name: string; phone: string | null; email: string | null;
  used: number; branch: string | null; joined: string | null; dob: string | null; owner: string | null; package_id: string | null;
  packages: { name: string; sessions: number; is_facility: boolean } | null;
  staff: { name: string } | null;
};

function ageFromDob(dob: string | null): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (365.25 * 86400000));
}

export default async function ClientsPage() {
  const supabase = createClient();
  const profile = await getProfile();
  const writer = canWrite(profile?.role ?? "");

  const [{ data, error }, { data: staffData }, { data: consultData }, { data: bpData }] = await Promise.all([
    supabase.from("clients").select("id, code, name, phone, email, used, branch, joined, dob, owner, package_id, packages(name, sessions, is_facility), staff:pro_id(name)").order("code", { ascending: true }),
    supabase.from("staff").select("id, name").order("name"),
    supabase.from("consultations").select("client_id, kind, status"),
    supabase.from("blueprints").select("client_id, generated"),
  ]);

  const { data: subData } = await supabase.from("tablet_submissions").select("id, first_name, last_name, phone, created_at").eq("status", "pending").order("created_at", { ascending: false });
  const submissions = (subData ?? []) as { id: string; first_name: string; last_name: string | null; phone: string | null; created_at: string }[];

  // Bulk journey signals → per-client onboarding milestones.
  const consultDone = new Map<string, Set<string>>();
  for (const r of (consultData ?? []) as { client_id: string; kind: string; status: string }[]) {
    if (r.status === "completed") {
      if (!consultDone.has(r.client_id)) consultDone.set(r.client_id, new Set());
      consultDone.get(r.client_id)!.add(r.kind);
    }
  }
  const bpGen = new Set(((bpData ?? []) as { client_id: string; generated: boolean }[]).filter((r) => r.generated).map((r) => r.client_id));

  const staff = (staffData ?? []) as { id: string; name: string }[];
  const clients: ClientRow[] = ((data ?? []) as unknown as Raw[]).map((c) => {
    const sessions = c.packages?.sessions ?? 0;
    const facility = c.packages?.is_facility ?? false;
    const status = facility ? "Active" : (sessions > 0 && c.used >= sessions ? "Completed" : "Active");
    const cd = consultDone.get(c.id) ?? new Set<string>();
    const steps = [
      { label: "Package", done: c.package_id != null },
      { label: "Doctor", done: cd.has("Doctor") },
      { label: "Diet", done: cd.has("Diet") },
      { label: "Fitness", done: cd.has("Trainer") },
      { label: "BluePrint", done: bpGen.has(c.id) },
    ];
    const doneCount = steps.filter((s) => s.done).length;
    const nextStep = steps.find((s) => !s.done);
    return {
      id: c.id, code: c.code, name: c.name, phone: c.phone, email: c.email,
      age: ageFromDob(c.dob), branch: c.branch, used: c.used,
      package_name: c.packages?.name ?? null, is_facility: facility, package_sessions: sessions,
      is_blueprint: c.package_id === "bp1" || (c.packages?.name ?? "").toLowerCase().includes("blueprint"),
      status, coach: c.staff?.name ?? null, owner: c.owner ?? null,
      journey: { steps, done: doneCount, total: steps.length, stage: nextStep ? `Next: ${nextStep.label}` : "Fully onboarded" },
    };
  });

  return (
    <div style={{ maxWidth: 1120 }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 4 }}>
        <RealtimeRefresh tables={["clients"]} />
        <h1 style={{ fontSize: 20, margin: 0 }}>Clients</h1>
        <span style={{ flex: 1 }} />
        {writer && (
          <Link href="/clients/new" style={{ background: "var(--teal)", color: "#fff", borderRadius: 10, padding: "9px 15px", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>+ Onboard Client</Link>
        )}
      </div>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 18px" }}>CRM Hub — searchable contacts list</p>

      {writer && submissions.map((s) => (
        <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", background: "var(--teal-light)", border: "1px solid #99f6e4", borderRadius: "var(--radius)", padding: "12px 16px", marginBottom: 12, fontSize: 14 }}>
          <span>📥 <b>Tablet intake received:</b> {s.first_name} {s.last_name ?? ""}{s.phone ? ` · ${s.phone}` : ""} — synced to front desk</span>
          <span style={{ flex: 1 }} />
          <Link href={`/clients/new?sub=${s.id}`} style={{ background: "var(--teal)", color: "#fff", borderRadius: 8, padding: "7px 13px", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>Review &amp; Add Client</Link>
        </div>
      ))}

      {error ? (
        <div style={{ background: "var(--red-bg)", color: "#991b1b", border: "1px solid #fecaca", borderRadius: "var(--radius)", padding: "14px 16px", fontSize: 14 }}>
          <b>Couldn&apos;t load clients.</b> {error.message}
        </div>
      ) : (
        <ClientsTable clients={clients} staff={staff} writer={writer} />
      )}
    </div>
  );
}
