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

export default function AppointmentsBoard({ appts, today, myStaffId = null }: { appts: ApptRow[]; today: string; myStaffId?: string | null }) {
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
    }}>{label} <span style={{ background: view === k ? "var(--brand-tint)" : "#e7e7ea", color: view === k ? "var(--brand-text)" : "var(--muted)", borderRadius: 999, padding: "0 7px", fontSize: 11, fontWeight: 700 }}>{n}</span></button>
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
                {a.is_experience && <span style={{ marginLeft: 7, background: "var(--amber-bg)", color: "var(--amber-text)", borderRadius: 999, padding: "1px 8px", fontSize: 10.5, fontWeight: 700 }}>Trial</span>}
                <div style={{ color: "var(--muted)", fontSize: 12 }}>{a.title || a.type || "Consultation"}</div>
              </div>
              {a.is_experience && a.exp_kind
                ? <TrialOutcomeActions id={a.id} kind={a.exp_kind} status={a.status} />
                : chip(s[0], s[1], s[2])}
              {/* Trials are pre-sale: the assigned clinician marks them
                  Attended/No-show above, not "started" as a client consultation. */}
              {!a.is_experience && a.status === "scheduled" && !!myStaffId && a.provider_id === myStaffId && (
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
