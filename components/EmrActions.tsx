"use client";

import { resolveProblem, stopMedication, deleteAllergy } from "@/lib/actions";

const btn: React.CSSProperties = { border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "3px 10px", fontSize: 12, cursor: "pointer" };

export function ProblemToggle({ id, clientId, status }: { id: string; clientId: string; status: string }) {
  const to = status === "active" ? "resolved" : "active";
  return (
    <form action={resolveProblem}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="client_id" value={clientId} />
      <input type="hidden" name="to" value={to} />
      <button type="submit" style={btn}>{status === "active" ? "Resolve" : "Reactivate"}</button>
    </form>
  );
}

export function MedStop({ id, clientId }: { id: string; clientId: string }) {
  return (
    <form action={stopMedication}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="client_id" value={clientId} />
      <button type="submit" style={{ ...btn, color: "var(--red)" }}>Stop</button>
    </form>
  );
}

export function AllergyDelete({ id, clientId }: { id: string; clientId: string }) {
  return (
    <form action={deleteAllergy}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="client_id" value={clientId} />
      <button type="submit" style={{ ...btn, color: "var(--muted)" }} title="Entered in error">✕</button>
    </form>
  );
}
