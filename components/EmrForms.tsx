"use client";

import { useState } from "react";
import { addProblem, addAllergy, addMedication, addVitals, addEncounter } from "@/lib/actions";

const input: React.CSSProperties = { padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14, background: "#fff", width: "100%" };
const lbl: React.CSSProperties = { fontSize: 11, color: "var(--muted)" };
const primary: React.CSSProperties = { background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const ghost: React.CSSProperties = { background: "#fff", color: "var(--brand-text)", border: "1px solid var(--brand-fill)", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" };
const panel: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: 14, marginTop: 8 };

function Toggle({ label, children }: { label: string; children: (close: () => void) => React.ReactNode }) {
  const [open, setOpen] = useState(false);
  if (!open) return <button type="button" onClick={() => setOpen(true)} style={ghost}>{label}</button>;
  return <div style={panel}>{children(() => setOpen(false))}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ display: "grid", gap: 3 }}><label style={lbl}>{label}</label>{children}</div>;
}

export function ProblemForm({ clientId }: { clientId: string }) {
  return (
    <Toggle label="+ Add problem">
      {(close) => (
        <form action={addProblem} onSubmit={() => setTimeout(close, 50)} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
          <input type="hidden" name="client_id" value={clientId} />
          <Field label="Problem / diagnosis"><input style={input} name="description" required /></Field>
          <Field label="ICD-10 (optional)"><input style={input} name="code" /></Field>
          <Field label="Onset"><input style={input} name="onset_date" type="date" /></Field>
          <button type="submit" style={primary}>Add</button>
        </form>
      )}
    </Toggle>
  );
}

export function AllergyForm({ clientId }: { clientId: string }) {
  return (
    <Toggle label="+ Add allergy">
      {(close) => (
        <form action={addAllergy} onSubmit={() => setTimeout(close, 50)} style={{ display: "grid", gridTemplateColumns: "1.4fr 1.6fr 1fr auto", gap: 10, alignItems: "end" }}>
          <input type="hidden" name="client_id" value={clientId} />
          <Field label="Substance"><input style={input} name="substance" required /></Field>
          <Field label="Reaction"><input style={input} name="reaction" placeholder="e.g. rash, anaphylaxis" /></Field>
          <Field label="Severity"><select style={input} name="severity" defaultValue="moderate"><option>mild</option><option>moderate</option><option>severe</option></select></Field>
          <button type="submit" style={primary}>Add</button>
        </form>
      )}
    </Toggle>
  );
}

export function MedicationForm({ clientId }: { clientId: string }) {
  return (
    <Toggle label="+ Add medication">
      {(close) => (
        <form action={addMedication} onSubmit={() => setTimeout(close, 50)} style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
          <input type="hidden" name="client_id" value={clientId} />
          <Field label="Drug name"><input style={input} name="name" required /></Field>
          <Field label="Dose"><input style={input} name="dose" placeholder="e.g. 500 mg" /></Field>
          <Field label="Frequency"><input style={input} name="frequency" placeholder="e.g. BD" /></Field>
          <Field label="Route"><select style={input} name="route" defaultValue="oral"><option>oral</option><option>topical</option><option>IV</option><option>IM</option><option>SC</option><option>inhaled</option></select></Field>
          <button type="submit" style={primary}>Add</button>
        </form>
      )}
    </Toggle>
  );
}

export function VitalsForm({ clientId }: { clientId: string }) {
  return (
    <Toggle label="+ Record vitals">
      {(close) => (
        <form action={addVitals} onSubmit={() => setTimeout(close, 50)} style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, alignItems: "end" }}>
          <input type="hidden" name="client_id" value={clientId} />
          <Field label="Date"><input style={input} name="date" type="date" /></Field>
          <Field label="Systolic (mmHg)"><input style={input} name="systolic" type="number" /></Field>
          <Field label="Diastolic (mmHg)"><input style={input} name="diastolic" type="number" /></Field>
          <Field label="Pulse (bpm)"><input style={input} name="pulse" type="number" /></Field>
          <Field label="Temp (°C)"><input style={input} name="temp_c" type="number" step="0.1" /></Field>
          <Field label="Resp rate"><input style={input} name="resp_rate" type="number" /></Field>
          <Field label="SpO₂ (%)"><input style={input} name="spo2" type="number" /></Field>
          <Field label="Weight (kg)"><input style={input} name="weight" type="number" step="0.1" /></Field>
          <div style={{ gridColumn: "1 / -1", display: "flex", gap: 10, alignItems: "end" }}>
            <div style={{ flex: 1 }}><Field label="Notes"><input style={input} name="notes" /></Field></div>
            <button type="submit" style={primary}>Save vitals</button>
          </div>
        </form>
      )}
    </Toggle>
  );
}

export function EncounterForm({ clientId }: { clientId: string }) {
  const ta: React.CSSProperties = { ...input, minHeight: 60, fontFamily: "inherit", resize: "vertical" };
  return (
    <Toggle label="+ New SOAP encounter">
      {(close) => (
        <form action={addEncounter} onSubmit={() => setTimeout(close, 50)} style={{ display: "grid", gap: 10 }}>
          <input type="hidden" name="client_id" value={clientId} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr 2fr", gap: 10 }}>
            <Field label="Date"><input style={input} name="date" type="date" /></Field>
            <Field label="Type"><select style={input} name="type" defaultValue="Office visit"><option>Office visit</option><option>Telehealth</option><option>Follow-up</option><option>Procedure</option></select></Field>
            <Field label="Chief complaint"><input style={input} name="chief_complaint" /></Field>
          </div>
          <Field label="S — Subjective"><textarea style={ta} name="subjective" /></Field>
          <Field label="O — Objective"><textarea style={ta} name="objective" /></Field>
          <Field label="A — Assessment"><textarea style={ta} name="assessment" /></Field>
          <Field label="P — Plan"><textarea style={ta} name="plan" /></Field>
          <div><button type="submit" style={primary}>Save encounter</button></div>
        </form>
      )}
    </Toggle>
  );
}
