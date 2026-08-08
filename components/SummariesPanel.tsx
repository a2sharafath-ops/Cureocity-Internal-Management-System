"use client";

import { useState } from "react";
import Link from "next/link";
import { toggleConsultFlag, saveConsolidatedSummary, signoffConsolidated, startConsult, cancelConsultation, deleteEmptyConsultation } from "@/lib/actions";
import { disciplineLabel } from "@/lib/disciplines";
import { CANCELLED } from "@/lib/consult-lifecycle";

export type ConsultSummary = {
  id: string;
  client_id: string | null;
  client_name: string | null;
  summary: string | null;
  status: string;
  approved: boolean;
  shared: boolean;
  created_at: string;
  /** Nothing clinical was ever recorded against it — safe to destroy. */
  canDelete?: boolean;
  /** Why it can't be — shown so "Cancel instead" doesn't look arbitrary. */
  keepReason?: string | null;
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
const toggleConsultFlagForm = async (formData: FormData) => {
  await toggleConsultFlag(formData);
};
const cancelConsultationForm = async (formData: FormData) => {
  await cancelConsultation(formData);
};
const deleteEmptyConsultationForm = async (formData: FormData) => {
  await deleteEmptyConsultation(formData);
};

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

/**
 * One consultation in the list, with its removal controls.
 *
 * Split out of the panel because the confirm strip needs per-row state. Removal
 * is deliberately two clicks and never sits next to Approve — a stray click on
 * a row you're signing off shouldn't be able to take the consultation away.
 */
function ConsultRow({ c, fmt }: { c: ConsultSummary; fmt: (iso: string) => string }) {
  const [confirming, setConfirming] = useState(false);
  const cancelled = c.status === CANCELLED;

  const btn: React.CSSProperties = { border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "5px 11px", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" };

  return (
    <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", background: cancelled ? "var(--neutral-bg)" : undefined }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap", opacity: cancelled ? 0.62 : 1 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <b style={{ fontSize: 13, textDecoration: cancelled ? "line-through" : "none" }}>{c.client_name ?? "—"}</b>
            <span style={{ color: "var(--muted)", fontSize: 11.5 }}>{fmt(c.created_at)} · {c.status}</span>
            {cancelled && <span style={{ background: "var(--neutral-bg)", color: "var(--muted)", border: "1px solid var(--border)", borderRadius: 999, padding: "1px 8px", fontSize: 10.5, fontWeight: 700 }}>Cancelled</span>}
            {!cancelled && c.approved && <span style={{ background: "var(--green-bg)", color: "var(--green-text)", borderRadius: 999, padding: "1px 8px", fontSize: 10.5, fontWeight: 700 }}>✓ Approved</span>}
            {!cancelled && c.shared && <span style={{ background: "var(--blue-bg)", color: "var(--blue-text)", borderRadius: 999, padding: "1px 8px", fontSize: 10.5, fontWeight: 700 }}>Shared</span>}
          </div>
          <SummaryStatus id={c.id} text={c.summary} status={c.status} />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, marginLeft: "auto" }}>
          {cancelled ? (
            // Undo, and — when nothing was ever recorded against it — remove.
            //
            // Approving or sharing something that was called off would be a
            // nonsense, so those stay hidden. But a cancelled EMPTY row is
            // exactly the thing people want gone: a booking that never happened,
            // sitting in the list for ever. Offering only Undo left no way to
            // get rid of it at all.
            <>
              <form action={cancelConsultationForm}>
                <input type="hidden" name="id" value={c.id} />
                <input type="hidden" name="undo" value="true" />
                <button style={btn}>Undo cancel</button>
              </form>
              {c.canDelete && (
                <button type="button" onClick={() => setConfirming((v) => !v)} title="Delete this cancelled consultation"
                  style={{ ...btn, border: "none", background: "transparent", color: "var(--muted)", padding: "5px 8px" }}>
                  {confirming ? "✕" : "Remove…"}
                </button>
              )}
            </>
          ) : (
            <>
              <Link href={`/console/${c.id}`} style={{ ...btn, textDecoration: "none", color: "var(--ink)" }}>{c.status === "completed" ? "Open" : "▶ Console"}</Link>
              <form action={toggleConsultFlagForm}>
                <input type="hidden" name="id" value={c.id} />
                <input type="hidden" name="field" value="approved" />
                <input type="hidden" name="value" value={String(c.approved)} />
                <button style={{ ...btn, background: c.approved ? "#fff" : "var(--ink)", color: c.approved ? "var(--muted)" : "#fff", border: c.approved ? "1px solid var(--border)" : "none", padding: "5px 12px" }}>{c.approved ? "Unapprove" : "Approve"}</button>
              </form>
              <form action={toggleConsultFlagForm}>
                <input type="hidden" name="id" value={c.id} />
                <input type="hidden" name="field" value="shared" />
                <input type="hidden" name="value" value={String(c.shared)} />
                <button style={{ ...btn, color: "var(--brand-text)" }}>{c.shared ? "Unshare" : "Share"}</button>
              </form>
              <button type="button" onClick={() => setConfirming((v) => !v)} title="Cancel or remove this consultation"
                style={{ ...btn, border: "none", background: "transparent", color: "var(--muted)", padding: "5px 8px" }}>
                {confirming ? "✕" : "Remove…"}
              </button>
            </>
          )}
        </div>
      </div>

      {confirming && cancelled && c.canDelete && (
        <div style={{ marginTop: 10, padding: "10px 12px", background: "var(--amber-bg)", borderRadius: 10, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 12.5, color: "var(--amber-text)", flex: 1, minWidth: 220 }}>
            Nothing was recorded against this one. Deleting removes it for good.
          </span>
          <form action={deleteEmptyConsultationForm}>
            <input type="hidden" name="id" value={c.id} />
            <button style={{ ...btn, border: "1px solid var(--red)", color: "var(--red)" }}>Delete permanently</button>
          </form>
          <button type="button" onClick={() => setConfirming(false)} style={btn}>Keep it</button>
        </div>
      )}

      {confirming && !cancelled && (
        <div style={{ marginTop: 10, padding: "10px 12px", background: "var(--amber-bg)", borderRadius: 10, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 12.5, color: "var(--amber-text)", flex: 1, minWidth: 220 }}>
            {c.canDelete
              ? "Nothing has been recorded against this one. Cancel keeps it on the record; delete removes it entirely."
              : `Cancelling keeps the record and stops it counting as outstanding. It can't be deleted — ${c.keepReason}.`}
          </span>
          <form action={cancelConsultationForm}>
            <input type="hidden" name="id" value={c.id} />
            <button style={btn}>Cancel consultation</button>
          </form>
          {c.canDelete && (
            <form action={deleteEmptyConsultationForm}>
              <input type="hidden" name="id" value={c.id} />
              <button style={{ ...btn, border: "1px solid var(--red)", color: "var(--red)" }}>Delete permanently</button>
            </form>
          )}
        </div>
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
  // A cancelled consultation is not outstanding work — it is the opposite.
  const pending = consults.filter((c) => !c.approved && c.status !== CANCELLED).length;
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
          {consults.length
            ? consults.map((c) => <ConsultRow key={c.id} c={c} fmt={fmt} />)
            : <div style={{ padding: "22px 16px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>No {roleLabel} summaries yet.</div>}
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
