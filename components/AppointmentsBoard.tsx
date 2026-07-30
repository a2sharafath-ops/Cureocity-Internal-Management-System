"use client";

import { useState } from "react";
import Link from "next/link";
import { startConsultFromAppointment } from "@/lib/actions";
import TrialOutcomeActions from "@/components/TrialOutcomeActions";

export type ApptRow = {
  id: string;
  client_id: string | null;
  provider_id: string | null;
  client_name: string | null;
  date: string;
  hour: number | null;
  type: string | null;
  title: string | null;
  status: string;
  /** a pre-sale trial booking (lead, not a client) */
  is_experience?: boolean;
  exp_kind?: "assessment" | "training";
  lead_id?: string | null;
};

const STATUS: Record<string, [string, string, string]> = {
  scheduled: ["var(--neutral-bg)", "var(--muted)", "Scheduled"],
  completed: ["var(--green-bg)", "var(--green-text)", "Completed"],
  cancelled: ["var(--red-bg)", "var(--red-text)", "Cancelled"],
  no_show: ["var(--amber-bg)", "var(--amber-text)", "No-show"],
};

function fmtHour(h: number | null) {
  if (h == null) return "—";
  const am = h < 12, hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:00 ${am ? "AM" : "PM"}`;
}
function fmtDate(d: string) {
  return new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", timeZone: "UTC" });
}

export default function AppointmentsBoard({ appts, today, myStaffId = null, canStartAny = false }: { appts: ApptRow[]; today: string; myStaffId?: string | null; canStartAny?: boolean }) {
  const [view, setView] = useState<"upcoming" | "today" | "completed" | "past">("upcoming");
  const upcoming = appts.filter((a) => a.status === "scheduled" && a.date >= today).sort((a, b) => (a.date + a.hour).localeCompare(b.date + String(b.hour)));
  const todayList = appts.filter((a) => a.date === today && a.status !== "cancelled").sort((a, b) => (a.hour ?? 0) - (b.hour ?? 0));
  const completed = appts.filter((a) => a.status === "completed").sort((a, b) => b.date.localeCompare(a.date));
  const past = appts.filter((a) => !(a.status === "scheduled" && a.date >= today)).sort((a, b) => (b.date).localeCompare(a.date));
  const list = view === "today" ? todayList : view === "completed" ? completed : view === "past" ? past : upcoming;

  const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
  const chip = (bg: string, c: string, t: string) => <span style={{ background: bg, color: c, borderRadius: 999, padding: "3px 10px", fontSize: 11.5, fontWeight: 600 }}>{t}</span>;
  const todayDone = todayList.filter((a) => a.status === "completed").length;
  const todayPending = todayList.length - todayDone;

  // The three stat cards double as the filter — click one to drill into that list.
  const statCard = (k: "upcoming" | "today" | "completed", label: string, n: number, sub?: React.ReactNode) => {
    const on = view === k;
    return (
      <button type="button" onClick={() => setView(k)} aria-pressed={on} style={{
        flex: 1, minWidth: 130, textAlign: "left", cursor: "pointer",
        background: on ? "var(--brand-tint)" : "var(--card)", boxShadow: "var(--shadow)",
        border: on ? "2px solid var(--brand-fill)" : "1px solid var(--border)", borderRadius: "var(--radius)", padding: on ? "11px 15px" : "12px 16px",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", color: "var(--muted)", fontSize: 12, fontWeight: 600 }}>{label}<span style={{ color: "var(--brand-text)", fontSize: 12 }}>{on ? "● showing" : "view →"}</span></div>
        <div style={{ fontSize: 22, fontWeight: 800, color: on ? "var(--brand-text)" : "var(--ink)" }}>{n}</div>
        {sub && <div style={{ marginTop: 2 }}>{sub}</div>}
      </button>
    );
  };

  const pill = (text: string, bg: string, fg: string) => <span style={{ background: bg, color: fg, borderRadius: 999, padding: "1px 8px", fontSize: 10.5, fontWeight: 700 }}>{text}</span>;

  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        {statCard("upcoming", "Upcoming", upcoming.length)}
        {statCard("today", "Today", todayList.length,
          todayList.length > 0
            ? <span style={{ display: "inline-flex", gap: 5, flexWrap: "wrap" }}>{pill(`${todayPending} to do`, "var(--amber-bg)", "var(--amber-text)")}{pill(`${todayDone} done`, "var(--green-bg)", "var(--green-text)")}</span>
            : undefined)}
        {statCard("completed", "Completed", completed.length)}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, fontWeight: 700, textTransform: "capitalize" }}>{view} · {list.length}</span>
        <button type="button" onClick={() => setView("past")} style={{
          border: "1px solid var(--border)", borderRadius: 999, padding: "4px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer",
          background: view === "past" ? "var(--brand-fill)" : "#fff", color: view === "past" ? "#fff" : "var(--muted)",
        }}>Past · {past.length}</button>
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
                {a.is_experience && <span style={{ marginLeft: 7, background: "var(--amber-bg)", color: "var(--amber-text)", borderRadius: 999, padding: "1px 8px", fontSize: 10.5, fontWeight: 700 }}>Trial</span>}
                <div style={{ color: "var(--muted)", fontSize: 12 }}>{a.title || a.type || "Consultation"}</div>
              </div>
              {a.is_experience && a.exp_kind
                ? <TrialOutcomeActions id={a.id} kind={a.exp_kind} status={a.status} />
                : chip(s[0], s[1], s[2])}
              {/* Trials are pre-sale: the assigned clinician marks them
                  Attended/No-show above, not "started" as a client consultation. */}
              {!a.is_experience && a.status === "scheduled" && (canStartAny || (!!myStaffId && a.provider_id === myStaffId)) && (
                <form action={startConsultFromAppointment} style={{ margin: 0 }}>
                  <input type="hidden" name="appointment_id" value={a.id} />
                  <button type="submit" style={{ background: "var(--brand-fill)", color: "#fff", border: "none", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>▶ Start</button>
                </form>
              )}
              {a.client_id && <Link href={`/clients/${a.client_id}`} style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "5px 11px", fontSize: 12, fontWeight: 600, textDecoration: "none", color: "var(--brand-text)" }}>Card</Link>}
              {a.is_experience && a.lead_id && <Link href={`/leads/${a.lead_id}`} style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "5px 11px", fontSize: 12, fontWeight: 600, textDecoration: "none", color: "var(--brand-text)" }}>Lead</Link>}
            </div>
          );
        }) : <div style={{ padding: "22px 16px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>No {view} appointments.</div>}
      </div>
    </div>
  );
}
