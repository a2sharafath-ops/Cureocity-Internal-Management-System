"use client";

import { useRef, useEffect } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { uploadEmployeeDoc, type UploadState } from "@/lib/actions";

const KINDS = ["Onboarding form", "Certificate", "ID proof", "Contract", "Payslip", "Other"];

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 13px", fontSize: 13, fontWeight: 600, cursor: pending ? "default" : "pointer", opacity: pending ? 0.7 : 1 }}>
      {pending ? "Uploading…" : "Upload"}
    </button>
  );
}

export default function EmployeeDocUpload({ staffId }: { staffId: string }) {
  const [state, formAction] = useFormState<UploadState, FormData>(uploadEmployeeDoc, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.ok) ref.current?.reset(); }, [state.ok]);

  const inp: React.CSSProperties = { border: "1px solid var(--border)", borderRadius: 8, padding: "6px 9px", fontSize: 13, background: "#fff" };

  return (
    <form ref={ref} action={formAction} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <input type="hidden" name="staff_id" value={staffId} />
      <select name="kind" defaultValue="Onboarding form" style={inp}>{KINDS.map((k) => <option key={k}>{k}</option>)}</select>
      <input name="title" placeholder="Title (optional)" style={{ ...inp, width: 160 }} />
      <input type="file" name="file" required style={{ fontSize: 12 }} />
      <SubmitBtn />
      {state.error && <span style={{ color: "var(--red-text)", fontSize: 12 }}>{state.error}</span>}
      {state.ok && <span style={{ color: "var(--green-text)", fontSize: 12 }}>{state.ok}</span>}
    </form>
  );
}
