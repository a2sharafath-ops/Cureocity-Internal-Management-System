"use client";

import Link from "next/link";
import { useState } from "react";
import { setClientOwner } from "@/lib/actions";

export type ClientRow = {
  id: string; code: string | null; name: string; phone: string | null; email: string | null;
  age: number | null; branch: string | null; used: number;
  package_name: string | null; is_facility: boolean; package_sessions: number;
  is_blueprint: boolean; status: string; coach: string | null; owner: string | null;
  journey: { steps: { label: string; done: boolean }[]; done: number; total: number; stage: string };
};

export default function ClientsTable({ clients, staff, writer }: { clients: ClientRow[]; staff: { id: string; name: string }[]; writer: boolean }) {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"all" | "blueprint">("all");
  const [status, setStatus] = useState("All");

  const query = q.trim().toLowerCase();
  const rows = clients.filter((c) => {
    if (tab === "blueprint" && !c.is_blueprint) return false;
    if (status !== "All" && c.status !== status) return false;
    if (!query) return true;
    return c.name.toLowerCase().includes(query) || (c.phone ?? "").toLowerCase().includes(query) ||
      (c.email ?? "").toLowerCase().includes(query) || (c.code ?? "").toLowerCase().includes(query);
  });
  const bpCount = clients.filter((c) => c.is_blueprint).length;

  const th: React.CSSProperties = { padding: "12px 16px", textAlign: "left", color: "var(--muted)", fontSize: 12 };
  const td: React.CSSProperties = { padding: "12px 16px", fontSize: 14, verticalAlign: "middle" };
  const tabBtn = (key: "all" | "blueprint", label: string, count: number) => (
    <button type="button" onClick={() => setTab(key)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "1px solid var(--border)", background: tab === key ? "var(--teal)" : "#fff", color: tab === key ? "#fff" : "var(--muted)" }}>
      {label} <span style={{ background: tab === key ? "rgba(255,255,255,0.25)" : "#eef2f1", borderRadius: 999, padding: "0 7px", fontSize: 11 }}>{count}</span>
    </button>
  );
  const statusChip = (s: string) => {
    const on = s === "Active";
    return <span style={{ background: on ? "var(--green-bg)" : "#eef2f1", color: on ? "#166534" : "var(--muted)", borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>{s}</span>;
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {tabBtn("all", "All Clients", clients.length)}
        {tabBtn("blueprint", "🧬 Blueprint clients", bpCount)}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 Search by name, phone, or email" style={{ maxWidth: 340, width: "100%", padding: "9px 12px", fontSize: 14, border: "1px solid var(--border)", borderRadius: 10, outline: "none", background: "#fff" }} />
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ padding: "9px 12px", fontSize: 14, border: "1px solid var(--border)", borderRadius: 10, background: "#fff" }}>
          <option>All</option><option>Active</option><option>Completed</option>
        </select>
        <span style={{ flex: 1 }} />
        <span style={{ background: "#eef2f1", color: "var(--muted)", borderRadius: 999, padding: "4px 10px", fontSize: 12 }}>{rows.length} client{rows.length === 1 ? "" : "s"}</span>
      </div>

      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, minWidth: 1040 }}>
          <thead>
            <tr>
              <th style={th}>Name</th><th style={th}>Age</th><th style={th}>Package</th><th style={th}>Journey</th><th style={th}>Status</th>
              <th style={th}>Health Coach</th><th style={th}>Owner (Front Desk)</th><th style={th}>Branch</th><th style={th} />
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const left = c.is_facility ? null : (c.package_sessions > 0 ? c.package_sessions - c.used : null);
              return (
                <tr key={c.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={td}><b>{c.name}</b><div style={{ color: "var(--muted)", fontSize: 12 }}>{c.code ?? "—"}{c.phone ? ` · ${c.phone}` : ""}</div></td>
                  <td style={{ ...td, color: "var(--muted)" }}>{c.age != null ? `${c.age} yrs` : "—"}</td>
                  <td style={td}>
                    <span style={{ background: "var(--teal-light)", color: "var(--teal-dark)", borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>{c.package_name ?? "—"}</span>
                    <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 3 }}>{c.is_facility ? "Facility access" : left != null ? `${left} of ${c.package_sessions} credits left` : "—"}</div>
                  </td>
                  <td style={td}>
                    <div style={{ display: "flex", gap: 3 }} title={c.journey.steps.map((s) => `${s.done ? "✓" : "○"} ${s.label}`).join("   ")}>
                      {c.journey.steps.map((s, i) => (
                        <span key={i} style={{ width: 18, height: 6, borderRadius: 3, background: s.done ? "#16a34a" : "#e2e8f0" }} />
                      ))}
                    </div>
                    <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 4 }}>{c.journey.done}/{c.journey.total} · {c.journey.stage}</div>
                  </td>
                  <td style={td}>{statusChip(c.status)}</td>
                  <td style={{ ...td, color: "var(--muted)" }}>{c.coach ?? "—"}</td>
                  <td style={td}>
                    {writer ? (
                      <form action={setClientOwner}>
                        <input type="hidden" name="id" value={c.id} />
                        <select name="owner" defaultValue={c.owner ?? ""} onChange={(e) => e.currentTarget.form?.requestSubmit()} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "5px 8px", fontSize: 12, background: "#fff", maxWidth: 140 }}>
                          <option value="">— unassigned —</option>
                          {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </form>
                    ) : (staff.find((s) => s.id === c.owner)?.name ?? "—")}
                  </td>
                  <td style={td}>{c.branch ? <span style={{ background: "#dbeafe", color: "#2563eb", borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>{c.branch}</span> : "—"}</td>
                  <td style={{ ...td, textAlign: "right" }}>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      <Link href={`/clients/${c.id}`} style={{ background: "var(--teal)", color: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>Open 360°</Link>
                      <Link href={`/clients/${c.id}?tab=card`} style={{ border: "1px solid var(--border)", background: "#fff", color: "var(--teal-dark)", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>Quick</Link>
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={9} style={{ padding: "24px 16px", textAlign: "center", color: "var(--muted)" }}>No matching clients</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
