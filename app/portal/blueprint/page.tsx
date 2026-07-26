import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import BlueprintReport from "@/components/BlueprintReport";
import type { BpScores } from "@/lib/blueprint";

export const dynamic = "force-dynamic";

export default async function PortalBlueprintPage() {
  const supabase = createClient();
  // RLS scopes to the logged-in client only.
  const { data: client } = await supabase.from("clients").select("id, name, code").limit(1).maybeSingle();
  if (!client) return <div style={{ padding: 24, color: "var(--muted)" }}>No client record is linked to your login.</div>;
  const c = client as { id: string; name: string; code: string | null };

  const [{ data: bp }, { data: signs }] = await Promise.all([
    supabase.from("blueprints").select("scores, consolidated, generated, generated_date").eq("client_id", c.id).eq("generated", true).maybeSingle(),
    supabase.from("blueprint_signoffs").select("discipline, by_name").eq("client_id", c.id),
  ]);
  const b = (bp ?? null) as { scores: BpScores | null; consolidated: string | null; generated: boolean; generated_date: string | null } | null;

  return (
    <div style={{ padding: "20px 16px" }}>
      <div className="bp-noprint" style={{ maxWidth: 840, margin: "0 auto 8px" }}>
        <Link href="/portal" style={{ color: "var(--brand-text)", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>← Back to portal</Link>
      </div>
      {b?.generated ? (
        <BlueprintReport
          subject={{ name: c.name, code: c.code }}
          scores={b.scores}
          consolidated={b.consolidated}
          generatedDate={b.generated_date}
          signoffs={(signs ?? []) as { discipline: string; by_name: string | null }[]}
        />
      ) : (
        <div style={{ maxWidth: 840, margin: "0 auto", background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "24px", color: "var(--muted)", fontSize: 14 }}>
          Your Personal Health BluePrint isn&apos;t ready yet — it&apos;s prepared once your care team completes and signs off your consultations.
        </div>
      )}
    </div>
  );
}
