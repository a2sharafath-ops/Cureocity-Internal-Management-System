import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canConsult } from "@/lib/roles";
import { consultQ } from "@/lib/consult-questions";
import ConsoleView, { type ConsoleHealth } from "@/components/ConsoleView";

export const dynamic = "force-dynamic";

export default async function ConsolePage({ params }: { params: { id: string } }) {
  const me = await getProfile();
  if (!me || !canConsult(me.role)) redirect("/dashboard");

  const supabase = createClient();
  const { data } = await supabase
    .from("consultations")
    .select("id, kind, status, summary, answers, flags, client_id, lead_id, clients(name, code), leads(name)")
    .eq("id", params.id)
    .maybeSingle();
  if (!data) notFound();

  const row = data as unknown as {
    id: string; kind: string; status: string; summary: string | null;
    answers: [string, string][] | null; flags: { text: string; severity: string }[] | null;
    client_id: string | null; lead_id: string | null;
    clients: { name: string; code: string | null } | null; leads: { name: string } | null;
  };
  const q = consultQ(row.kind);

  // A consultation is on a client or (for a pre-sale trial) a lead. Render the
  // right subject and point the "open card" link at the right record.
  const subject = row.client_id
    ? { id: row.client_id, name: row.clients?.name ?? "Client", code: row.clients?.code ?? null, isLead: false }
    : { id: row.lead_id ?? "", name: row.leads?.name ?? "Lead", code: null, isLead: true };

  // The client's health snapshot the clinician can see at a glance during the
  // session — profile, latest InBody, conditions, allergies and goals. Only for
  // a real client (a pre-sale lead has none of this yet).
  let health: ConsoleHealth | undefined;
  if (row.client_id) {
    const [{ data: c }, { data: m }, { data: alg }, { data: blood }] = await Promise.all([
      supabase.from("clients").select("dob, gender, height, weight, conditions, goals").eq("id", row.client_id).maybeSingle(),
      supabase.from("measurements").select("date, weight, bmi, body_fat, muscle_mass, visceral_fat, waist, hip, ai_summary").eq("client_id", row.client_id).order("date", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("allergies").select("substance, severity").eq("client_id", row.client_id),
      supabase.from("blood_requests").select("panel, submitted").eq("client_id", row.client_id),
    ]);
    const cc = c as { dob: string | null; gender: string | null; height: number | null; weight: number | null; conditions: string | null; goals: string[] | null } | null;
    const mm = m as { date: string; weight: number | null; bmi: number | null; body_fat: number | null; muscle_mass: number | null; visceral_fat: number | null; waist: number | null; hip: number | null; ai_summary: string | null } | null;
    const age = cc?.dob ? Math.floor((Date.now() - new Date(cc.dob).getTime()) / 31557600000) : null;
    const bloodRows = (blood ?? []) as { panel: string | null; submitted: boolean }[];
    health = {
      age, gender: cc?.gender ?? null, height: cc?.height ?? null, weight: mm?.weight ?? cc?.weight ?? null,
      bmi: mm?.bmi ?? null, bodyFat: mm?.body_fat ?? null, muscle: mm?.muscle_mass ?? null, visceral: mm?.visceral_fat ?? null,
      waist: mm?.waist ?? null, hip: mm?.hip ?? null, measuredOn: mm?.date ?? null,
      inbodySummary: mm?.ai_summary ?? null,
      conditions: cc?.conditions ?? null, goals: (cc?.goals ?? []) as string[],
      allergies: ((alg ?? []) as { substance: string; severity: string }[]).map((a) => `${a.substance}${a.severity ? ` (${a.severity})` : ""}`),
      bloodStatus: bloodRows.length ? (bloodRows.every((b) => b.submitted) ? "Report received" : "Awaiting report") : null,
    };
  }

  return (
    <ConsoleView
      id={row.id}
      kind={row.kind}
      label={q.label}
      icon={q.icon}
      client={subject}
      questions={q.questions}
      answers={(row.answers ?? []) as [string, string][]}
      flags={(row.flags ?? []) as { text: string; severity: string }[]}
      summary={row.summary}
      status={row.status}
      canTools={row.kind === "Doctor"}
      health={health}
    />
  );
}
