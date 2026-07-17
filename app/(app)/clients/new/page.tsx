import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ClientForm from "@/components/ClientForm";
import { createClientRecord } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function NewClientPage({ searchParams }: { searchParams: { sub?: string } }) {
  const supabase = createClient();
  const { data } = await supabase.from("packages").select("id, name").eq("active", true).order("id");
  const packages = (data ?? []) as { id: string; name: string }[];

  // Prefill from a tablet-intake submission when arriving via "Review & Add Client".
  let prefill: Record<string, unknown> | undefined;
  let subId: string | undefined;
  if (searchParams.sub) {
    const { data: s } = await supabase.from("tablet_submissions").select("*").eq("id", searchParams.sub).maybeSingle();
    if (s) {
      subId = String(s.id);
      prefill = {
        name: `${s.first_name ?? ""} ${s.last_name ?? ""}`.trim(),
        phone: s.phone, email: s.email, gender: s.gender, occupation: s.occupation,
        height: s.height, weight: s.weight, conditions: s.conditions, goals: s.goals ?? [],
        branch: s.city && String(s.city).toLowerCase().includes("calicut") ? "Calicut" : "Kochi",
      };
    }
  }

  return (
    <div style={{ maxWidth: 700 }}>
      <Link href="/clients" style={{ color: "var(--teal-dark)", fontSize: 13, textDecoration: "none" }}>
        ← Clients
      </Link>
      <h1 style={{ fontSize: 20, margin: "10px 0 4px" }}>New Client</h1>
      {subId && <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 14px" }}>📥 Pre-filled from tablet intake — review, add package &amp; referral, then create.</p>}
      <ClientForm action={createClientRecord} packages={packages} submitLabel="Create client" client={prefill} subId={subId} />
    </div>
  );
}
