import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canConsult } from "@/lib/roles";
import { consultQ } from "@/lib/consult-questions";
import ConsoleView from "@/components/ConsoleView";

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
    />
  );
}
