"use client";

import { useState, useTransition } from "react";
import { deliverDocument } from "@/lib/actions";
import type { DocKind } from "@/lib/pdf";

/**
 * "Send to client" — one button for the whole errand.
 *
 * Replaces the row of three (Generate PDF file · Share to portal · Send on
 * WhatsApp). Those were three real operations, but nobody ever wanted just one
 * of them, and splitting them meant documents got rendered and then never
 * delivered.
 *
 * Two clicks, not one, and deliberately so: a prescription leaving the clinic
 * should not be reachable by a stray click, and WhatsApp has no unsend. The
 * confirm names the client and says where it is going, so the second click is
 * informed rather than ceremonial.
 */
export default function DeliverButton({
  kind, id, clientName, ready, missing, whatsappReady, alreadySent,
}: {
  kind: DocKind;
  id: string;
  clientName?: string | null;
  /** PDF rendering configured? */
  ready: boolean;
  missing: string[];
  /** WhatsApp configured? Portal-only delivery is still a valid setup. */
  whatsappReady: boolean;
  /** ISO date it was last delivered, if it has been. */
  alreadySent?: string | null;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, start] = useTransition();
  const [done, setDone] = useState<{ note?: string; url?: string; name?: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (!ready) {
    return (
      <span style={{ fontSize: 11.5, color: "var(--muted)" }}>
        Sending isn&apos;t set up yet{missing.length ? ` — needs ${missing.join(", ")}` : ""}.
      </span>
    );
  }

  const who = clientName ? clientName.split(" ")[0] : "the client";
  const where = whatsappReady ? "their portal and WhatsApp" : "their portal";

  const go = () => {
    setErr(null);
    start(async () => {
      const fd = new FormData();
      fd.set("kind", kind); fd.set("id", id);
      const r = await deliverDocument(fd);
      if (r.error) setErr(r.error);
      else { setDone({ note: r.note, url: r.url, name: r.name }); setConfirming(false); }
    });
  };

  if (done) {
    return (
      <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--green-text)" }}>✓ Sent to {who}</span>
        {done.note && <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{done.note}</span>}
        {done.url && (
          <a href={done.url} target="_blank" rel="noopener" download={done.name}
             style={{ fontSize: 11.5, fontWeight: 600, color: "var(--brand-text)", textDecoration: "none" }}>
            Open the file →
          </a>
        )}
      </div>
    );
  }

  return (
    <div style={{ marginTop: 8 }}>
      {!confirming ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <button type="button" onClick={() => setConfirming(true)}
            style={{ border: "none", background: "var(--ink)", color: "#fff", borderRadius: 8, padding: "7px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
            Send to client
          </button>
          {/* Re-sending is legitimate — a revised prescription, a lost message —
              so say it has gone rather than disabling the button. */}
          {alreadySent && (
            <span style={{ fontSize: 11.5, color: "var(--muted)" }}>
              Already sent {new Date(alreadySent).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })}
            </span>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", background: "var(--amber-bg)", borderRadius: 10, padding: "9px 12px" }}>
          <span style={{ fontSize: 12.5, color: "var(--amber-text)", flex: 1, minWidth: 200 }}>
            Send to {who} — it goes to {where}.
          </span>
          <button type="button" onClick={go} disabled={busy}
            style={{ border: "none", background: "var(--ink)", color: "#fff", borderRadius: 8, padding: "6px 14px", fontSize: 12.5, fontWeight: 600, cursor: busy ? "default" : "pointer" }}>
            {busy ? "Sending…" : "Send"}
          </button>
          <button type="button" onClick={() => setConfirming(false)} disabled={busy}
            style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
            Cancel
          </button>
        </div>
      )}
      {err && <div style={{ fontSize: 11.5, color: "var(--red-text)", marginTop: 6 }}>{err}</div>}
    </div>
  );
}
