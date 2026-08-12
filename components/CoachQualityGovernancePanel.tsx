"use client";

import { useActionState } from "react";
import {
  approveCoachQualityStandard, proposeCoachQualityStandard,
  retireCoachQualityStandard, type CoachQualityGovernanceState,
} from "@/lib/actions";
import { COACH_AUDIT_DOMAINS } from "@/lib/coach-quality";
import {
  canApproveCoachQualityStandard, canProposeCoachQualityStandard,
  COACH_QUALITY_REVIEW_CADENCES, type CoachQualityStandard,
} from "@/lib/coach-quality-governance";

const box: React.CSSProperties = {
  background: "var(--card)", border: "1px solid var(--border)",
  borderRadius: "var(--radius)", boxShadow: "var(--shadow)",
};
const input: React.CSSProperties = {
  width: "100%", border: "1px solid var(--border)", borderRadius: 8,
  padding: "8px 10px", background: "#fff", font: "inherit", fontSize: 12.5,
  boxSizing: "border-box",
};
const label: React.CSSProperties = {
  display: "grid", gap: 4, color: "var(--muted)", fontSize: 11.5, fontWeight: 650,
};
const button: React.CSSProperties = {
  border: 0, borderRadius: 8, padding: "8px 12px", color: "#fff",
  background: "var(--ink)", cursor: "pointer", fontWeight: 700, fontSize: 12,
};

function ActionMessage({ state }: { state: CoachQualityGovernanceState }) {
  if (state.error) return <div style={{ background: "var(--red-bg)", color: "var(--red-text)", borderRadius: 8, padding: "8px 10px", fontSize: 12, fontWeight: 650 }}>{state.error}</div>;
  if (state.ok) return <div style={{ background: "var(--green-bg)", color: "var(--green-text)", borderRadius: 8, padding: "8px 10px", fontSize: 12, fontWeight: 650 }}>{state.ok}</div>;
  return null;
}

function StandardTargets({ standard }: { standard: CoachQualityStandard }) {
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 6 }}>
    {COACH_AUDIT_DOMAINS.map((domain) => <div key={domain.key} style={{ display: "flex", justifyContent: "space-between", gap: 8, border: "1px solid var(--border)", borderRadius: 7, padding: "6px 8px", fontSize: 11.5 }}><span>{domain.label}</span><b>≥{standard.targets[domain.key]}%</b></div>)}
  </div>;
}

function ProposalForm({ active }: { active: CoachQualityStandard | null }) {
  const [state, action] = useActionState<CoachQualityGovernanceState, FormData>(proposeCoachQualityStandard, {});
  return <details style={{ ...box, padding: 14 }}>
    <summary style={{ cursor: "pointer", fontWeight: 750, fontSize: 13.5 }}>+ Propose a new standard version</summary>
    <form action={action} style={{ display: "grid", gap: 12, marginTop: 12 }}>
      <ActionMessage state={state} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 9 }}>
        {COACH_AUDIT_DOMAINS.map((domain) => <label key={domain.key} style={label}>{domain.label}
          <span style={{ fontWeight: 400, fontSize: 10.5 }}>{domain.question}</span>
          <input name={`target_${domain.key}`} type="number" min={0} max={100} step={1} required defaultValue={active?.targets[domain.key] ?? ""} style={input} placeholder="0–100" />
        </label>)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label style={label}>Review cadence<select name="review_cadence" required defaultValue={active?.review_cadence ?? ""} style={input}><option value="" disabled>Select cadence</option>{COACH_QUALITY_REVIEW_CADENCES.map((cadence) => <option key={cadence}>{cadence}</option>)}</select></label>
        <label style={label}>Completed sessions sampled per coach, per cycle<input name="sample_size" type="number" min={1} max={100} step={1} required defaultValue={active?.sample_size ?? ""} style={input} /></label>
      </div>
      <label style={label}>When a result leads to coaching support<textarea name="coaching_trigger" required minLength={12} rows={3} defaultValue={active?.coaching_trigger} style={{ ...input, resize: "vertical" }} placeholder="Describe the agreed human response; software will not apply it automatically." /></label>
      <label style={label}>When a result requires clinical-governance review<textarea name="clinical_review_trigger" required minLength={12} rows={3} defaultValue={active?.clinical_review_trigger} style={{ ...input, resize: "vertical" }} placeholder="Describe the agreed escalation criteria, including safety or scope concerns." /></label>
      <label style={label}>Rationale for this version<textarea name="rationale" required minLength={12} rows={3} style={{ ...input, resize: "vertical" }} placeholder="Evidence, meeting or policy decision supporting these values." /></label>
      <div style={{ color: "var(--muted)", fontSize: 11 }}>Submitting creates a permanent draft. It does not change the dashboard until a different Medical Director approves it.</div>
      <button type="submit" style={{ ...button, justifySelf: "start" }}>Submit proposal</button>
    </form>
  </details>;
}

