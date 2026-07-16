"use client";

import Link from "next/link";
import { useState } from "react";

export type ClientRow = {
  id: string;
  code: string | null;
  name: string;
  phone: string | null;
  used: number;
  branch: string | null;
  joined: string | null;
  package_name: string | null;
  is_facility: boolean;
  package_sessions: number;
};

function sched(c: ClientRow) {
  if (c.is_facility) return "Facility access";
  if (c.package_sessions > 0) return `${c.used} / ${c.package_sessions} sessions`;
  return "—";
}

export default function ClientsTable({ clients }: { clients: ClientRow[] }) {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const rows = query
    ? clients.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          (c.phone ?? "").toLowerCase().includes(query) ||
          (c.code ?? "").toLowerCase().includes(query)
      )
    : clients;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="🔍 Search by name, phone, or code"
          style={{
            maxWidth: 340, width: "100%", padding: "9px 12px", fontSize: 14,
            border: "1px solid var(--border)", borderRadius: 10, outline: "none", background: "#fff",
          }}
        />
        <span style={{ flex: 1 }} />
        <span
          style={{
            background: "#eef2f1", color: "var(--muted)", borderRadius: 999,
            padding: "4px 10px", fontSize: 12,
          }}
        >
          {rows.length} client{rows.length === 1 ? "" : "s"}
        </span>
      </div>

      <div
        style={{
          background: "var(--card)", border: "1px solid var(--border)",
          borderRadius: "var(--radius)", boxShadow: "var(--shadow)", overflow: "hidden",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--muted)", fontSize: 12 }}>
              <th style={{ padding: "12px 16px" }}>Client</th>
              <th style={{ padding: "12px 16px" }}>Package</th>
              <th style={{ padding: "12px 16px" }}>Sessions</th>
              <th style={{ padding: "12px 16px" }}>Branch</th>
              <th style={{ padding: "12px 16px" }} />
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ padding: "12px 16px" }}>
                  <b>{c.name}</b>
                  <div style={{ color: "var(--muted)", fontSize: 12 }}>
                    {c.code ?? "—"} · {c.phone ?? "—"}
                  </div>
                </td>
                <td style={{ padding: "12px 16px" }}>
                  <span
                    style={{
                      background: "var(--teal-light)", color: "var(--teal-dark)",
                      borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 600,
                    }}
                  >
                    {c.package_name ?? "—"}
                  </span>
                </td>
                <td style={{ padding: "12px 16px", color: "var(--muted)" }}>{sched(c)}</td>
                <td style={{ padding: "12px 16px" }}>{c.branch ?? "—"}</td>
                <td style={{ padding: "12px 16px", textAlign: "right" }}>
                  <Link
                    href={`/clients/${c.id}`}
                    style={{
                      background: "var(--teal)", color: "#fff", borderRadius: 8,
                      padding: "6px 12px", fontSize: 12, fontWeight: 600, textDecoration: "none",
                    }}
                  >
                    Open
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: "24px 16px", textAlign: "center", color: "var(--muted)" }}>
                  No matching clients
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
