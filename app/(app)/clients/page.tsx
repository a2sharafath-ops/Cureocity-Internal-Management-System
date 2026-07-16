import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ClientsTable, { type ClientRow } from "@/components/ClientsTable";
import { getProfile } from "@/lib/auth";
import { canWrite } from "@/lib/roles";

import RealtimeRefresh from "@/components/RealtimeRefresh";

export const dynamic = "force-dynamic";

type Raw = {
  id: string;
  code: string | null;
  name: string;
  phone: string | null;
  used: number;
  branch: string | null;
  joined: string | null;
  packages: { name: string; sessions: number; is_facility: boolean } | null;
};

export default async function ClientsPage() {
  const supabase = createClient();
  const profile = await getProfile();
  const writer = canWrite(profile?.role ?? "");
  const { data, error } = await supabase
    .from("clients")
    .select("id, code, name, phone, used, branch, joined, packages(name, sessions, is_facility)")
    .order("code", { ascending: true });

  const clients: ClientRow[] = ((data ?? []) as unknown as Raw[]).map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
    phone: c.phone,
    used: c.used,
    branch: c.branch,
    joined: c.joined,
    package_name: c.packages?.name ?? null,
    is_facility: c.packages?.is_facility ?? false,
    package_sessions: c.packages?.sessions ?? 0,
  }));

  return (
    <div style={{ maxWidth: 1000 }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 4 }}>
        <RealtimeRefresh tables={["clients"]} />
      <h1 style={{ fontSize: 20, margin: 0 }}>Clients</h1>
        <span style={{ flex: 1 }} />
        {writer && (
          <Link
            href="/clients/new"
            style={{ background: "var(--teal)", color: "#fff", borderRadius: 10, padding: "9px 15px", fontSize: 13, fontWeight: 600, textDecoration: "none" }}
          >
            + New Client
          </Link>
        )}
      </div>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 18px" }}>
        CRM · live from Supabase
      </p>

      {error ? (
        <div
          style={{
            background: "var(--red-bg)", color: "#991b1b", border: "1px solid #fecaca",
            borderRadius: "var(--radius)", padding: "14px 16px", fontSize: 14,
          }}
        >
          <b>Couldn&apos;t load clients.</b> {error.message}
        </div>
      ) : (
        <ClientsTable clients={clients} />
      )}
    </div>
  );
}
