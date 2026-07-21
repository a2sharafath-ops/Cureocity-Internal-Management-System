"use client";

import { useState } from "react";
import { markAttendance, addLeave, setLeaveStatus, upsertPayroll, payPayroll } from "@/lib/actions";

const input: React.CSSProperties = { padding: "0 10px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, background: "#fff", width: "100%" , height: 36, boxSizing: "border-box" };
const lbl: React.CSSProperties = { fontSize: 10, color: "var(--muted)" };
const chip: React.CSSProperties = { border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "3px 10px", fontSize: 12, cursor: "pointer" };

const ATT = [
  { key: "present", label: "Present", color: "var(--green-text)", bg: "var(--green-bg)" },
  { key: "leave", label: "Leave", color: "var(--amber-text-soft)", bg: "var(--amber-bg)" },
  { key: "absent", label: "Absent", color: "var(--red)", bg: "var(--red-bg)" },
  { key: "half", label: "Half", color: "var(--blue)", bg: "var(--blue-bg)" },
];

export function AttendanceButtons({ staffId, date, current }: { staffId: string; date: string; current: string | null }) {
  return (
    <div style={{ display: "flex", gap: 5, justifyContent: "flex-end", flexWrap: "wrap" }}>
      {ATT.map((a) => {
        const on = current === a.key;
        return (
          <form key={a.key} action={markAttendance}>
            <input type="hidden" name="staff_id" value={staffId} /><input type="hidden" name="date" value={date} /><input type="hidden" name="status" value={a.key} />
            <button type="submit" style={{ ...chip, background: on ? a.bg : "#fff", color: on ? a.color : "var(--muted)", borderColor: on ? a.color : "var(--border)", fontWeight: on ? 700 : 500 }}>{a.label}</button>
          </form>
        );
      })}
    </div>
  );
}

export function LeaveForm({ staff }: { staff: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  if (!open) return <button type="button" onClick={() => setOpen(true)} style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 10, padding: "9px 15px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ Add leave</button>;
  return (
    <form action={addLeave} onSubmit={() => setTimeout(() => setOpen(false), 50)} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: 16, marginBottom: 16, display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
      <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Staff</label><select style={input} name="staff_id" required defaultValue=""><option value="" disabled>Staff…</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
      <div style={{ display: "grid", gap: 3 }}><label style={lbl}>From</label><input style={input} name="from_date" type="date" required /></div>
      <div style={{ display: "grid", gap: 3 }}><label style={lbl}>To</label><input style={input} name="to_date" type="date" /></div>
      <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Type</label><select style={input} name="type" defaultValue="Casual"><option>Casual</option><option>Sick</option><option>Earned</option><option>Unpaid</option></select></div>
      <button type="submit" style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Add</button>
    </form>
  );
}

export function LeaveActions({ id }: { id: string }) {
  return (
    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
      <form action={setLeaveStatus}><input type="hidden" name="id" value={id} /><input type="hidden" name="status" value="approved" /><button type="submit" style={{ ...chip, borderColor: "var(--brand-fill)", color: "var(--brand-text)" }}>Approve</button></form>
      <form action={setLeaveStatus}><input type="hidden" name="id" value={id} /><input type="hidden" name="status" value="rejected" /><button type="submit" style={{ ...chip, color: "var(--red)" }}>Reject</button></form>
    </div>
  );
}

export function PayrollRow({ staffId, month, base, lopDays, id, status }: { staffId: string; month: string; base: number; lopDays: number; id: string | null; status: string | null }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "flex-end" }}>
      <form action={upsertPayroll} style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input type="hidden" name="staff_id" value={staffId} /><input type="hidden" name="month" value={month} />
        <input name="base" type="number" min={0} defaultValue={base} title="Base salary" style={{ ...input, width: 100 }} />
        <input name="lop_days" type="number" min={0} defaultValue={lopDays} title="Loss-of-pay days" style={{ ...input, width: 60 }} />
        <button type="submit" style={chip}>Save</button>
      </form>
      {id && status !== "paid" && (
        <form action={payPayroll}><input type="hidden" name="id" value={id} /><button type="submit" style={{ ...chip, borderColor: "var(--brand-fill)", color: "var(--brand-text)" }}>Mark paid</button></form>
      )}
      {status === "paid" && <span style={{ background: "var(--green-bg)", color: "var(--green-text)", borderRadius: 999, padding: "2px 10px", fontSize: 12, fontWeight: 600 }}>paid</span>}
    </div>
  );
}
