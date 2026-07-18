"use client";

import { useState } from "react";
import Link from "next/link";
import { toggleConsultFlag, generateBlueprint, startConsult } from "@/lib/actions";

export type ConsultSummary = {
  id: string;
  client_id: string | null;
  client_name: string | null;
  summary: string | null;
  status: string;
  approved: boolean;
  shared: boolean;
  created_at: string;
};

export type ConsolidatedRow = {
  client_id: string;
  name: string;
  code: string | null;
  doctor: boolean;
  diet: boolean;
  trainer: boolean;
  generated: boolean;
  consolidated: string | null;
};

const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };

export default function SummariesPanel({
  roleLabel, roleKind, consults, consolidated, clients,
}: {
  roleLabel: string;
  roleKind: string;
  consults: ConsultSummary[];
  consolidated: ConsolidatedRow[];
  clients: { id: string; name: string }[];
}) {
  const [view, setView] = useState<"individual" | "consolidated">("individual");
  const pending = consults.filter((c) => !c.approved).length;
  const consolPending = consolidated.filter((c) => !c.generated).length;

  const seg = (k: "individual" | "consolidated", label: string, n: number) => (
    <button type="button" onClick={() => setView(k)} style={{
      padding: "7px 14px", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none",
      background: view === k ? "var(--card)" : "transparent", color: view === k ? "var(--ink)" : "var(--muted)",
      boxShadow: view === k ? "var(--shadow)" : "none",
    }}>{label} <span style={{ background: view === k ? "var(--teal-light)" : "#e7e7ea", color: view === k ? "var(--teal-dark)" : "var(--muted)", borderRadius: 999, padding: "0 7px", fontSize: 11, fontWeight: 700 }}>{n}</span></button>
  );
  const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  const disc = (on: boolean, label: string) => (
    <span style={{ background: on ? "var(--green-bg)" : "#eef2f1", color: on ? "#166534" : "var(--muted)", borderRadius: 999, padding: "2px 9px", fontSize: 10.5, fontWeight: 700 }}>{on ? "✓" : "○"} {label}</span>
  );

  return (
    <div>
      <div style={{ display: "inline-flex", gap: 4, padding: 4, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 12, marginBottom: 14 }}>
        {seg("individual", "📝 Individual summaries", pending)}
        {seg("consolidated", "🧬 Consolidated → Blueprint", consolPending)}
      </div>

      {view === "individual" ? (
        <>
        <form action={startConsult} style={{ ...box, padding: 12, marginBottom: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input type="hidden" name="kind" value={roleKind} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>▶ Start a {roleLabel} consultation</span>
          <span style={{ flex: 1 }} />
          <select name="client_id" required defaultValue="" style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", fontSize: 13, background: "#fff" }}>
            <option value="" disabled>Select client…</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Open console →</button>
        </form>

        <div style={{ ...box, overflow: "hidden" }}>
          <div style={{ padding: "10px 16px", fontSize: 12.5, color: "var(--muted)" }}>Approve your {roleLabel} consultation summaries. Approved summaries feed the client&apos;s Blueprint sign-off.</div>
          {consults.length ? consults.map((c) => (
            <div key={c.id} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 16px", borderTop: "1px solid var(--border)" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <b style={{ fontSize: 13 }}>{c.client_name ?? "—"}</b>
                  <span style={{ color: "var(--muted)", fontSize: 11.5 }}>{fmt(c.created_at)} · {c.status}</span>
                  {c.approved && <span style={{ background: "var(--green-bg)", color: "#166534", borderRadius: 999, padding: "1px 8px", fontSize: 10.5, fontWeight: 700 }}>✓ Approved</span>}
                  {c.shared && <span style={{ background: "#dbeafe", color: "#1e40af", borderRadius: 999, padding: "1px 8px", fontSize: 10.5, fontWeight: 700 }}>Shared</span>}
                </div>
                <div style={{ fontSize: 13, marginTop: 3, color: c.summary ? "var(--ink)" : "var(--muted)" }}>{c.summary || "No summary written yet."}</div>
              </div>
              <Link href={`/console/${c.id}`} style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "5px 11px", fontSize: 12, fontWeight: 600, textDecoration: "none", color: "var(--ink)", whiteSpace: "nowrap" }}>{c.status === "completed" ? "Open" : "▶ Console"}</Link>
              <form action={toggleConsultFlag}>
                <input type="hidden" name="id" value={c.id} />
                <input type="hidden" name="field" value="approved" />
                <input type="hidden" name="value" value={String(c.approved)} />
                <button style={{ background: c.approved ? "#fff" : "var(--ink)", color: c.approved ? "var(--muted)" : "#fff", border: c.approved ? "1px solid var(--border)" : "none", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>{c.approved ? "Unapprove" : "Approve"}</button>
              </form>
              <form action={toggleConsultFlag}>
                <input type="hidden" name="id" value={c.id} />
                <input type="hidden" name="field" value="shared" />
                <input type="hidden" name="value" value={String(c.shared)} />
                <button style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "5px 11px", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "var(--teal-dark)", whiteSpace: "nowrap" }}>{c.shared ? "Unshare" : "Share"}</button>
              </form>
            </div>
          )) : <div style={{ padding: "22px 16px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>No {roleLabel} summaries yet.</div>}
        </div>
        </>
      ) : (
        <div>
          <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 10 }}>Each professional approves their own summary. Once Doctor, Dietitian &amp; Trainer are all approved, sign off the consolidated summary — that generates the client&apos;s Blueprint.</div>
          <div style={{ ...box, overflow: "hidden" }}>
            {consolidated.length ? consolidated.map((c) => {
              const count = [c.doctor, c.diet, c.trainer].filter(Boolean).length;
              return (
                <div key={c.client_id} style={{ padding: "13px 16px", borderTop: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <b style={{ fontSize: 13 }}>{c.name} <span style={{ color: "var(--muted)", fontWeight: 500 }}>{c.code ? `· ${c.code}` : ""}</span></b>
                      <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>{disc(c.doctor, "Dr")}{disc(c.diet, "Diet")}{disc(c.trainer, "Trainer")}</div>
                    </div>
                    {c.generated
                      ? <Link href="/blueprint" style={{ background: "var(--green-bg)", color: "#166534", borderRadius: 999, padding: "5px 12px", fontSize: 12, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" }}>🧬 Blueprint generated — view</Link>
                      : count === 3
                        ? <span style={{ color: "#166534", fontSize: 12, fontWeight: 600 }}>Ready to sign off ↓</span>
                        : <span style={{ background: "var(--amber-bg)", color: "#92400e", borderRadius: 999, padding: "5px 12px", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>{count}/3 summaries approved</span>}
                  </div>
                  {!c.generated && count === 3 && (
                    <form action={generateBlueprint} style={{ marginTop: 10, display: "grid", gap: 8 }}>
                      <input type="hidden" name="client_id" value={c.client_id} />
                      <textarea name="consolidated" rows={2} defaultValue={c.consolidated ?? ""} placeholder="Consolidated summary across the three disciplines…" style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", fontSize: 13, background: "#fff", resize: "vertical" }} />
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <button style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>🧬 Sign off &amp; generate Blueprint</button>
                        <Link href="/blueprint" style={{ color: "var(--teal-dark)", textDecoration: "none", fontSize: 12.5, fontWeight: 600 }}>Enter health scores →</Link>
                      </div>
                    </form>
                  )}
                </div>
              );
            }) : <div style={{ padding: "22px 16px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>No BluePrint-package clients yet.</div>}
          </div>
        </div>
      )}
    </div>
  );
}
