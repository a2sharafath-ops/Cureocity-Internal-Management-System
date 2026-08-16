"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { updateWorkboardStatus, type WorkboardActionState } from "@/lib/workboard-actions";
import { WORKBOARD_STATUSES, type WorkboardItem, type WorkboardStatus } from "@/lib/workboard";

const tone: Record<WorkboardStatus, React.CSSProperties> = {
  Pending: { background: "var(--amber-bg)", color: "var(--amber-text)" },
  "In progress": { background: "var(--blue-bg)", color: "var(--blue-text)" },
  Done: { background: "var(--green-bg)", color: "var(--green-text)" },
};

function SaveButton({ changed }: { changed: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || !changed} className="ds-btn ds-btn-primary" style={{ padding: "8px 13px", fontSize: 12 }}>
      {pending ? "Saving…" : "Save status"}
    </button>
  );
}

export default function WorkboardItemCard({ item }: { item: WorkboardItem }) {
  const [selectedStatus, setSelectedStatus] = useState<WorkboardStatus>(item.status);
  const [state, action] = useActionState<WorkboardActionState, FormData>(updateWorkboardStatus, {});

  return (
    <article style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 13, boxShadow: "var(--shadow)", padding: 15, display: "grid", gap: 11 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ color: "var(--muted)", fontSize: 10.5, fontWeight: 750, textTransform: "uppercase", letterSpacing: ".45px" }}>{item.workstream}</span>
        <span style={{ flex: 1 }} />
        <span style={{ ...tone[item.status], borderRadius: 999, padding: "3px 8px", fontSize: 10.5, fontWeight: 750 }}>{item.status}</span>
      </div>
      <div>
        <h3 style={{ fontSize: 14.5, margin: 0, lineHeight: 1.3 }}>{item.title}</h3>
        <p style={{ color: "var(--muted)", fontSize: 12, lineHeight: 1.45, margin: "5px 0 0" }}>{item.state_note}</p>
      </div>
      <div style={{ background: "var(--neutral-bg)", borderRadius: 9, padding: "9px 10px" }}>
        <div style={{ color: "var(--muted)", fontSize: 10.5, fontWeight: 750, textTransform: "uppercase", letterSpacing: ".35px" }}>Next action</div>
        <div style={{ fontSize: 12, lineHeight: 1.45, marginTop: 3 }}>{item.next_action}</div>
      </div>
      <form action={action} style={{ borderTop: "1px solid var(--border)", paddingTop: 11, display: "flex", alignItems: "end", gap: 8, flexWrap: "wrap" }}>
        <input type="hidden" name="id" value={item.id} />
        <label style={{ display: "grid", gap: 4, flex: "1 1 145px", color: "var(--muted)", fontSize: 10.5, fontWeight: 700 }}>
          Update status
          <select
            name="status"
            aria-label={`Status for ${item.title}`}
            value={selectedStatus}
            onChange={(event) => setSelectedStatus(event.target.value as WorkboardStatus)}
            className="ds-input"
            style={{ padding: "7px 9px", fontSize: 12 }}
          >
            {WORKBOARD_STATUSES.map((status) => <option key={status}>{status}</option>)}
          </select>
        </label>
        <SaveButton changed={selectedStatus !== item.status} />
      </form>
      {state.error && <div role="alert" style={{ background: "var(--red-bg)", color: "var(--red-text)", borderRadius: 8, padding: "7px 9px", fontSize: 11.5 }}>{state.error}</div>}
      {state.ok && <div role="status" style={{ color: "var(--green-text)", fontSize: 11.5, fontWeight: 650 }}>{state.ok}</div>}
    </article>
  );
}
