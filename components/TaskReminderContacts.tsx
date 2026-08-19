"use client";

import { useState } from "react";
import { saveTaskReminderContact } from "@/lib/actions";

type Staff = { id: string; name: string; phone: string | null; optedIn: boolean };

export default function TaskReminderContacts({ staff, available }: { staff: Staff[]; available: boolean }) {
  const [open, setOpen] = useState(false);
  if (!open) return <button type="button" onClick={() => setOpen(true)} style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 10, padding: "9px 13px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Reminder contacts</button>;
  const input: React.CSSProperties = { border: "1px solid var(--border)", borderRadius: 8, padding: "7px 9px", fontSize: 12.5, width: "100%", boxSizing: "border-box" };
  return <section style={{ marginBottom: 16, border: "1px solid var(--border)", background: "var(--card)", borderRadius: 12, padding: 14 }}>
    <div style={{ display: "flex", alignItems: "start", gap: 10, marginBottom: 10 }}>
      <div><b style={{ fontSize: 13.5 }}>Optional WhatsApp task reminders</b><div style={{ color: "var(--muted)", fontSize: 12, marginTop: 2 }}>Confirm each staff member’s number and opt-in. Saving this never sends a message; delivery also needs the protected runtime switches and an approved WhatsApp template.</div></div>
      <button type="button" onClick={() => setOpen(false)} style={{ marginLeft: "auto", border: 0, background: "transparent", color: "var(--muted)", cursor: "pointer" }}>Close</button>
    </div>
    {!available ? <div style={{ color: "var(--amber-text)", fontSize: 13 }}>Reminder contacts need migration 0197 before they can be configured. The Tasks board itself is unaffected.</div> : <div style={{ display: "grid", gap: 8 }}>
      {staff.map((person) => <form key={person.id} action={saveTaskReminderContact} style={{ display: "grid", gridTemplateColumns: "minmax(140px, 1fr) minmax(180px, 1.2fr) auto auto", gap: 8, alignItems: "center" }}>
        <input type="hidden" name="staff_id" value={person.id} />
        <span style={{ fontSize: 13, fontWeight: 600 }}>{person.name}</span>
        <input
          name="task_reminder_phone"
          type="tel"
          defaultValue={person.phone ?? ""}
          placeholder="e.g. +919876543210"
          pattern="\+[1-9][0-9]{7,14}"
          title="Use international format with country code, for example +919876543210"
          style={input}
        />
        <label style={{ whiteSpace: "nowrap", fontSize: 12.5, color: "var(--muted)" }}><input name="task_reminder_whatsapp_opt_in" value="true" type="checkbox" defaultChecked={person.optedIn} /> Confirmed opt-in</label>
        <button type="submit" style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "7px 10px", fontSize: 12, cursor: "pointer" }}>Save</button>
      </form>)}
    </div>}
  </section>;
}
