"use client";

import { useState } from "react";
import { setOrderStatus, setPrescriptionStatus } from "@/lib/actions";

const btn: React.CSSProperties = { border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "3px 10px", fontSize: 12, cursor: "pointer" };

export function OrderActions({ id, clientId, status }: { id: string; clientId?: string; status: string }) {
  const [resulting, setResulting] = useState(false);
  if (resulting) {
    return (
      <form action={setOrderStatus} style={{ display: "flex", gap: 6, alignItems: "center" }} onSubmit={() => setResulting(false)}>
        <input type="hidden" name="id" value={id} />
        {clientId && <input type="hidden" name="client_id" value={clientId} />}
        <input type="hidden" name="status" value="resulted" />
        <input name="result" placeholder="Result / value" required style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "4px 8px", fontSize: 12, width: 180 }} />
        <button type="submit" style={{ ...btn, borderColor: "var(--brand-fill)", color: "var(--brand-text)" }}>Save</button>
        <button type="button" onClick={() => setResulting(false)} style={{ ...btn, color: "var(--muted)" }}>✕</button>
      </form>
    );
  }
  return (
    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
      {status === "ordered" && (
        <form action={setOrderStatus}>
          <input type="hidden" name="id" value={id} />{clientId && <input type="hidden" name="client_id" value={clientId} />}
          <input type="hidden" name="status" value="collected" />
          <button type="submit" style={btn}>Mark collected</button>
        </form>
      )}
      {(status === "ordered" || status === "collected") && (
        <button type="button" onClick={() => setResulting(true)} style={{ ...btn, borderColor: "var(--brand-fill)", color: "var(--brand-text)" }}>Enter result</button>
      )}
      {status !== "cancelled" && status !== "resulted" && (
        <form action={setOrderStatus}>
          <input type="hidden" name="id" value={id} />{clientId && <input type="hidden" name="client_id" value={clientId} />}
          <input type="hidden" name="status" value="cancelled" />
          <button type="submit" style={{ ...btn, color: "var(--red)" }}>Cancel</button>
        </form>
      )}
    </div>
  );
}

export function RxStatus({ id, clientId, status }: { id: string; clientId: string; status: string }) {
  return (
    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
      {status === "draft" && (
        <form action={setPrescriptionStatus}>
          <input type="hidden" name="id" value={id} /><input type="hidden" name="client_id" value={clientId} /><input type="hidden" name="status" value="signed" />
          <button type="submit" style={{ ...btn, borderColor: "var(--brand-fill)", color: "var(--brand-text)" }}>Sign</button>
        </form>
      )}
      {status === "signed" && (
        <form action={setPrescriptionStatus}>
          <input type="hidden" name="id" value={id} /><input type="hidden" name="client_id" value={clientId} /><input type="hidden" name="status" value="dispensed" />
          <button type="submit" style={btn}>Mark dispensed</button>
        </form>
      )}
      {status !== "cancelled" && status !== "dispensed" && (
        <form action={setPrescriptionStatus}>
          <input type="hidden" name="id" value={id} /><input type="hidden" name="client_id" value={clientId} /><input type="hidden" name="status" value="cancelled" />
          <button type="submit" style={{ ...btn, color: "var(--red)" }}>Cancel</button>
        </form>
      )}
    </div>
  );
}
