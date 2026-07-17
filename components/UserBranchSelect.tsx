"use client";

import { setUserBranch } from "@/lib/actions";
import { BRANCHES } from "@/lib/branches";

export default function UserBranchSelect({ id, branch }: { id: string; branch: string | null }) {
  return (
    <form action={setUserBranch}>
      <input type="hidden" name="id" value={id} />
      <select
        name="branch"
        defaultValue={branch ?? "Kochi"}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "6px 9px", fontSize: 13, background: "#fff" }}
      >
        {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
      </select>
    </form>
  );
}
