export type Msg = {
  id: string;
  sender: string;      // 'staff' | 'client'
  sender_name: string | null;
  body: string;
  created_at: string;
};

function when(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

// viewer: whose perspective — staff sees staff messages on the right; client (portal) sees their own on the right.
export default function MessageThread({ messages, viewer }: { messages: Msg[]; viewer: "staff" | "client" }) {
  if (!messages.length) {
    return <div style={{ color: "var(--muted)", fontSize: 13, padding: "10px 0" }}>No messages yet. Say hello 👋</div>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 420, overflowY: "auto", padding: "4px 2px" }}>
      {messages.map((m) => {
        const mine = m.sender === viewer;
        return (
          <div key={m.id} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start" }}>
            <div
              style={{
                maxWidth: "72%",
                background: mine ? "var(--brand-fill)" : "var(--neutral-bg)",
                color: mine ? "#fff" : "var(--ink)",
                borderRadius: 12,
                padding: "8px 12px",
                fontSize: 14,
              }}
            >
              <div>{m.body}</div>
              <div style={{ fontSize: 10, opacity: 0.75, marginTop: 3 }}>
                {mine ? "You" : (m.sender === "staff" ? (m.sender_name ?? "Staff") : (m.sender_name ?? "Client"))} · {when(m.created_at)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
