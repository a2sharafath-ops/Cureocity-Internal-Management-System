"use client";

import { useState, useTransition } from "react";
import { renderDocument } from "@/lib/actions";
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
  kind, id, ready, missing, label = "Generate PDF file",
}: {
  kind: DocKind;
  id: string;
  ready: boolean;
  missing: string[];
  label?: string;
}) {
  const [busy, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [file, setFile] = useState<{ url?: string; name?: string } | null>(null);

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
      else setFile({ url: r.url, name: r.name });
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
      {err && <span style={{ fontSize: 11.5, color: "var(--red-text)" }}>{err}</span>}
    </span>
  );
}
