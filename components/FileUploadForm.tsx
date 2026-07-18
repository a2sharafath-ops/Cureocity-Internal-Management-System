"use client";

import { useRef, useEffect } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { uploadClientFile, uploadPortalFile, type UploadState } from "@/lib/actions";

function SubmitBtn({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 13px", fontSize: 13, fontWeight: 600, cursor: pending ? "default" : "pointer", opacity: pending ? 0.7 : 1 }}>
      {pending ? "Uploading…" : label}
    </button>
  );
}

export default function FileUploadForm({
  variant, clientId, kind, label, accept,
}: {
  variant: "staff" | "portal";
  clientId?: string;
  kind: string;
  label: string;
  accept?: string;
}) {
  const action = variant === "portal" ? uploadPortalFile : uploadClientFile;
  const [state, formAction] = useFormState<UploadState, FormData>(action, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.ok) ref.current?.reset(); }, [state.ok]);

  return (
    <form ref={ref} action={formAction} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      {clientId && <input type="hidden" name="client_id" value={clientId} />}
      <input type="hidden" name="kind" value={kind} />
      <input type="file" name="file" accept={accept} required style={{ fontSize: 13 }} />
      <SubmitBtn label={label} />
      {state.error && <span style={{ color: "#991b1b", fontSize: 12 }}>{state.error}</span>}
      {state.ok && <span style={{ color: "#166534", fontSize: 12 }}>{state.ok}</span>}
    </form>
  );
}
