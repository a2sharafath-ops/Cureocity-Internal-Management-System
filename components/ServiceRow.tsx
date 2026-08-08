"use client";

import { useActionState, useState } from "react";
import { updateService, toggleService, type ServiceEditState } from "@/lib/actions";

export type Svc = {
  id: string; name: string; category: string; mode: string;
  slot_based: boolean; day_offset: number | null; active: boolean;
};

const input: React.CSSProperties = {
  padding: "0 9px", border: "1px solid var(--border)", borderRadius: 8,
  fontSize: 13, background: "#fff", height: 34, boxSizing: "border-box", width: "100%",
};
const lbl: React.CSSProperties = { fontSize: 10, color: "var(--muted)" };
const btn: React.CSSProperties = {
  border: "1px solid var(--border)", background: "#fff", borderRadius: 8,
  padding: "3px 10px", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap",
};

/**
 * A service in the catalogue, with an inline editor.
 *
 * Edit is a row-level toggle rather than a separate page: the list is short,
 * and the thing you usually want to change (a day offset, a typo in a name) is
 * one field. Opening a form somewhere else to change one number is worse.
 */
export default function ServiceRow({ s }: { s: Svc }) {
  const [editing, setEditing] = useState(false);
  // useActionState rather than a bare `action`: a rename can silently touch a
  // lot of bookings, and "it worked, and here is what it moved" is worth saying.
  const [state, formAction] = useActionState<ServiceEditState, FormData>(updateService, {});
  const td: React.CSSProperties = { padding: "10px 16px", fontSize: 14 };

  if (!editing) {
    return (
      <tr style={{ borderTop: "1px solid var(--border)", opacity: s.active ? 1 : 0.5 }}>
        <td style={{ ...td, fontWeight: 600 }}>{s.name}</td>
        <td style={{ ...td, color: "var(--muted)", fontSize: 13 }}>
          {s.mode}{s.slot_based ? " · slot-based" : ""}{s.day_offset != null ? ` · Day ${s.day_offset}` : ""}
        </td>
        <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
          <button type="button" onClick={() => setEditing(true)} style={{ ...btn, marginRight: 6 }}>Edit</button>
          <form action={toggleService} style={{ display: "inline" }}>
            <input type="hidden" name="id" value={s.id} />
            <input type="hidden" name="to" value={String(!s.active)} />
            <button type="submit" style={{ ...btn, color: s.active ? "var(--muted)" : "var(--brand-text)" }}>
              {s.active ? "Deactivate" : "Activate"}
            </button>
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr style={{ borderTop: "1px solid var(--border)", background: "var(--neutral-bg)" }}>
      <td colSpan={3} style={{ padding: "12px 16px" }}>
        <form
          action={formAction}
          style={{ display: "grid", gridTemplateColumns: "1.8fr 1.4fr 1fr 0.9fr auto auto auto", gap: 10, alignItems: "end" }}
        >
          <input type="hidden" name="id" value={s.id} />
          <div style={{ display: "grid", gap: 3 }}>
            <label style={lbl}>Service name</label>
            <input style={input} name="name" defaultValue={s.name} required />
          </div>
          <div style={{ display: "grid", gap: 3 }}>
            <label style={lbl}>Category</label>
            <input style={input} name="category" list="svc-cats" defaultValue={s.category} />
          </div>
          <div style={{ display: "grid", gap: 3 }}>
            <label style={lbl}>Mode</label>
            <select style={input} name="mode" defaultValue={s.mode}><option>Offline</option><option>Online</option></select>
          </div>
          <div style={{ display: "grid", gap: 3 }}>
            <label style={lbl}>Day offset</label>
            <input style={input} name="day_offset" type="number" placeholder="—" defaultValue={s.day_offset ?? ""} />
          </div>
          <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" name="slot_based" defaultChecked={s.slot_based} /> Slot
          </label>
          <button type="submit" style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Save</button>
          <button type="button" onClick={() => setEditing(false)} style={{ ...btn, height: 34 }}>Close</button>
        </form>
        {state.error && <div style={{ fontSize: 12, color: "var(--red-text)", marginTop: 8 }}>{state.error}</div>}
        {state.ok && <div style={{ fontSize: 12, color: "var(--green-text)", marginTop: 8 }}>Saved.{state.note ? ` ${state.note}` : ""}</div>}
        <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 8 }}>
          {/* The one consequence worth warning about before they press Save. */}
          Renaming also re-points every appointment booked under the old name, so
          existing milestones keep matching. Clearing the day offset makes this an
          ordinary bookable service with no protocol deadline.
        </div>
      </td>
    </tr>
  );
}