function MedicalDirectorDecision({ standard }: { standard: CoachQualityStandard }) {
  const [approvalState, approveAction] = useActionState<CoachQualityGovernanceState, FormData>(approveCoachQualityStandard, {});
  const [retireState, retireAction] = useActionState<CoachQualityGovernanceState, FormData>(retireCoachQualityStandard, {});
  return <div style={{ display: "grid", gap: 9, marginTop: 10 }}>
    {standard.status === "Draft" && <form action={approveAction} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 7 }}>
      <input type="hidden" name="standard_id" value={standard.id} />
      <input name="decision_note" required minLength={12} style={input} placeholder="Medical Director approval reason" />
      <button type="submit" style={{ ...button, background: "var(--green-text)" }}>Approve &amp; activate</button>
      <div style={{ gridColumn: "1 / -1" }}><ActionMessage state={approvalState} /></div>
    </form>}
    <form action={retireAction} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 7 }}>
      <input type="hidden" name="standard_id" value={standard.id} />
      <input name="decision_note" required minLength={12} style={input} placeholder={standard.status === "Draft" ? "Reason for rejecting/retiring this draft" : "Reason for retiring the active standard"} />
      <button type="submit" style={{ ...button, background: "var(--red-text)" }}>{standard.status === "Draft" ? "Retire draft" : "Retire standard"}</button>
      <div style={{ gridColumn: "1 / -1" }}><ActionMessage state={retireState} /></div>
    </form>
  </div>;
}

function statusStyle(status: CoachQualityStandard["status"]): React.CSSProperties {
  if (status === "Approved") return { background: "var(--green-bg)", color: "var(--green-text)" };
  if (status === "Retired") return { background: "var(--neutral-bg)", color: "var(--muted)" };
  return { background: "var(--amber-bg)", color: "var(--amber-text)" };
}

export default function CoachQualityGovernancePanel({ standards, viewerRole }: {
  standards: CoachQualityStandard[];
  viewerRole: string;
}) {
  const active = standards.find((standard) => standard.status === "Approved") ?? null;
  const canPropose = canProposeCoachQualityStandard(viewerRole);
  const canApprove = canApproveCoachQualityStandard(viewerRole);
  const current = standards.filter((standard) => standard.status !== "Retired");

  return <section style={{ display: "grid", gap: 12 }}>
    <div><div style={{ fontSize: 11, fontWeight: 750, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".5px" }}>Governed quality standard</div><div style={{ color: "var(--muted)", fontSize: 11.5, marginTop: 3 }}>Targets are references for human review only. They never automatically rank, pass, fail or discipline a Health Coach.</div></div>

    {active ? <div style={{ ...box, padding: 14, display: "grid", gap: 10 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}><b>Active version {active.version}</b><span style={{ ...statusStyle(active.status), borderRadius: 999, padding: "2px 8px", fontSize: 10.5, fontWeight: 750 }}>Medical Director approved</span><span style={{ color: "var(--muted)", fontSize: 11 }}>· {active.review_cadence} · {active.sample_size} sessions per coach/cycle</span></div>
      <StandardTargets standard={active} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 11.5 }}><div><b>Coaching response:</b> {active.coaching_trigger}</div><div><b>Clinical review:</b> {active.clinical_review_trigger}</div></div>
      <div style={{ color: "var(--muted)", fontSize: 10.5 }}>Proposed by {active.proposed_by_name} · approved by {active.approved_by_name} {active.approved_at ? `on ${new Date(active.approved_at).toLocaleDateString("en-GB")}` : ""}</div>
      {canApprove && <MedicalDirectorDecision standard={active} />}
    </div> : <div style={{ ...box, padding: 14, background: "var(--amber-bg)", color: "var(--amber-text)", fontSize: 12 }}><b>No approved standard is active.</b> Evidence remains visible, but the dashboard shows no reference target until a Medical Director approves a proposal.</div>}

    {canPropose && <ProposalForm active={active} />}

    {current.filter((standard) => standard.status === "Draft").map((standard) => <details key={standard.id} style={{ ...box, padding: 14 }} open={canApprove}>
      <summary style={{ cursor: "pointer", display: "flex", gap: 8, alignItems: "center" }}><b style={{ fontSize: 13 }}>Draft version {standard.version}</b><span style={{ ...statusStyle(standard.status), borderRadius: 999, padding: "2px 8px", fontSize: 10.5, fontWeight: 750 }}>Awaiting Medical Director</span><span style={{ color: "var(--muted)", fontSize: 10.5 }}>· proposed by {standard.proposed_by_name}</span></summary>
      <div style={{ display: "grid", gap: 9, marginTop: 10 }}><StandardTargets standard={standard} /><div style={{ fontSize: 11.5 }}><b>{standard.review_cadence}</b> · {standard.sample_size} sessions per coach/cycle</div><div style={{ fontSize: 11.5 }}><b>Rationale:</b> {standard.rationale}</div>{canApprove && <MedicalDirectorDecision standard={standard} />}</div>
    </details>)}

    {standards.some((standard) => standard.status === "Retired") && <details style={{ ...box, padding: 14 }}><summary style={{ cursor: "pointer", fontWeight: 700, fontSize: 12.5 }}>Retired version history ({standards.filter((standard) => standard.status === "Retired").length})</summary><div style={{ display: "grid", gap: 7, marginTop: 9 }}>{standards.filter((standard) => standard.status === "Retired").map((standard) => <div key={standard.id} style={{ borderTop: "1px solid var(--border)", paddingTop: 7, fontSize: 11.5 }}><b>Version {standard.version}</b> · proposed by {standard.proposed_by_name}{standard.approved_by_name ? ` · previously approved by ${standard.approved_by_name}` : ""}<div style={{ color: "var(--muted)", marginTop: 2 }}>{standard.retirement_note}</div></div>)}</div></details>}
  </section>;
}
