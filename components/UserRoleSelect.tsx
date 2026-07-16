"use client";

import { updateUserRole } from "@/lib/actions";

const ROLES = [
  "Administrator", "Manager", "Front Desk", "Health Professional", "Finance", "HR", "Staff",
];

export default function UserRoleSelect({
  id, role, disabled,
}: { id: string; role: string; disabled?: boolean }) {
  return (
    <form action={updateUserRole}>
      <input type="hidden" name="id" value={id} />
      <select
        name="role"
        defaultValue={role}
        disabled={disabled}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        style={{
          border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px",
          fontSize: 13, background: disabled ? "#f3f4f6" : "#fff",
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>{r}</option>
        ))}
      </select>
    </form>
  );
}
