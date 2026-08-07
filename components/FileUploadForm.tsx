"use client";

import { useActionState, useRef, useEffect } from "react";
import { useFormStatus } from "react-dom";
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
  const [state, formAction] = useActionState<UploadState, FormData>(action, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.ok) ref.current?.reset(); }, [state.ok]);

  return (
    <form ref={ref} action={formAction} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      {clientId && <input type="hidden" name="client_id" value={clientId} />}
      <input type="hidden" name="kind" value={kind} />
      {/* Choosing the file IS the upload. Requiring a second click on a
          separate button meant a file could sit selected-but-not-sent, looking
          for all the world like it had been filed — and a report someone
          believes is on the record but isn't is worse than no report. The
          button stays for keyboard use and as the pending indicator. */}
      <input
        type="file" name="file" accept={accept} required style={{ fontSize: 13 }}
        onChange={(e) => { if (e.currentTarget.files?.length) ref.current?.requestSubmit(); }}
      />
      <SubmitBtn label={label} />
      {state.error && <span style={{ color: "var(--red-text)", fontSize: 12 }}>{state.error}</span>}
      {state.ok && <span style={{ color: "var(--green-text)", fontSize: 12 }}>{state.ok}</span>}
    </form>
  );
}
