import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ClientForm from "@/components/ClientForm";
import { updateClientRecord } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function EditClientPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const [{ data: client }, { data: pkgs }] = await Promise.all([
    supabase.from("clients").select("*").eq("id", params.id).maybeSingle(),
    supabase.from("packages").select("id, name").eq("active", true).order("id"),
  ]);

  if (!client) notFound();
  const packages = (pkgs ?? []) as { id: string; name: string }[];

  return (
    <div style={{ maxWidth: 700 }}>
      <Link href={`/clients/${params.id}`} style={{ color: "var(--brand-text)", fontSize: 13, textDecoration: "none" }}>
        ← Back to profile
      </Link>
      <h1 style={{ fontSize: 20, margin: "10px 0 18px" }}>Edit — {client.name}</h1>
      <ClientForm action={updateClientRecord} packages={packages} client={client} submitLabel="Save changes" />
    </div>
  );
}
