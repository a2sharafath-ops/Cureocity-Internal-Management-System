"use client";

import { useState } from "react";
import { generateBlueprint } from "@/lib/actions";

export default function BlueprintGenerate({
  clientId, generated, ready, consolidated,
}: { clientId: string; generated: boolean; ready: boolean; consolidated: string | null }) {
  const [open, setOpen] = useState(false);

  if (generated) {
    return <span style={{ background: "var(--green-bg)", color: "#166534", borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>🧬 Generated</span>;
  }

  if (!ready) {
    return <span style={{ background: "#eef2f1", color: "var(--muted)", borderRadius: 999, padding: "3px 10px", fontSize: 12 }}>In progress</span>;
  }

  return (
    <div>
      <button type="button" onClick={() => setOpen((o) => !o)} style={{ border: "none", background: "var(--ink)", color: "#fff", borderRadius: 8, padding: "6px 11px", fontSize: 12, cursor: "pointer" }}>
        {open ? "Cancel" : "Generate blueprint"}
      </button>
      {open && (
        <form action={generateBlueprint} style={{ marginTop: 8 }}>
          <input type="hidden" name="client_id" value={clientId} />
          <textarea
            name="consolidated" rows={3} defaultValue={consolidated ?? ""}
            placeholder="Consolidated summary across all consultations…"
            style={{ width: 320, maxWidth: "100%", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, background: "#fff" }}
          />
          <div>
            <button type="submit" style={{ marginTop: 6, background: "var(--brand-text)", color: "#fff", border: "none", borderRadius: 8, padding: "7px 13px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              Approve &amp; generate
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
