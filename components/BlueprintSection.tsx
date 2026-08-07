import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { canManageBlueprint } from "@/lib/roles";
import type { BpScores } from "@/lib/blueprint";
import BloodActions from "@/components/BloodActions";
import BlueprintGenerate from "@/components/BlueprintGenerate";
import BlueprintScores from "@/components/BlueprintScores";
import BlueprintSla from "@/components/BlueprintSla";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import { SLA_KINDS } from "@/lib/blueprint-sla";

// The BluePrint 3-discipline sign-off board — reused as the standalone /blueprint
// page and as the "BluePrint" tab inside the workspace. Fetches its own data.
export default async function BlueprintSection({ me, heading = false }: { me: { role: string }; heading?: boolean }) {
  const supabase = await createClient();
  // BluePrint clients = active BluePrint package (client_packages), not the
  // legacy clients.package_id / "bp1" hardcode.
  const { data: cpRows } = await supabase
    .from("client_packages").select("client_id").eq("status", "active").eq("category", "blueprint");
  const bpClientIds = [...new Set(((cpRows ?? []) as { client_id: string }[]).map((r) => r.client_id))];
  const { data: clientData } = bpClientIds.length
    ? await supabase.from("clients").select("id, name, code").in("id", bpClientIds).order("code")
    : { data: [] };
  const clients = (clientData ?? []) as { id: string; name: string; code: string | null }[];

  const ids = clients.map((c) => c.id);
  const [{ data: bloodData }, { data: signoffData }, { data: bpData }, { data: consultData }] = await Promise.all([
    ids.length ? supabase.from("blood_requests").select("*").in("client_id", ids) : Promise.resolve({ data: [] }),
    supabase.rpc("blueprint_signoff"),
    ids.length ? supabase.from("blueprints").select("*").in("client_id", ids) : Promise.resolve({ data: [] }),
    ids.length
      ? supabase.from("consultations").select("client_id, kind, completed_at, approved_at").in("client_id", ids).in("kind", SLA_KINDS as unknown as string[])
      : Promise.resolve({ data: [] }),
  ]);

  type BloodRow = { client_id: string; panel?: string | null; requested_at: string | null; submitted: boolean; submitted_date: string | null };
  const blood = new Map<string, BloodRow>();
  for (const b of (bloodData ?? []) as BloodRow[]) {
    const cur = blood.get(b.client_id);
    if (!cur || b.panel === "blueprint") blood.set(b.client_id, b);
  }
  const bps = new Map((bpData ?? []).map((b: { client_id: string }) => [b.client_id, b]));
  const consultsBy = new Map<string, { kind: string; completedAt: string | null; approvedAt: string | null }[]>();
  for (const c of (consultData ?? []) as { client_id: string; kind: string; completed_at: string | null; approved_at: string | null }[]) {
    const list = consultsBy.get(c.client_id) ?? [];
    list.push({ kind: c.kind, completedAt: c.completed_at, approvedAt: c.approved_at });
    consultsBy.set(c.client_id, list);
  }
  const signoff = new Map(
    ((signoffData ?? []) as { client_id: string; doctor: boolean; diet: boolean; trainer: boolean }[]).map((s) => [s.client_id, s]),
  );
  const approvedCount = (cid: string) => {
    const s = signoff.get(cid);
    return s ? [s.doctor, s.diet, s.trainer].filter(Boolean).length : 0;
  };
  const canEditScores = canManageBlueprint(me.role);

  return (
    <div style={{ maxWidth: 1000 }}>
      <RealtimeRefresh tables={["blood_requests", "consultations", "blueprints"]} />
      {heading && <h1 style={{ fontSize: 20, margin: "0 0 4px" }}>BluePrint</h1>}
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
              <th style={{ padding: "12px 16px" }}>BluePrint</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => {
              const appr = approvedCount(c.id);
              const bp = bps.get(c.id) as {
                generated: boolean; consolidated: string | null; scores: BpScores | null;
                consolidated_at: string | null; approved_at: string | null;
                hold_since: string | null; hold_ms: number | null;
              } | undefined;
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
                    <div style={{ marginBottom: 6 }}>
                      <Link href={`/blueprint/${c.id}`} style={{ color: "var(--brand-text)", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>View report →</Link>
                    </div>
                    <BlueprintGenerate clientId={c.id} generated={!!bp?.generated} ready={appr === 3} consolidated={bp?.consolidated ?? null} />
                    <BlueprintSla
                      clientId={c.id}
                      consults={consultsBy.get(c.id) ?? []}
                      consolidatedAt={bp?.consolidated_at ?? null}
                      approvedAt={bp?.approved_at ?? null}
                      holdSince={bp?.hold_since ?? null}
                      holdMs={Number(bp?.hold_ms ?? 0)}
                      canHold={canEditScores}
                    />
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
