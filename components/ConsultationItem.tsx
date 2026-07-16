"use client";

import { useState } from "react";
import { completeConsultation, toggleConsultFlag } from "@/lib/actions";

export type Consult = {
  id: string;
  kind: string;
  status: string;
  summary: string | null;
  approved: boolean;
  shared: boolean;
  by_name: string | null;
  created_at: string;
  clientName?: string;
};

const chip = (bg: string, color: string): React.CSSProperties => ({
  background: bg, color, borderRadius: 999, padding: "2px 9px", fontSize: 11, fontWeight: 600,
});

export default function ConsultationItem({ c }: { c: Consult }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ borderTop: "1px solid var(--border)", padding: "12px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <b style={{ fontSize: 14 }}>{c.clientName ?? "Client"}</b>
        <span style={chip("var(--teal-light)", "var(--teal-dark)")}>{c.kind}</span>
        {c.status === "completed"
          ? <span style={chip("var(--green-bg)", "#166534")}>completed</span>
          : <span style={chip("#eef2f1", "var(--muted)")}>scheduled</span>}
        {c.approved && <span style={chip("var(--green-bg)", "#166534")}>✔ approved</span>}
        {c.shared && <span style={chip("var(--blue-bg)", "#1e40af")}>shared</span>}
        <span style={{ flex: 1 }} />
        {c.status !== "completed" ? (
          <button type="button" onClick={() => setOpen((o) => !o)} style={{ border: "none", background: "var(--teal)", color: "#fff", borderRadius: 8, padding: "6px 11px", fontSize: 12, cursor: "pointer" }}>
            {open ? "Cancel" : "Complete & summarize"}
          </button>
        ) : (
          <>
            <form action={toggleConsultFlag}>
              <input type="hidden" name="id" value={c.id} />
              <input type="hidden" name="field" value="approved" />
              <input type="hidden" name="value" value={String(c.approved)} />
              <button type="submit" style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "6px 11px", fontSize: 12, cursor: "pointer" }}>
                {c.approved ? "Unapprove" : "Approve"}
              </button>
            </form>
            <form action={toggleConsultFlag}>
              <input type="hidden" name="id" value={c.id} />
              <input type="hidden" name="field" value="shared" />
              <input type="hidden" name="value" value={String(c.shared)} />
              <button type="submit" style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "6px 11px", fontSize: 12, cursor: "pointer" }}>
                {c.shared ? "Unshare" : "Share with client"}
              </button>
            </form>
          </>
        )}
      </div>

      {c.summary && (
        <div style={{ marginTop: 8, fontSize: 13, color: "var(--ink)", background: "#f8fbfa", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px" }}>
          {c.summary}
        </div>
      )}

      {open && c.status !== "completed" && (
        <form action={completeConsultation} onSubmit={() => setTimeout(() => setOpen(false), 50)} style={{ marginTop: 10 }}>
          <input type="hidden" name="id" value={c.id} />
          <textarea
            name="summary" rows={3} required
            placeholder="Consultation summary (findings, plan, recommendations)…"
            style={{ width: "100%", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14, background: "#fff" }}
          />
          <button type="submit" style={{ marginTop: 8, background: "var(--teal)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Save & complete
          </button>
        </form>
      )}
    </div>
  );
}
