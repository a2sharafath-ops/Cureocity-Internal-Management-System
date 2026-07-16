import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canSee } from "@/lib/roles";
import BloodActions from "@/components/BloodActions";
import BlueprintGenerate from "@/components/BlueprintGenerate";
import BlueprintScores from "@/components/BlueprintScores";
import { canManageBlueprint } from "@/lib/roles";
import type { BpScores } from "@/lib/blueprint";

import RealtimeRefresh from "@/components/RealtimeRefresh";

export const dynamic = "force-dynamic";

const REQUIRED = ["Doctor", "Diet", "Trainer"];

export default async function BlueprintPage() {
  const me = await getProfile();
  if (!me || !canSee(me.role, "/blueprint")) redirect("/dashboard");

  const supabase = createClient();
  // BluePrint-package clients
  const { data: clientData } = await supabase
    .from("clients")
    .select("id, name, code")
    .eq("package_id", "bp1")
    .order("code");
  const clients = (clientData ?? []) as { id: string; name: string; code: string | null }[];

  const ids = clients.map((c) => c.id);
  const [{ data: bloodData }, { data: consultData }, { data: bpData }] = await Promise.all([
    ids.length ? supabase.from("blood_requests").select("*").in("client_id", ids) : Promise.resolve({ data: [] }),
    ids.length ? supabase.from("consultations").select("client_id, kind, approved").in("client_id", ids) : Promise.resolve({ data: [] }),
    ids.length ? supabase.from("blueprints").select("*").in("client_id", ids) : Promise.resolve({ data: [] }),
  ]);

  const blood = new Map((bloodData ?? []).map((b: { client_id: string }) => [b.client_id, b]));
  const bps = new Map((bpData ?? []).map((b: { client_id: string }) => [b.client_id, b]));
  const consults = (consultData ?? []) as { client_id: string; kind: string; approved: boolean }[];

  function approvedCount(cid: string) {
    return REQUIRED.filter((k) => consults.some((c) => c.client_id === cid && c.kind === k && c.approved)).length;
  }

  const canEditScores = canManageBlueprint(me.role);

  return (
    <div style={{ maxWidth: 1000 }}>
      <RealtimeRefresh tables={["blood_requests","consultations","blueprints"]} />
      <h1 style={{ fontSize: 20, margin: "0 0 4px" }}>BluePrint</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 18px" }}>
        BluePrint-package clients · blood report → 3 consultations approved → generate · {clients.length} client{clients.length === 1 ? "" : "s"}
      </p>

      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--muted)", fontSize: 12 }}>
              <th style={{ padding: "12px 16px" }}>Client</th>
              <th style={{ padding: "12px 16px" }}>Blood report</th>
              <th style={{ padding: "12px 16px" }}>Consults approved</th>
              <th style={{ padding: "12px 16px" }}>Health scores</th>
              <th style={{ padding: "12px 16px" }}>Blueprint</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => {
              const appr = approvedCount(c.id);
              const bp = bps.get(c.id) as { generated: boolean; consolidated: string | null; scores: BpScores | null } | undefined;
              return (
                <tr key={c.id} style={{ borderTop: "1px solid var(--border)", verticalAlign: "top" }}>
                  <td style={{ padding: "12px 16px" }}>
                    <Link href={`/clients/${c.id}`} style={{ color: "var(--ink)", fontWeight: 700, textDecoration: "none" }}>{c.name}</Link>
                    <div style={{ color: "var(--muted)", fontSize: 12 }}>{c.code ?? ""}</div>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <BloodActions clientId={c.id} blood={(blood.get(c.id) as { requested_at: string | null; submitted: boolean; submitted_date: string | null } | undefined) ?? null} />
                  </td>
                  <td style={{ padding: "12px 16px" }}>{appr} / 3</td>
                  <td style={{ padding: "12px 16px" }}>
                    <BlueprintScores clientId={c.id} scores={bp?.scores ?? null} canEdit={canEditScores} />
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <BlueprintGenerate clientId={c.id} generated={!!bp?.generated} ready={appr === 3} consolidated={bp?.consolidated ?? null} />
                  </td>
                </tr>
              );
            })}
            {clients.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: "24px 16px", textAlign: "center", color: "var(--muted)" }}>
                  No BluePrint clients yet — assign the BluePrint package to a client to start.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
