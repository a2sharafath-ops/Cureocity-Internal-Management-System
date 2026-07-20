import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canSee } from "@/lib/roles";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import MessageThread, { type Msg } from "@/components/MessageThread";
import MessageReply from "@/components/MessageReply";
import MarkThreadRead from "@/components/MarkThreadRead";

export const dynamic = "force-dynamic";

export default async function ThreadPage({ params }: { params: { id: string } }) {
  const me = await getProfile();
  if (!me || !canSee(me.role, "/messages")) redirect("/dashboard");

  const supabase = createClient();
  const { data: client } = await supabase.from("clients").select("id, name, code").eq("id", params.id).maybeSingle();
  if (!client) notFound();

  const { data: msgData } = await supabase
    .from("messages").select("id, sender, sender_name, body, created_at").eq("client_id", params.id).order("created_at", { ascending: true });
  const messages = (msgData ?? []) as Msg[];

  return (
    <div style={{ maxWidth: 720 }}>
      <RealtimeRefresh tables={["messages"]} />
      <MarkThreadRead clientId={params.id} />
      <Link href="/messages" style={{ color: "var(--brand-text)", fontSize: 13, textDecoration: "none" }}>← Messages</Link>

      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "10px 0 16px" }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--brand-fill)", color: "#fff", display: "grid", placeItems: "center", fontWeight: 700 }}>
          {client.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase()}
        </div>
        <div>
          <h1 style={{ fontSize: 18, margin: 0 }}>{client.name}</h1>
          <div style={{ color: "var(--muted)", fontSize: 12 }}>{client.code ?? ""}</div>
        </div>
        <span style={{ flex: 1 }} />
        <Link href={`/clients/${client.id}`} style={{ color: "var(--brand-text)", fontSize: 13, textDecoration: "none" }}>Open 360° →</Link>
      </div>

      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "16px 18px" }}>
        <MessageThread messages={messages} viewer="staff" />
        <MessageReply variant="staff" clientId={params.id} />
      </div>
    </div>
  );
}
