"use client";

import { useState } from "react";
import Link from "next/link";
import { toggleConsultFlag, saveConsolidatedSummary, signoffConsolidated, startConsult } from "@/lib/actions";
import { disciplineLabel } from "@/lib/disciplines";

export type ConsultSummary = {
  id: string;
  client_id: string | null;
  client_name: string | null;
  summary: string | null;
  status: string;
  approved: boolean;
  shared: boolean;
  created_at: string;
};

export type ConsolidatedRow = {
  client_id: string;
  name: string;
  code: string | null;
  /** disciplines assigned to this client — the required signers */
  required: string[];
  /** individual consultation summary approved, per discipline */
  approvedByDisc: Record<string, boolean>;
  /** consolidated summary signed off, per discipline */
  signedByDisc: Record<string, boolean>;
  generated: boolean;
  consolidated: string | null;
};

const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };

/**
 * A summary is a clinical document, so the list says whether one exists and
 * links to the PDF rather than reprinting the prose. The console is the only
 * place the text is shown, because that is the only place it can be edited —
 * anywhere else it is a document to open, not a paragraph to skim.
 */
function SummaryStatus({ id, text, status }: { id: string; text: string | null; status: string }) {
  const has = !!text?.trim();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4, flexWrap: "wrap" }}>
      <span style={{ fontSize: 12.5, color: has ? "var(--ink)" : "var(--muted)" }}>
        {has ? `Summary recorded · ${text!.trim().split(/\s+/).length} words` : "No summary written yet."}
      </span>
      {has && (
        <a href={`/consult/${id}/print`} target="_blank" rel="noopener"
           style={{ fontSize: 12, fontWeight: 600, color: "var(--brand-text)", textDecoration: "none" }}>
          View PDF →
        </a>
      )}
      {!has && status !== "completed" && (
        <span style={{ fontSize: 11.5, color: "var(--muted)" }}>Open the console to write it.</span>
      )}
    </div>
  );
}

