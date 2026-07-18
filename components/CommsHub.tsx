"use client";

import { useState } from "react";
import Link from "next/link";
import { sendMessageStaff, createTemplate, createCampaign, sendCampaignNow, archiveTemplate } from "@/lib/actions";

export type CClient = { id: string; name: string; code: string | null; phone: string | null; color: string };
export type CMsg = { id: string; client_id: string; sender: string; sender_name: string | null; body: string; read: boolean; channel: string; created_at: string };
export type CTemplate = { id: string; name: string; category: string; subject: string; body: string; channel: string };
export type CCampaign = { id: string; name: string; audience: string; status: string; sent_count: number; templateName: string | null };

const CHANNELS = ["WhatsApp", "Email", "SMS"];
const chColor: Record<string, [string, string]> = { WhatsApp: ["#dcfce7", "#166534"], Email: ["#dbeafe", "#1e40af"], SMS: ["#ede9fe", "#6d28d9"] };
function initials(n: string) { return n.split(" ").map((x) => x[0]).slice(0, 2).join("").toUpperCase(); }
function when(iso: string) { return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }); }
function fillVars(body: string, c: CClient) { return body.replace(/\{name\}/g, c.name.split(" ")[0]).replace(/\{code\}/g, c.code ?? ""); }

export default function CommsHub({
  clients, messages, templates, campaigns, canMsg, canCamp,
}: {
  clients: CClient[]; messages: CMsg[]; templates: CTemplate[]; campaigns: CCampaign[]; canMsg: boolean; canCamp: boolean;
}) {
  const [tab, setTab] = useState<"inbox" | "templates" | "campaigns">("inbox");
  const [chFilter, setChFilter] = useState("All");
  const [composerText, setComposerText] = useState("");
  const [composerCh, setComposerCh] = useState("WhatsApp");
  const [newTemplate, setNewTemplate] = useState(false);
  const [newCampaign, setNewCampaign] = useState(false);

  const byClient = new Map<string, CMsg[]>();
  for (const m of messages) { (byClient.get(m.client_id) ?? byClient.set(m.client_id, []).get(m.client_id)!).push(m); }
  for (const arr of byClient.values()) arr.sort((a, b) => a.created_at < b.created_at ? -1 : 1);

  const convs = clients
    .filter((c) => byClient.has(c.id))
    .map((c) => { const arr = byClient.get(c.id)!; const last = arr[arr.length - 1]; return { c, last, unread: arr.filter((m) => m.sender === "client" && !m.read).length }; })
    .filter((x) => chFilter === "All" || x.last.channel === chFilter)
    .sort((a, b) => a.last.created_at < b.last.created_at ? 1 : -1);

  const [active, setActive] = useState<string | null>(null);
  const activeId = active ?? convs[0]?.c.id ?? null;
  const activeClient = clients.find((c) => c.id === activeId) ?? null;
  const thread = activeId ? (byClient.get(activeId) ?? []) : [];

  const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
  const chBadge = (ch: string) => { const [bg, c] = chColor[ch] ?? ["#eef2f1", "#64748b"]; return <span style={{ background: bg, color: c, borderRadius: 999, padding: "1px 8px", fontSize: 10, fontWeight: 700 }}>{ch}</span>; };
  const tabBtn = (k: typeof tab, label: string) => <button type="button" onClick={() => setTab(k)} style={{ padding: "7px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "1px solid var(--border)", background: tab === k ? "var(--teal)" : "#fff", color: tab === k ? "#fff" : "var(--muted)" }}>{label}</button>;
  const inp: React.CSSProperties = { border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", fontSize: 13, background: "#fff" };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        {tabBtn("inbox", "💬 Inbox")}{tabBtn("templates", "📝 Templates")}{tabBtn("campaigns", "⚡ Campaigns")}
        <span style={{ flex: 1 }} />
        {tab === "templates" && canCamp && <button type="button" onClick={() => setNewTemplate((v) => !v)} style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 13px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{newTemplate ? "Cancel" : "+ New Template"}</button>}
        {tab === "campaigns" && canCamp && <button type="button" onClick={() => setNewCampaign((v) => !v)} style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 13px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{newCampaign ? "Cancel" : "+ New Campaign"}</button>}
      </div>

      {/* ============ INBOX ============ */}
      {tab === "inbox" && (
        <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 16, alignItems: "start" }}>
          <div style={{ ...box, padding: 10 }}>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>
              {["All", ...CHANNELS].map((ch) => <button key={ch} type="button" onClick={() => setChFilter(ch)} style={{ border: "none", cursor: "pointer", background: chFilter === ch ? "var(--teal)" : "#eef2f1", color: chFilter === ch ? "#fff" : "var(--muted)", borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>{ch}</button>)}
            </div>
            <div style={{ maxHeight: 520, overflow: "auto" }}>
              {convs.map(({ c, last, unread }) => (
                <div key={c.id} onClick={() => setActive(c.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 8px", borderRadius: 10, cursor: "pointer", background: activeId === c.id ? "var(--teal-light)" : "transparent" }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: c.color, color: "#fff", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 12, flexShrink: 0 }}>{initials(c.name)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <b style={{ fontSize: 13 }}>{c.name}</b>
                    <div style={{ color: "var(--muted)", fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{last.sender === "staff" ? "↩ " : ""}{last.body}</div>
                  </div>
                  <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                    {chBadge(last.channel)}
                    {unread > 0 ? <span style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--red)" }} /> : <span style={{ fontSize: 10, color: "var(--muted)" }}>{when(last.created_at).split(",")[0]}</span>}
                  </div>
                </div>
              ))}
              {convs.length === 0 && <div style={{ padding: 20, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>No conversations</div>}
            </div>
          </div>

          <div style={{ ...box, padding: activeClient ? 16 : 0, minHeight: 340 }}>
            {!activeClient ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", minHeight: 320 }}>Select a conversation to view messages</div>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
                  <div><b>{activeClient.name}</b> <span style={{ color: "var(--muted)", fontSize: 12 }}>· {activeClient.phone ?? "—"}</span></div>
                  <span style={{ flex: 1 }} />
                  <Link href={`/clients/${activeClient.id}`} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "5px 10px", fontSize: 12, textDecoration: "none", color: "var(--teal-dark)", fontWeight: 600 }}>Open 360° →</Link>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 400, overflow: "auto", padding: "8px 2px", background: "#f7f9f9", borderRadius: 10 }}>
                  {thread.map((m) => {
                    const out = m.sender === "staff";
                    return (
                      <div key={m.id} style={{ alignSelf: out ? "flex-end" : "flex-start", maxWidth: "76%", background: out ? "var(--teal)" : "#fff", color: out ? "#fff" : "inherit", border: out ? "none" : "1px solid var(--border)", borderRadius: 12, padding: "8px 11px", fontSize: 13 }}>
                        {m.body}
                        <div style={{ fontSize: 10, opacity: 0.75, marginTop: 3 }}>{out && m.sender_name ? `${m.sender_name} · ` : ""}{m.channel} · {when(m.created_at)}</div>
                      </div>
                    );
                  })}
                  {thread.length === 0 && <div style={{ textAlign: "center", color: "var(--muted)", fontSize: 13, padding: 16 }}>No messages yet</div>}
                </div>
                {canMsg && (
                  <form action={sendMessageStaff} onSubmit={() => setTimeout(() => setComposerText(""), 30)} style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
                    <input type="hidden" name="client_id" value={activeClient.id} />
                    <select name="channel" value={composerCh} onChange={(e) => setComposerCh(e.target.value)} style={{ ...inp, maxWidth: 120 }}>{CHANNELS.map((o) => <option key={o}>{o}</option>)}</select>
                    <select onChange={(e) => { const t = templates.find((x) => x.id === e.target.value); if (t) { setComposerText(fillVars(t.body, activeClient)); setComposerCh(t.channel); } e.currentTarget.selectedIndex = 0; }} style={{ ...inp, maxWidth: 150 }}>
                      <option value="">Template…</option>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    <textarea name="body" value={composerText} onChange={(e) => setComposerText(e.target.value)} placeholder="Type a message…" required rows={2} style={{ ...inp, flex: 1, minWidth: 200, resize: "vertical" }} />
                    <button type="submit" style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Send</button>
                  </form>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ============ TEMPLATES ============ */}
      {tab === "templates" && (
        <div>
          {newTemplate && (
            <form action={createTemplate} onSubmit={() => setTimeout(() => setNewTemplate(false), 50)} style={{ ...box, padding: 16, marginBottom: 16, display: "grid", gap: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <input name="name" placeholder="Template name" required style={inp} />
                <select name="channel" defaultValue="WhatsApp" style={inp}>{CHANNELS.map((o) => <option key={o}>{o}</option>)}</select>
                <select name="category" defaultValue="Retention" style={inp}>{["Scheduling", "Onboarding", "Billing", "Retention", "Engagement", "General"].map((o) => <option key={o}>{o}</option>)}</select>
              </div>
              <input name="subject" placeholder="Subject (for email)" required style={inp} />
              <textarea name="body" placeholder="Message body — use {name}, {code}…" required rows={3} style={{ ...inp, resize: "vertical" }} />
              <div><button type="submit" style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Save template</button></div>
            </form>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
            {templates.map((t) => (
              <div key={t.id} style={{ ...box, padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}><b style={{ fontSize: 14 }}>{t.name}</b><span style={{ flex: 1 }} />{chBadge(t.channel)}</div>
                <span style={{ background: "#eef2f1", color: "var(--muted)", borderRadius: 999, padding: "2px 9px", fontSize: 11 }}>{t.category}</span>
                <p style={{ fontSize: 12.5, color: "var(--muted)", whiteSpace: "pre-wrap", lineHeight: 1.5, margin: "10px 0 8px" }}>{t.body}</p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" onClick={() => { setTab("inbox"); if (activeClient) setComposerText(fillVars(t.body, activeClient)); setComposerCh(t.channel); }} style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Use</button>
                  {canCamp && <form action={archiveTemplate}><input type="hidden" name="id" value={t.id} /><button style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "5px 12px", fontSize: 12, cursor: "pointer", color: "var(--muted)" }}>Archive</button></form>}
                </div>
              </div>
            ))}
            {templates.length === 0 && <div style={{ color: "var(--muted)", fontSize: 13 }}>No templates yet.</div>}
          </div>
        </div>
      )}

      {/* ============ CAMPAIGNS ============ */}
      {tab === "campaigns" && (
        <div>
          <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
            {([["Sent campaigns", campaigns.filter((c) => c.status === "sent").length, `of ${campaigns.length} total`], ["Messages auto-sent", campaigns.reduce((s, c) => s + c.sent_count, 0), "this quarter"], ["Templates", templates.length, "reusable"]] as const).map(([k, v, d]) => (
              <div key={k} style={{ ...box, padding: "14px 18px", minWidth: 150 }}>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>{k}</div><div style={{ fontSize: 24, fontWeight: 700 }}>{v}</div><div style={{ fontSize: 11, color: "var(--muted)" }}>{d}</div>
              </div>
            ))}
          </div>
          {newCampaign && (
            <form action={createCampaign} onSubmit={() => setTimeout(() => setNewCampaign(false), 50)} style={{ ...box, padding: 16, marginBottom: 16, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
              <input name="name" placeholder="Campaign name" required style={inp} />
              <select name="template_id" required defaultValue="" style={inp}><option value="" disabled>Template…</option>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
              <select name="audience" defaultValue="all" style={inp}>{["all", "members", "subscribers", "lapsed"].map((o) => <option key={o} value={o}>{o}</option>)}</select>
              <button type="submit" style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Create</button>
            </form>
          )}
          <div style={{ ...box, padding: "6px 8px" }}>
            {campaigns.map((c) => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 10px", borderTop: "1px solid var(--border)", fontSize: 13 }}>
                <div style={{ flex: 1 }}>
                  <b>{c.name}</b>
                  <div style={{ color: "var(--muted)", fontSize: 12 }}>Audience: {c.audience} · Template: {c.templateName ?? "—"}</div>
                </div>
                <span style={{ background: "#eef2f1", color: "var(--muted)", borderRadius: 999, padding: "2px 9px", fontSize: 11 }}>{c.sent_count} sent</span>
                <span style={{ background: c.status === "sent" ? "var(--green-bg)" : "var(--amber-bg)", color: c.status === "sent" ? "#166534" : "#92400e", borderRadius: 999, padding: "2px 10px", fontSize: 11, fontWeight: 600 }}>{c.status}</span>
                {canCamp && c.status !== "sent" && <form action={sendCampaignNow}><input type="hidden" name="id" value={c.id} /><button style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Send now</button></form>}
              </div>
            ))}
            {campaigns.length === 0 && <div style={{ padding: 18, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>No campaigns yet.</div>}
          </div>
        </div>
      )}
    </div>
  );
}
