import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ClientForm from "@/components/ClientForm";
import { createClientRecord } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function NewClientPage() {
  const supabase = createClient();
  const { data } = await supabase.from("packages").select("id, name").eq("active", true).order("id");
  const packages = (data ?? []) as { id: string; name: string }[];

  return (
    <div style={{ maxWidth: 700 }}>
      <Link href="/clients" style={{ color: "var(--teal-dark)", fontSize: 13, textDecoration: "none" }}>
        ← Clients
      </Link>
      <h1 style={{ fontSize: 20, margin: "10px 0 18px" }}>New Client</h1>
      <ClientForm action={createClientRecord} packages={packages} submitLabel="Create client" />
    </div>
  );
}
