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
        <span style={chip("var(--brand-tint)", "var(--brand-text)")}>{c.kind}</span>
        {c.status === "completed"
          ? <span style={chip("var(--green-bg)", "var(--green-text)")}>completed</span>
          : <span style={chip("var(--neutral-bg)", "var(--muted)")}>scheduled</span>}
        {c.approved && <span style={chip("var(--green-bg)", "var(--green-text)")}>✔ approved</span>}
        {c.shared && <span style={chip("var(--blue-bg)", "var(--blue-text)")}>shared</span>}
        <span style={{ flex: 1 }} />
        {c.status !== "completed" ? (
          <button type="button" onClick={() => setOpen((o) => !o)} style={{ border: "none", background: "var(--ink)", color: "#fff", borderRadius: 8, padding: "6px 11px", fontSize: 12, cursor: "pointer" }}>
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
        <div style={{ marginTop: 8, fontSize: 13, color: "var(--ink)", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px" }}>
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
          {/* Only the doctor is asked, and the answer is required — an
              unanswered null can't be distinguished from "no", so the 24h
              prescription clock would never start and a forgotten prescription
              would be invisible. One click, and "no" becomes a recorded fact. */}
          {c.kind === "Doctor" && (
            <div style={{ marginTop: 10, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 11px" }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>Does this client need a prescription?</div>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, marginRight: 16, cursor: "pointer" }}>
                <input type="radio" name="prescription_needed" value="true" required /> Yes
              </label>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                <input type="radio" name="prescription_needed" value="false" required /> No
              </label>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 5 }}>
                Answering yes starts a 24-hour clock to get it into the client&apos;s portal.
              </div>
            </div>
          )}
          <button type="submit" style={{ marginTop: 10, background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Save &amp; complete
          </button>
        </form>
      )}
    </div>
  );
}