export default function SummariesPanel({
  roleLabel, roleKind, consults, consolidated, clients, viewerDisc = null, canSignAny = false,
}: {
  roleLabel: string;
  roleKind: string;
  consults: ConsultSummary[];
  consolidated: ConsolidatedRow[];
  clients: { id: string; name: string }[];
  /** the viewing clinician's discipline (doctor/dietitian/...) */
  viewerDisc?: string | null;
  /** admins/persona previews may sign off any discipline */
  canSignAny?: boolean;
}) {
  const [view, setView] = useState<"individual" | "consolidated">("individual");
  const pending = consults.filter((c) => !c.approved).length;
  const consolPending = consolidated.filter((c) => !c.generated).length;

  const seg = (k: "individual" | "consolidated", label: string, n: number) => (
    <button type="button" onClick={() => setView(k)} style={{
      padding: "7px 14px", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none",
      background: view === k ? "var(--card)" : "transparent", color: view === k ? "var(--ink)" : "var(--muted)",
      boxShadow: view === k ? "var(--shadow)" : "none",
    }}>{label} <span style={{ background: view === k ? "var(--brand-tint)" : "#e7e7ea", color: view === k ? "var(--brand-text)" : "var(--muted)", borderRadius: 999, padding: "0 7px", fontSize: 11, fontWeight: 700 }}>{n}</span></button>
  );
  const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  const disc = (on: boolean, label: string) => (
    <span style={{ background: on ? "var(--green-bg)" : "var(--neutral-bg)", color: on ? "var(--green-text)" : "var(--muted)", borderRadius: 999, padding: "2px 9px", fontSize: 10.5, fontWeight: 700 }}>{on ? "✓" : "○"} {label}</span>
  );

  return (
    <div>
      <div style={{ display: "inline-flex", gap: 4, padding: 4, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 12, marginBottom: 14 }}>
        {seg("individual", "Individual summaries", pending)}
        {seg("consolidated", "Consolidated → BluePrint", consolPending)}
      </div>

      {view === "individual" ? (
        <>
        <form action={startConsult} style={{ ...box, padding: 12, marginBottom: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input type="hidden" name="kind" value={roleKind} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>▶ Start a {roleLabel} consultation</span>
          <span style={{ flex: 1 }} />
          <select name="client_id" required defaultValue="" style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", fontSize: 13, background: "#fff" }}>
            <option value="" disabled>Select client…</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Open console →</button>
        </form>

        <div style={{ ...box, overflow: "hidden" }}>
          <div style={{ padding: "10px 16px", fontSize: 12.5, color: "var(--muted)" }}>Approve your {roleLabel} consultation summaries. Approved summaries feed the client&apos;s BluePrint sign-off.</div>
          {consults.length ? consults.map((c) => (
            <div key={c.id} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 16px", borderTop: "1px solid var(--border)", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <b style={{ fontSize: 13 }}>{c.client_name ?? "—"}</b>
                  <span style={{ color: "var(--muted)", fontSize: 11.5 }}>{fmt(c.created_at)} · {c.status}</span>
                  {c.approved && <span style={{ background: "var(--green-bg)", color: "var(--green-text)", borderRadius: 999, padding: "1px 8px", fontSize: 10.5, fontWeight: 700 }}>✓ Approved</span>}
                  {c.shared && <span style={{ background: "var(--blue-bg)", color: "var(--blue-text)", borderRadius: 999, padding: "1px 8px", fontSize: 10.5, fontWeight: 700 }}>Shared</span>}
                </div>
                <SummaryStatus id={c.id} text={c.summary} status={c.status} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, marginLeft: "auto" }}>
                <Link href={`/console/${c.id}`} style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "5px 11px", fontSize: 12, fontWeight: 600, textDecoration: "none", color: "var(--ink)", whiteSpace: "nowrap" }}>{c.status === "completed" ? "Open" : "▶ Console"}</Link>
                <form action={toggleConsultFlag}>
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="field" value="approved" />
                  <input type="hidden" name="value" value={String(c.approved)} />
                  <button style={{ background: c.approved ? "#fff" : "var(--ink)", color: c.approved ? "var(--muted)" : "#fff", border: c.approved ? "1px solid var(--border)" : "none", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>{c.approved ? "Unapprove" : "Approve"}</button>
                </form>
                <form action={toggleConsultFlag}>
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="field" value="shared" />
                  <input type="hidden" name="value" value={String(c.shared)} />
                  <button style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "5px 11px", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "var(--brand-text)", whiteSpace: "nowrap" }}>{c.shared ? "Unshare" : "Share"}</button>
                </form>
              </div>
            </div>
          )) : <div style={{ padding: "22px 16px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>No {roleLabel} summaries yet.</div>}
        </div>
        </>
      ) : (
        <div>
          <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 10 }}>Every Health Professional assigned to the client must sign off the consolidated summary. The BluePrint generates automatically once <b>all</b> of them have signed.</div>
          <div style={{ ...box, overflow: "hidden" }}>
            {consolidated.length ? consolidated.map((c) => {
              const req = c.required.length ? c.required : ["doctor", "dietitian", "trainer"];
              const signedCount = req.filter((d) => c.signedByDisc[d]).length;
              // The viewer can sign off if: their discipline is required, they
              // haven't signed, there's a consolidated summary, and their own
              // summary is approved (or no consult of theirs exists). Admins any.
              const mineReq = viewerDisc && req.includes(viewerDisc);
              const mineSigned = viewerDisc ? c.signedByDisc[viewerDisc] : false;
              const mineApproved = viewerDisc ? (c.approvedByDisc[viewerDisc] ?? false) : false;
              const canSignMine = !c.generated && Boolean(c.consolidated) && mineReq && !mineSigned && (mineApproved || canSignAny);
              return (
                <div key={c.client_id} style={{ padding: "13px 16px", borderTop: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <b style={{ fontSize: 13 }}>{c.name} <span style={{ color: "var(--muted)", fontWeight: 500 }}>{c.code ? `· ${c.code}` : ""}</span></b>
                      <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
                        {req.map((d) => disc(c.signedByDisc[d], disciplineLabel(d)))}
                      </div>
                    </div>
                    {c.generated
                      ? <Link href="/blueprint" style={{ background: "var(--green-bg)", color: "var(--green-text)", borderRadius: 999, padding: "5px 12px", fontSize: 12, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" }}>BluePrint generated — view</Link>
                      : <span style={{ background: signedCount === req.length ? "var(--green-bg)" : "var(--amber-bg)", color: signedCount === req.length ? "var(--green-text)" : "var(--amber-text)", borderRadius: 999, padding: "5px 12px", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>{signedCount}/{req.length} signed off</span>}
                  </div>

                  {!c.generated && (
                    <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                      {/* Author / edit the consolidated summary (until generated). */}
                      <form action={saveConsolidatedSummary} style={{ display: "grid", gap: 6 }}>
                        <input type="hidden" name="client_id" value={c.client_id} />
                        <textarea name="consolidated" rows={2} defaultValue={c.consolidated ?? ""} placeholder="Consolidated summary across the care team…" style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", fontSize: 13, background: "#fff", resize: "vertical" }} />
                        <div>
                          <button style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Save consolidated summary</button>
                        </div>
                      </form>

                      {/* This clinician's own sign-off. */}
                      {mineReq && (
                        mineSigned
                          ? <span style={{ color: "var(--green-text)", fontSize: 12.5, fontWeight: 600 }}>✓ You signed off ({disciplineLabel(viewerDisc!)})</span>
                          : canSignMine
                            ? <form action={signoffConsolidated}>
                                <input type="hidden" name="client_id" value={c.client_id} />
                                {canSignAny && viewerDisc && <input type="hidden" name="discipline" value={viewerDisc} />}
                                <button style={{ background: "var(--brand-fill)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>✓ Sign off consolidated summary</button>
                              </form>
                            : <span style={{ color: "var(--muted)", fontSize: 12 }}>{!c.consolidated ? "Waiting for a consolidated summary to be written." : "Approve your own consultation summary first, then sign off here."}</span>
                      )}
                    </div>
                  )}
                </div>
              );
            }) : <div style={{ padding: "22px 16px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>No BluePrint-package clients yet.</div>}
          </div>
        </div>
      )}
    </div>
  );
}
