"use client";

import { setPreviewRole } from "@/lib/actions";

const ROLES = ["Manager", "Front Desk", "Health Professional", "Finance", "HR", "Staff"];

export default function RolePreview({ preview }: { preview: string | null }) {
  return (
    <form action={setPreviewRole} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      {preview && (
        <span style={{ background: "var(--amber-bg)", color: "#92400e", borderRadius: 999, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>
          Preview
        </span>
      )}
      <select
        name="role"
        defaultValue={preview ?? "off"}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        title="Preview the app as another role"
        style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "5px 8px", fontSize: 12, background: "#fff", cursor: "pointer" }}
      >
        <option value="off">View as… (Administrator)</option>
        {ROLES.map((r) => <option key={r} value={r}>View as {r}</option>)}
      </select>
    </form>
  );
}
