"use client";

import { bookClientStaff } from "@/lib/actions";

export default function BookClientSelect({
  classId, clients, disabled,
}: { classId: string; clients: { id: string; name: string }[]; disabled: boolean }) {
  if (disabled) return <span style={{ background: "var(--red-bg)", color: "var(--red-text)", borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>Full</span>;
  return (
    <form action={bookClientStaff} style={{ display: "inline-flex", gap: 6 }}>
      <input type="hidden" name="class_id" value={classId} />
      <select
        name="client_id"
        defaultValue=""
        onChange={(e) => { if (e.currentTarget.value) e.currentTarget.form?.requestSubmit(); }}
        style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "5px 8px", fontSize: 12, background: "#fff", cursor: "pointer" }}
      >
        <option value="" disabled>+ Add client…</option>
        {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
    </form>
  );
}
