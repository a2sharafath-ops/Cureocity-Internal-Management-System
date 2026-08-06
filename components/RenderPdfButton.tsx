"use client";

import { useState, useTransition } from "react";
import { renderDocument, sendDocumentWhatsApp } from "@/lib/actions";
import type { DocKind } from "@/lib/pdf";

/**
 * Produce a real PDF file for a document, and hand back a link to it.
 *
 * Distinct from "Download / Print PDF", which asks the reader's own browser to
 * make a throwaway copy. This stores a file: it can be attached to WhatsApp,
 * and it is a record of what the client was actually given — the print page
 * always shows today's data, so a revised plan silently rewrites history.
 *
 * When rendering isn't configured the button doesn't pretend: it says what is
 * missing, once, rather than failing on click.
 */
export default function RenderPdfButton({
  kind, id, ready, missing, label = "Generate PDF file", whatsapp,
}: {
  kind: DocKind;
  id: string;
  ready: boolean;
  missing: string[];
  label?: string;
  /** WhatsApp readiness. Omit to hide the send control entirely. */
  whatsapp?: { ready: boolean; missing: string[] };
}) {
  const [busy, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [file, setFile] = useState<{ url?: string; name?: string; docId?: string } | null>(null);
  const [sent, setSent] = useState(false);

  if (!ready) {
    return (
      <span style={{ fontSize: 11.5, color: "var(--muted)" }} title={missing.length ? `Needs ${missing.join(", ")}` : undefined}>
        PDF file generation not set up{missing.length ? ` — needs ${missing.join(", ")}` : ""}.
      </span>
    );
  }

  const go = () => {
    setErr(null); setFile(null);
    start(async () => {
      const fd = new FormData();
      fd.set("kind", kind); fd.set("id", id);
      const r = await renderDocument(fd);
      if (r.error) setErr(r.error);
      else { setFile({ url: r.url, name: r.name, docId: r.docId }); setSent(false); }
    });
  };

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <button type="button" onClick={go} disabled={busy}
        style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 12.5, fontWeight: 600, cursor: busy ? "default" : "pointer", color: "var(--ink)" }}>
        {busy ? "Rendering…" : label}
      </button>
      {file?.url && (
        <a href={file.url} target="_blank" rel="noopener" download={file.name}
          style={{ fontSize: 12, fontWeight: 600, color: "var(--brand-text)", textDecoration: "none" }}>
          ✓ {file.name} →
        </a>
      )}
      {/* Sending is a separate, deliberate act. Rendering a file is not the
          same as putting it in someone's hand, and conflating them would mean a
          preview reached the client. */}
      {file?.docId && whatsapp && !sent && (
        whatsapp.ready ? (
          <button type="button" disabled={busy}
            onClick={() => start(async () => {
              const fd = new FormData(); fd.set("doc_id", file.docId!);
              const r = await sendDocumentWhatsApp(fd);
              if (r.error) setErr(r.error); else { setSent(true); setErr(null); }
            })}
            style={{ border: "none", background: "var(--ink)", color: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 12.5, fontWeight: 600, cursor: busy ? "default" : "pointer" }}>
            Send on WhatsApp
          </button>
        ) : (
          <span style={{ fontSize: 11.5, color: "var(--muted)" }}>
            WhatsApp not set up{whatsapp.missing.length ? ` — needs ${whatsapp.missing.join(", ")}` : ""}.
          </span>
        )
      )}
      {sent && <span style={{ fontSize: 12, fontWeight: 600, color: "var(--green-text)" }}>✓ Sent on WhatsApp</span>}
      {err && <span style={{ fontSize: 11.5, color: "var(--red-text)" }}>{err}</span>}
    </span>
  );
}
