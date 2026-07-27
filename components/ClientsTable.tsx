"use client";

import Link from "next/link";
import { useState } from "react";
import ClientQuickDrawer from "@/components/ClientQuickDrawer";
import { setClientOwner } from "@/lib/actions";
import { BRANCHES } from "@/lib/branches";
import SegTabs from "@/components/SegTabs";
import ClientStatusBadge from "@/components/ClientStatusBadge";
import type { ClientStatus } from "@/lib/client-status";

export type ClientRow = {
  id: string; code: string | null; name: string; phone: string | null; email: string | null;
  age: number | null; branch: string | null; used: number;
  package_name: string | null; is_facility: boolean; package_sessions: number;
  packages?: { label: string; category: string }[]; careTeam?: { disc: string; name: string }[];
  is_blueprint: boolean; status: string; coach: string | null; owner: string | null;
  journey: { steps: { label: string; done: boolean }[]; done: number; total: number; stage: string };
  careStatus?: ClientStatus | null;
};

const CAT_SHORT: Record<string, string> = { membership: "Membership", comprehensive: "Comprehensive", training: "PT", blueprint: "BluePrint" };
const DISC_ABBR: Record<string, string> = { Doctor: "Dr", Diet: "Diet", Fitness: "Fit", Coach: "Coach", Psych: "Psy" };

export default function ClientsTable({ clients, staff, writer }: { clients: ClientRow[]; staff: { id: string; name: string }[]; writer: boolean }) {
  const [q, setQ] = useState("");
  const [quickId, setQuickId] = useState<string | null>(null);
  const [tab, setTab] = useState<"all" | "blueprint">("all");
  const [status, setStatus] = useState("All");
  const [branch, setBranch] = useState("All");

  const query = q.trim().toLowerCase();
  const rows = clients.filter((c) => {
    if (tab === "blueprint" && !c.is_blueprint) return false;
    if (status !== "All" && c.status !== status) return false;
    if (branch !== "All" && (c.branch ?? "") !== branch) return false;
    if (!query) return true;
    return c.name.toLowerCase().includes(query) || (c.phone ?? "").toLowerCase().includes(query) ||
      (c.email ?? "").toLowerCase().includes(query) || (c.code ?? "").toLowerCase().includes(query);
  });
  const bpCount = clients.filter((c) => c.is_blueprint).length;

  const th: React.CSSProperties = { padding: "12px 16px", textAlign: "left", color: "var(--muted)", fontSize: 12 };
  const td: React.CSSProperties = { padding: "12px 16px", fontSize: 14, verticalAlign: "middle" };
  const statusChip = (s: string) => {
    const on = s === "Active";
    return <span style={{ background: on ? "var(--green-bg)" : "var(--neutral-bg)", color: on ? "var(--green-text)" : "var(--muted)", borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>{s}</span>;
  };

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <SegTabs active={tab} onSelect={(k) => setTab(k as typeof tab)} items={[
          { key: "all", label: "All Clients", count: clients.length },
          { key: "blueprint", label: "Blueprint clients", count: bpCount },
        ]} />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, phone, or email" style={{ maxWidth: 340, width: "100%", padding: "9px 12px", fontSize: 14, border: "1px solid var(--border)", borderRadius: 10, outline: "none", background: "#fff" }} />
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ padding: "9px 12px", fontSize: 14, border: "1px solid var(--border)", borderRadius: 10, background: "#fff" }}>
          <option>All</option><option>Active</option><option>Completed</option>
        </select>
        <select value={branch} onChange={(e) => setBranch(e.target.value)} style={{ padding: "9px 12px", fontSize: 14, border: "1px solid var(--border)", borderRadius: 10, background: "#fff" }}>
          <option value="All">All branches</option>
          {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <span style={{ flex: 1 }} />
        <span style={{ background: "var(--neutral-bg)", color: "var(--muted)", borderRadius: 999, padding: "4px 10px", fontSize: 12 }}>{rows.length} client{rows.length === 1 ? "" : "s"}</span>
      </div>

      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, minWidth: 1040 }}>
          <thead>
            <tr>
              <th style={th}>Name</th><th style={th}>Age</th><th style={th}>Package</th><th style={th}>Journey</th><th style={th}>Status</th>
              {/* The full care team assigned to the client (per discipline),
                  not just the single denormalised pro_id. */}
              <th style={th}>Care Team</th><th style={th}>Owner (Front Desk)</th><th style={th}>Branch</th><th style={th} />
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
                    {c.packages && c.packages.length ? (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, maxWidth: 190 }}>
                        {c.packages.map((p, i) => (
                          <span key={i} title={p.label} style={{ background: "var(--brand-tint)", color: "var(--brand-text)", borderRadius: 999, padding: "2px 9px", fontSize: 11.5, fontWeight: 600, whiteSpace: "nowrap" }}>{CAT_SHORT[p.category] ?? p.label}</span>
                        ))}
                      </div>
                    ) : <span style={{ background: "var(--brand-tint)", color: "var(--brand-text)", borderRadius: 999, padding: "2px 9px", fontSize: 11.5, fontWeight: 600 }}>{c.package_name ?? "—"}</span>}
                    {(c.is_facility || left != null) && <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 3 }}>{c.is_facility ? "Facility access" : `${left} of ${c.package_sessions} credits left`}</div>}
                  </td>
                  <td style={td}>
                    <div style={{ display: "flex", gap: 3 }} title={c.journey.steps.map((s) => `${s.done ? "✓" : "○"} ${s.label}`).join("   ")}>
                      {c.journey.steps.map((s, i) => (
                        <span key={i} style={{ width: 18, height: 6, borderRadius: 3, background: s.done ? "var(--green)" : "#e2e8f0" }} />
                      ))}
                    </div>
                    <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ color: "var(--muted)", fontSize: 11 }}>{c.journey.done}/{c.journey.total}</span>
                      {c.careStatus ? <ClientStatusBadge status={c.careStatus} size="sm" /> : <span style={{ color: "var(--muted)", fontSize: 11 }}>· {c.journey.stage}</span>}
                    </div>
                  </td>
                  <td style={td}>{statusChip(c.status)}</td>
                  <td style={{ ...td, color: "var(--muted)" }}>
                    {c.careTeam && c.careTeam.length ? (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, maxWidth: 220 }}>
                        {c.careTeam.map((t, i) => (
                          <span key={i} title={`${t.disc} · ${t.name}`} style={{ display: "inline-flex", alignItems: "center", gap: 5, border: "1px solid var(--border)", borderRadius: 999, padding: "2px 8px", fontSize: 11.5, whiteSpace: "nowrap", background: "#fff" }}>
                            <span style={{ color: "var(--muted)", fontWeight: 600 }}>{DISC_ABBR[t.disc] ?? t.disc}</span>
                            <span style={{ color: "var(--ink)" }}>{t.name}</span>
                          </span>
                        ))}
                      </div>
                    ) : (c.coach ?? "—")}
                  </td>
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
                  <td style={td}>{c.branch ? <span style={{ background: "var(--blue-bg)", color: "var(--blue)", borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>{c.branch}</span> : "—"}</td>
                  <td style={{ ...td, textAlign: "right" }}>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      <Link href={`/clients/${c.id}`} style={{ background: "var(--ink)", color: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>Open 360°</Link>
                      <button type="button" onClick={() => setQuickId(c.id)} style={{ border: "1px solid var(--border)", background: "#fff", color: "var(--brand-text)", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Quick</button>
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

      {quickId && <ClientQuickDrawer clientId={quickId} onClose={() => setQuickId(null)} />}
    </div>
  );
}
