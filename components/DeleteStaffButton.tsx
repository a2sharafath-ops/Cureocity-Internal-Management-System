"use client";

import { deleteStaff } from "@/lib/actions";

export default function DeleteStaffButton({ id, name }: { id: string; name: string | null }) {
  return (
    <form action={deleteStaff} onSubmit={(e) => { if (!confirm(`Delete ${name ?? "this staff member"}? This permanently removes their login.`)) e.preventDefault(); }}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" style={{ border: "1px solid #fecaca", background: "#fff", color: "var(--red)", borderRadius: 8, padding: "5px 11px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Delete</button>
    </form>
  );
}
