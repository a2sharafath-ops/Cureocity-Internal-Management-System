"use client";

import { setPreviewRole } from "@/lib/actions";
import { PERSONAS } from "@/lib/personas";

const ROLES = ["Manager", "Front Desk", "Finance", "HR", "Staff"];

export default function RolePreview({ preview, profession }: { preview: string | null; profession: string | null }) {
  const active = profession ?? preview;
  return (
    <form action={setPreviewRole} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      {active && (
        <span style={{ background: "var(--amber-bg)", color: "var(--amber-text)", borderRadius: 999, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>
          {profession ? `Persona: ${profession}` : "Preview"}
        </span>
      )}
      <select
        name="role"
        value={active ?? "off"}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        title="Preview the app as another role, or step into a professional workspace"
        style={{ border: "1px solid rgba(20,20,25,0.07)", borderRadius: 999, padding: "6px 10px", fontSize: 12, background: "rgba(255,255,255,0.55)", cursor: "pointer" }}
      >
        <option value="off">View as… (Administrator)</option>
        <optgroup label="Roles">
          {ROLES.map((r) => <option key={r} value={r}>View as {r}</option>)}
        </optgroup>
        <optgroup label="Professional workspaces">
          {PERSONAS.map((p) => <option key={p.key} value={p.key}>Enter as {p.label}</option>)}
        </optgroup>
      </select>
    </form>
  );
}
