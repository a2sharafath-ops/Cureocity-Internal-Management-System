"use client";

import { useState } from "react";
import Link from "next/link";

export type ApptRow = {
  id: string;
  client_id: string | null;
  client_name: string | null;
  date: string;
  hour: number | null;
  type: string | null;
  title: string | null;
  status: string;
};

const STATUS: Record<string, [string, string, string]> = {
  scheduled: ["#eef2f1", "var(--muted)", "Scheduled"],
  completed: ["var(--green-bg)", "#166534", "Completed"],
  cancelled: ["var(--red-bg)", "#991b1b", "Cancelled"],
  no_show: ["var(--amber-bg)", "#92400e", "No-show"],
};

function fmtHour(h: number | null) {
  if (h == null) return "—";
  const am = h < 12, hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:00 ${am ? "AM" : "PM"}`;
}
function fmtDate(d: string) {
  return new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", timeZone: "UTC" });
}

export default function AppointmentsBoard({ appts, today }: { appts: ApptRow[]; today: string }) {
  const [view, setView] = useState<"upcoming" | "past">("upcoming");
  const upcoming = appts.filter((a) => a.status === "scheduled" && a.date >= today).sort((a, b) => (a.date + a.hour).localeCompare(b.date + String(b.hour)));
  const past = appts.filter((a) => !(a.status === "scheduled" && a.date >= today)).sort((a, b) => (b.date).localeCompare(a.date));
  const todayCount = appts.filter((a) => a.date === today && a.status !== "cancelled").length;
  const list = view === "past" ? past : upcoming;

  const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
  const chip = (bg: string, c: string, t: string) => <span style={{ background: bg, color: c, borderRadius: 999, padding: "3px 10px", fontSize: 11.5, fontWeight: 600 }}>{t}</span>;
  const seg = (k: "upcoming" | "past", label: string, n: number) => (
    <button type="button" onClick={() => setView(k)} style={{
      padding: "7px 14px", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none",
      background: view === k ? "var(--card)" : "transparent", color: view === k ? "var(--ink)" : "var(--muted)",
      boxShadow: view === k ? "var(--shadow)" : "none",
    }}>{label} <span style={{ background: view === k ? "var(--teal-light)" : "#e7e7ea", color: view === k ? "var(--teal-dark)" : "var(--muted)", borderRadius: 999, padding: "0 7px", fontSize: 11, fontWeight: 700 }}>{n}</span></button>
  );

  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ ...box, padding: "12px 16px", flex: 1, minWidth: 130 }}><div style={{ color: "var(--muted)", fontSize: 12 }}>Upcoming</div><div style={{ fontSize: 22, fontWeight: 800 }}>{upcoming.length}</div></div>
        <div style={{ ...box, padding: "12px 16px", flex: 1, minWidth: 130 }}><div style={{ color: "var(--muted)", fontSize: 12 }}>Today</div><div style={{ fontSize: 22, fontWeight: 800 }}>{todayCount}</div></div>
        <div style={{ ...box, padding: "12px 16px", flex: 1, minWidth: 130 }}><div style={{ color: "var(--muted)", fontSize: 12 }}>Completed</div><div style={{ fontSize: 22, fontWeight: 800 }}>{appts.filter((a) => a.status === "completed").length}</div></div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ display: "inline-flex", gap: 4, padding: 4, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 12 }}>
          {seg("upcoming", "Upcoming", upcoming.length)}{seg("past", "Past", past.length)}
        </div>
        <span style={{ flex: 1 }} />
        <Link href="/appointments" style={{ background: "var(--ink)", color: "#fff", borderRadius: 8, padding: "8px 13px", fontSize: 12.5, fontWeight: 600, textDecoration: "none" }}>Full calendar &amp; booking →</Link>
      </div>

      <div style={{ ...box, overflow: "hidden" }}>
        {list.length ? list.map((a) => {
          const s = STATUS[a.status] ?? STATUS.scheduled;
          return (
            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderTop: "1px solid var(--border)" }}>
              <div style={{ width: 64, textAlign: "center" }}>
                <div style={{ fontSize: 12, fontWeight: 700 }}>{fmtHour(a.hour)}</div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>{fmtDate(a.date)}</div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b style={{ fontSize: 13 }}>{a.client_name ?? "—"}</b>
                <div style={{ color: "var(--muted)", fontSize: 12 }}>{a.title || a.type || "Consultation"}</div>
              </div>
              {chip(s[0], s[1], s[2])}
              {a.client_id && <Link href={`/clients/${a.client_id}`} style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "5px 11px", fontSize: 12, fontWeight: 600, textDecoration: "none", color: "var(--teal-dark)" }}>Card</Link>}
            </div>
          );
        }) : <div style={{ padding: "22px 16px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>No {view} appointments for your clients.</div>}
      </div>
    </div>
  );
}
