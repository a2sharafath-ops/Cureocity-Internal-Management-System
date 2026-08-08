import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { canWrite } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import ClientForm from "@/components/ClientForm";
import { createClientRecord } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function NewClientPage(props: { searchParams: Promise<{ sub?: string; err?: string }> }) {
  const searchParams = await props.searchParams;
  // The only page under (app) with no guard at all. RLS kept a client-portal
  // login from reading anything, so nothing leaked — but any staff role could
  // open the Add-client form and read a walk-in's intake submission via ?sub=.
  // createClientRecord is separately gated; this closes the read.
  const me = await getProfile();
  if (!me || !canWrite(me.role)) redirect("/dashboard");

  const supabase = await createClient();
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
      <Link href="/clients" style={{ color: "var(--brand-text)", fontSize: 13, textDecoration: "none" }}>
        ← Clients
      </Link>
      <h1 style={{ fontSize: 20, margin: "10px 0 4px" }}>Add client</h1>
      {subId && <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 14px" }}>Pre-filled from tablet intake — review, add package &amp; referral, then create.</p>}
      {searchParams.err === "package" && (
        <div style={{ background: "var(--red-bg)", color: "var(--red-text)", border: "1px solid #fecaca", borderRadius: "var(--radius)", padding: "12px 15px", fontSize: 13, margin: "0 0 14px" }}>
          <b>A package is required.</b> Every client must hold a package. If they
          haven&apos;t decided yet, keep them in CRM &amp; Leads and convert once
          they buy.
        </div>
      )}
      {searchParams.err === "membership" && (
        <div style={{ background: "var(--red-bg)", color: "var(--red-text)", border: "1px solid #fecaca", borderRadius: "var(--radius)", padding: "12px 15px", fontSize: 13, margin: "0 0 14px" }}>
          <b>Membership required first.</b> A PT or Comprehensive package needs an active
          membership. Onboard this client on a membership now, then add the care
          package from their client card.
        </div>
      )}
      <ClientForm action={createClientRecord} packages={packages} submitLabel="Add client" client={prefill} subId={subId} requirePackage />
    </div>
  );
}
