import { createClient } from "@/lib/supabase/server";
import ClientsTable, { type ClientRow } from "@/components/ClientsTable";

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
      <h1 style={{ fontSize: 20, margin: "0 0 4px" }}>Clients</h1>
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
