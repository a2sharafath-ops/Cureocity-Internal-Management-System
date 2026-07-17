"use client";

import { useRef } from "react";
import { sendMessageStaff, sendMessageSelf } from "@/lib/actions";

export default function MessageReply({ variant, clientId }: { variant: "staff" | "portal"; clientId?: string }) {
  const action = variant === "portal" ? sendMessageSelf : sendMessageStaff;
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={ref}
      action={action}
      onSubmit={() => setTimeout(() => ref.current?.reset(), 30)}
      style={{ display: "flex", gap: 8, marginTop: 12 }}
    >
      {clientId && <input type="hidden" name="client_id" value={clientId} />}
      <input
        name="body"
        required
        autoComplete="off"
        placeholder="Type a message…"
        style={{ flex: 1, padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 10, fontSize: 14, background: "#fff" }}
      />
      <button type="submit" style={{ background: "var(--teal)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
        Send
      </button>
    </form>
  );
}
