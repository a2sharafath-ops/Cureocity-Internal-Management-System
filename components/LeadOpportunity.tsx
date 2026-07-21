"use client";

// The light opportunity — expected package, value and close date.
//
// Not Salesforce's Opportunity object. That exists for negotiated B2B deals
// with many stakeholders and bespoke pricing. Cureocity sells a fixed
// catalogue at published prices to individuals, so three fields give you
// weighted pipeline without the machinery.
//
// Disqualification lives here too, because it's the other half of the same
// question: is this a real deal, and if so how big?

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { setLeadOpportunity, disqualifyLead, requalifyLead, DISQUALIFY_REASONS } from "@/lib/actions";
import { STAGE_PROBABILITY } from "@/lib/pipeline";

const money = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

const box: React.CSSProperties = {
  background: "var(--card)", border: "1px solid var(--border)",
  borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "16px 18px", marginTop: 16,
};
const field: React.CSSProperties = {
  border: "1px solid var(--border)", borderRadius: 8, padding: "6px 9px",
  fontSize: 12.5, background: "#fff",
};
const btn: React.CSSProperties = {
  border: "1px solid var(--border)", background: "#fff", borderRadius: 8,
  padding: "6px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", color: "var(--ink)",
};

function Save() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}
      style={{ ...btn, background: "var(--ink)", color: "#fff", border: "none", opacity: pending ? 0.6 : 1 }}>
      {pending ? "Saving…" : "Save"}
    </button>
  );
}

export default function LeadOpportunity({
  leadId, stage, packages, expectedPackageId, expectedValue, expectedClose,
  disqualifiedAt, disqualifiedReason, disqualifiedBy, canWrite,
}: {
  leadId: string;
  stage: string | null;
  packages: { id: string; name: string; price: number }[];
  expectedPackageId: string | null;
  expectedValue: number | null;
  expectedClose: string | null;
  disqualifiedAt: string | null;
  disqualifiedReason: string | null;
  disqualifiedBy: string | null;
  canWrite: boolean;
}) {
  const [state, action] = useFormState(setLeadOpportunity, {} as { ok?: string; error?: string });
  const [showDq, setShowDq] = useState(false);
  const [pkgId, setPkgId] = useState(expectedPackageId ?? "");

  const prob = STAGE_PROBABILITY[stage ?? ""] ?? 0;
  const weighted = expectedValue != null ? expectedValue * prob : null;
  const chosen = packages.find((p) => p.id === pkgId);
  const dqLabel = DISQUALIFY_REASONS.find((r) => r.key === disqualifiedReason)?.label ?? disqualifiedReason;

  if (disqualifiedAt) {
    return (
      <div style={{ ...box, borderColor: "var(--red-bg)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontWeight: 700 }}>🚫 Disqualified</div>
          <span style={{ background: "var(--red-bg)", color: "var(--red-text)", borderRadius: 999, padding: "2px 9px", fontSize: 11, fontWeight: 700 }}>
            {dqLabel}
          </span>
          <span style={{ flex: 1 }} />
          {canWrite && (
            <form action={requalifyLead}>
              <input type="hidden" name="lead_id" value={leadId} />
              <button type="submit" style={btn}>Requalify</button>
            </form>
          )}
        </div>
        <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>
          Never a real opportunity — excluded from pipeline value and from conversion rates.
          {disqualifiedBy ? ` Marked by ${disqualifiedBy}.` : ""}
        </div>
      </div>
    );
  }

  return (
    <div style={box}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontWeight: 700 }}>💼 Opportunity</div>
        {weighted != null && (
          <span style={{ background: "var(--blue-bg)", color: "var(--blue-text)", borderRadius: 999, padding: "2px 9px", fontSize: 11, fontWeight: 700 }}>
            {money(weighted)} weighted
          </span>
        )}
      </div>
      <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 3 }}>
        What we expect this to be worth, and when. Feeds the pipeline forecast —
        {stage ? ` this stage closes ${Math.round(prob * 100)}% of the time.` : " set a stage to weight it."}
      </div>

      {canWrite && (
        <form action={action} style={{ display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center", marginTop: 11 }}>
          <input type="hidden" name="lead_id" value={leadId} />
          <select name="expected_package_id" value={pkgId} onChange={(e) => setPkgId(e.target.value)} style={field}>
            <option value="">No package chosen</option>
            {packages.map((p) => <option key={p.id} value={p.id}>{p.name} — {money(p.price)}</option>)}
          </select>
          <input
            name="expected_value" type="number" min="0" step="100"
            // Re-keyed so choosing a package refreshes the suggested price
            // rather than leaving a stale number the user didn't pick.
            key={pkgId}
            defaultValue={expectedValue ?? (chosen ? chosen.price : "")}
            placeholder="Expected ₹" style={{ ...field, width: 130 }}
          />
          <input name="expected_close" type="date" defaultValue={expectedClose ?? ""} style={field} />
          <Save />
        </form>
      )}
      {expectedValue != null && (
        <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 6 }}>
          {money(expectedValue)} × {Math.round(prob * 100)}% = {money(weighted ?? 0)} in the forecast
          {expectedClose ? `, expected by ${expectedClose}` : ", no close date set"}
        </div>
      )}

      {state.error && (
        <div style={{ marginTop: 9, background: "var(--red-bg)", color: "var(--red-text)", borderRadius: 8, padding: "6px 9px", fontSize: 12 }}>{state.error}</div>
      )}
      {state.ok && (
        <div style={{ marginTop: 9, background: "var(--green-bg)", color: "var(--green-text)", borderRadius: 8, padding: "6px 9px", fontSize: 12 }}>{state.ok}</div>
      )}

      {canWrite && (
        <div style={{ borderTop: "1px solid var(--border)", marginTop: 12, paddingTop: 10 }}>
          {!showDq ? (
            <button type="button" onClick={() => setShowDq(true)}
              style={{ ...btn, border: "none", background: "transparent", color: "var(--muted)", padding: 0, fontSize: 11.5 }}>
              Not a real opportunity? Disqualify →
            </button>
          ) : (
            <form action={disqualifyLead} style={{ display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center" }}>
              <input type="hidden" name="lead_id" value={leadId} />
              <span style={{ fontSize: 11.5, color: "var(--muted)" }}>Reason</span>
              <select name="reason" required defaultValue="" style={field}>
                <option value="" disabled>Choose…</option>
                {DISQUALIFY_REASONS.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
              </select>
              <button type="submit" style={{ ...btn, color: "var(--red-text)" }}>Disqualify</button>
              <button type="button" onClick={() => setShowDq(false)}
                style={{ ...btn, border: "none", background: "transparent", color: "var(--muted)" }}>Cancel</button>
              <div style={{ fontSize: 10.5, color: "var(--muted)", width: "100%" }}>
                Different from Lost. Lost means we competed and lost; disqualified means
                this was never a prospect, so it leaves the pipeline and the conversion rate.
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
