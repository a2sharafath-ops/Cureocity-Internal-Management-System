"use client";

import { togglePackageActive } from "@/lib/actions";

export default function PackageToggle({ id, active }: { id: string; active: boolean }) {
  return (
    <form action={togglePackageActive}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="active" value={String(active)} />
      <button
        type="submit"
        style={{
          border: "1px solid var(--border)", background: "#fff", borderRadius: 8,
          padding: "5px 11px", fontSize: 12, cursor: "pointer",
          color: active ? "var(--red)" : "var(--teal-dark)",
        }}
      >
        {active ? "Deactivate" : "Activate"}
      </button>
    </form>
  );
}
