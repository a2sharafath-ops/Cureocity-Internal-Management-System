import { redirect, notFound } from "next/navigation";
import BackButton from "@/components/BackButton";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canSee } from "@/lib/roles";
import BlueprintReport from "@/components/BlueprintReport";
import type { BpScores } from "@/lib/blueprint";

export const dynamic = "force-dynamic";

export default async function BlueprintReportPage({ params }: { params: { id: string } }) {
  const me = await getProfile();
  // Any staff who can see clients can view/print the report (front desk delivers it).
  if (!me || !canSee(me.role, "/clients")) redirect("/dashboard");

  const supabase = createClient();
  const [{ data: client }, { data: bp }, { data: signs }] = await Promise.all([
    supabase.from("clients").select("id, name, code").eq("id", params.id).maybeSingle(),
    supabase.from("blueprints").select("scores, consolidated, generated, generated_date").eq("client_id", params.id).maybeSingle(),
    supabase.from("blueprint_signoffs").select("discipline, by_name").eq("client_id", params.id),
  ]);
  if (!client) notFound();
  const c = client as { id: string; name: string; code: string | null };
  const b = (bp ?? null) as { scores: BpScores | null; consolidated: string | null; generated: boolean; generated_date: string | null } | null;

  return (
    <div style={{ maxWidth: 900 }}>
      <div className="bp-noprint" style={{ marginBottom: 8 }}>
        <BackButton fallback={`/clients/${c.id}`} />
      </div>
      <BlueprintReport
        subject={{ name: c.name, code: c.code }}
        scores={b?.scores ?? null}
        consolidated={b?.consolidated ?? null}
        generatedDate={b?.generated ? (b.generated_date ?? null) : null}
        signoffs={(signs ?? []) as { discipline: string; by_name: string | null }[]}
      />
    </div>
  );
}
