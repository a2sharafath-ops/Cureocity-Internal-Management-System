"use client";

import { updateUserName } from "@/lib/actions";

export default function UserNameEdit({ id, name, isYou }: { id: string; name: string | null; isYou: boolean }) {
  if (isYou) return <b>{name ?? "—"} <span style={{ marginLeft: 6, background: "var(--teal-light)", color: "var(--teal-dark)", borderRadius: 999, padding: "1px 8px", fontSize: 11, fontWeight: 600 }}>you</span></b>;
  return (
    <form action={updateUserName}>
      <input type="hidden" name="id" value={id} />
      <input
        name="name"
        defaultValue={name ?? ""}
        onBlur={(e) => { if (e.currentTarget.value.trim() && e.currentTarget.value !== (name ?? "")) e.currentTarget.form?.requestSubmit(); }}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }}
        style={{ border: "1px solid transparent", borderRadius: 8, padding: "5px 8px", fontSize: 14, fontWeight: 700, background: "transparent", width: 160 }}
        onFocus={(e) => { e.currentTarget.style.border = "1px solid var(--border)"; e.currentTarget.style.background = "#fff"; }}
      />
    </form>
  );
}
