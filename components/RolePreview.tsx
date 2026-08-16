"use client";

import { setPreviewRole } from "@/lib/actions";
import { PERSONAS } from "@/lib/personas";
import { nativeRoleOptionLabel } from "@/lib/role-preview";

// The Medical Director sits here rather than under "Professional workspaces":
// the personas below are single disciplines that route to one workspace, and
// the director deliberately isn't one — they oversee all five.
//
// Preview shows you what a role SEES. It does not grant what a role can DO:
// every write still checks the real login role, so previewing as the director
// will not let an admin approve a diet chart. That is the point of the role.
const ROLES = ["Manager", "Medical Director", "Front Desk", "Finance", "HR", "Staff"];

export default function RolePreview({ preview, profession, realRole }: { preview: string | null; profession: string | null; realRole: string }) {
  const active = profession ?? preview;
  return (
    <form action={setPreviewRole} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      {active && (
        <span style={{ background: "var(--amber-bg)", color: "var(--amber-text)", borderRadius: 999, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>
          {profession ? `Persona preview: ${profession}` : `Role preview: ${preview}`}
        </span>
      )}
      <select
        name="role"
        key={active ?? realRole}
        value={active ?? "off"}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        title="Preview the app as another role, or step into a Health Professional's workspace"
        aria-label={`Preview another staff role or return to ${realRole}`}
        style={{ border: "1px solid rgba(20,20,25,0.07)", borderRadius: 999, padding: "6px 10px", fontSize: 12, background: "rgba(255,255,255,0.55)", cursor: "pointer" }}
      >
        <option value="off">{nativeRoleOptionLabel(realRole, Boolean(active))}</option>
        <optgroup label="Roles">
          {ROLES.map((r) => <option key={r} value={r}>View as {r}</option>)}
        </optgroup>
        <optgroup label="Health Professionals">
          {PERSONAS.map((p) => <option key={p.key} value={p.key}>Enter as {p.label}</option>)}
        </optgroup>
      </select>
    </form>
  );
}
