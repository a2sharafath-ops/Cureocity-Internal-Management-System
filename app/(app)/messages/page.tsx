import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canMessage, canCampaigns } from "@/lib/roles";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import CommsHub, { type CClient, type CMsg, type CTemplate, type CCampaign } from "@/components/CommsHub";

export const dynamic = "force-dynamic";

const AVATAR_COLORS = ["#e11f34", "var(--blue)", "var(--purple)", "#d97706", "#dc2626", "#0891b2"];

export default async function MessagesPage() {
  const me = await getProfile();
  // Reachable by deep link (Retention "Reach out", a client card) rather than
  // from the nav — but reachable is not the same as open to everyone. This page
  // loads every client and the last 500 messages, so leaving it at "is anyone
  // logged in" meant HR and Finance could read every client conversation in the
  // clinic. canMessage is the same set that may reply, which is the right one:
  // reading a client's messages is not a lesser act than answering them.
  if (!me) redirect("/login");
  if (!canMessage(me.role)) redirect("/dashboard");
  const canMsg = canMessage(me.role);
  const canCamp = canCampaigns(me.role);

  const supabase = await createClient();
  const [{ data: clientData }, { data: msgData }, { data: tplData }, { data: campData }] = await Promise.all([
    supabase.from("clients").select("id, name, code, phone").order("name"),
    supabase.from("messages").select("id, client_id, sender, sender_name, body, read, channel, created_at").order("created_at", { ascending: false }).limit(500),
    supabase.from("message_templates").select("id, name, category, subject, body, channel").eq("active", true).order("created_at", { ascending: false }),
    supabase.from("campaigns").select("id, name, audience, status, sent_count, message_templates:template_id(name)").order("created_at", { ascending: false }),
  ]);

  const clients: CClient[] = ((clientData ?? []) as { id: string; name: string; code: string | null; phone: string | null }[])
    .map((c, i) => ({ id: c.id, name: c.name, code: c.code, phone: c.phone, color: AVATAR_COLORS[i % AVATAR_COLORS.length] }));
  const messages = (msgData ?? []) as CMsg[];
  const templates = (tplData ?? []) as CTemplate[];
  const campaigns: CCampaign[] = ((campData ?? []) as unknown as { id: string; name: string; audience: string; status: string; sent_count: number; message_templates: { name: string } | null }[])
    .map((c) => ({ id: c.id, name: c.name, audience: c.audience, status: c.status, sent_count: c.sent_count, templateName: c.message_templates?.name ?? null }));

  return (
    <div style={{ maxWidth: 1160 }}>
      <RealtimeRefresh tables={["messages"]} />
      <h1 style={{ fontSize: 20, margin: "0 0 2px" }}>Communications</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 16px" }}>Inbox · templates · campaigns — WhatsApp, email &amp; SMS in one place.</p>

      <CommsHub clients={clients} messages={messages} templates={templates} campaigns={campaigns} canMsg={canMsg} canCamp={canCamp} />
    </div>
  );
}
