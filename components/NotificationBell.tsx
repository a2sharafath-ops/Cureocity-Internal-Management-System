"use client";

import { useState } from "react";
import Link from "next/link";
import { openNotification, markAllNotificationsRead } from "@/lib/actions";

type Notif = { id: string; title: string; body: string | null; href: string | null; icon: string | null; read: boolean; created_at: string };

function ago(iso: string) {
  const s = Math.floor((Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export default function NotificationBell({ items, unread }: { items: Notif[]; unread: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button type="button" onClick={() => setOpen((o) => !o)} title="Notifications"
        style={{ position: "relative", border: "1px solid var(--border)", background: "#fff", borderRadius: 8, width: 34, height: 34, cursor: "pointer", fontSize: 16 }}>
        🔔
        {unread > 0 && <span style={{ position: "absolute", top: -6, right: -6, background: "var(--red)", color: "#fff", borderRadius: 999, minWidth: 17, height: 17, fontSize: 10, fontWeight: 700, display: "grid", placeItems: "center", padding: "0 4px" }}>{unread > 9 ? "9+" : unread}</span>}
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
          <div style={{ position: "absolute", right: 0, top: 40, width: 320, maxHeight: 420, overflow: "auto", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "0 12px 30px rgba(0,0,0,0.14)", zIndex: 41 }}>
            <div style={{ display: "flex", alignItems: "center", padding: "10px 14px", borderBottom: "1px solid var(--border)" }}>
              <b style={{ fontSize: 13 }}>Notifications</b>
              <span style={{ flex: 1 }} />
              {unread > 0 && (
                <form action={markAllNotificationsRead}><button type="submit" style={{ border: "none", background: "transparent", color: "var(--teal-dark)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Mark all read</button></form>
              )}
            </div>
            {items.length === 0 && <div style={{ padding: "22px 14px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>You're all caught up.</div>}
            {items.map((n) => {
              const body = (
                <div style={{ display: "flex", gap: 10, padding: "10px 14px", borderBottom: "1px solid var(--border)", background: n.read ? "transparent" : "rgba(13,148,136,0.06)" }}>
                  <div style={{ fontSize: 16 }}>{n.icon ?? "🔔"}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: n.read ? 500 : 700 }}>{n.title}</div>
                    {n.body && <div style={{ fontSize: 12, color: "var(--muted)" }}>{n.body}</div>}
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{ago(n.created_at)} ago</div>
                  </div>
                  {!n.read && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--teal)", marginTop: 5 }} />}
                </div>
              );
              return (
                <form key={n.id} action={openNotification} onSubmit={() => setOpen(false)}>
                  <input type="hidden" name="id" value={n.id} />
                  <input type="hidden" name="href" value={n.href ?? ""} />
                  <button type="submit" style={{ display: "block", width: "100%", textAlign: "left", border: "none", background: "transparent", padding: 0, cursor: "pointer" }}>
                    {body}
                  </button>
                </form>
              );
            })}
            <Link href="/alerts" onClick={() => setOpen(false)} style={{ display: "block", textAlign: "center", padding: "11px 14px", borderTop: "1px solid var(--border)", color: "var(--teal-dark)", fontSize: 13, fontWeight: 600, textDecoration: "none", position: "sticky", bottom: 0, background: "var(--card)" }}>
              See all notifications →
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
