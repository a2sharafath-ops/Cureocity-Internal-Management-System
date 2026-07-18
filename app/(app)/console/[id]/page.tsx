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
    .select("id, kind, status, summary, answers, client_id, clients(name, code)")
    .eq("id", params.id)
    .maybeSingle();
  if (!data) notFound();

  const row = data as unknown as {
    id: string; kind: string; status: string; summary: string | null;
    answers: [string, string][] | null; client_id: string; clients: { name: string; code: string | null } | null;
  };
  const q = consultQ(row.kind);

  return (
    <ConsoleView
      id={row.id}
      kind={row.kind}
      label={q.label}
      icon={q.icon}
      client={{ id: row.client_id, name: row.clients?.name ?? "Client", code: row.clients?.code ?? null }}
      questions={q.questions}
      answers={(row.answers ?? []) as [string, string][]}
      summary={row.summary}
      status={row.status}
    />
  );
}
