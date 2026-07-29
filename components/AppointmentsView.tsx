"use client";

import { useState, useTransition, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createAppointment } from "@/lib/actions";
import AppointmentActions from "@/components/AppointmentActions";
import SegTabs from "@/components/SegTabs";
import ClientStatusBadge from "@/components/ClientStatusBadge";
import type { ClientStatus } from "@/lib/client-status";

export type ViewAppt = {
  id: string; client_id: string; clientName: string | null; type: string | null; title: string | null;
  date: string; hour: number; duration_min: number; status: string; provider_id: string | null; providerName: string | null;
};
export type Provider = { id: string; name: string; color: string; discipline: string };
export type Unsched = { id: string; clientId: string; clientName: string; label: string; disc: string; due: string | null; owner?: string | null; category?: string };

const DISCIPLINES = ["All", "Doctor", "Dietitian", "Fitness Trainer", "Health Coach", "Psychologist"];
// Discipline (display) → the service catalogue category it books into. Used to
// auto-pick the discipline's initial service as the default Type.
const DISC_CATEGORY: Record<string, string> = {
  Doctor: "Doctor Consultation", Dietitian: "Diet Consultation",
  "Fitness Trainer": "Fitness Services", "Health Coach": "Coaching", Psychologist: "Counselling",
};

function hourLabel(h: number) { const am = h < 12; const hr = h % 12 === 0 ? 12 : h % 12; return `${hr} ${am ? "AM" : "PM"}`; }
function hourLabelFull(h: number) { const am = h < 12; const hr = h % 12 === 0 ? 12 : h % 12; return `${hr}:00 ${am ? "AM" : "PM"}`; }
function dayName(iso: string) { return new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" }); }
function dayNum(iso: string) { return new Date(iso + "T00:00:00Z").getUTCDate(); }
function fmtDate(iso: string) { return new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" }); }

export default function AppointmentsView({
  today, days, hours, appts, providers, clients, unscheduled = [], weekLabel, prevHref, nextHref, isThisWeek, statusByClient = {},
  providerKind = {}, bookedKinds = {}, serviceTypes = [], careTeamByClient = {},
}: {
  today: string; days: string[]; hours: number[]; appts: ViewAppt[];
  providers: Provider[]; clients: { id: string; name: string }[]; unscheduled?: Unsched[];
  weekLabel: string; prevHref: string; nextHref: string; isThisWeek: boolean;
  statusByClient?: Record<string, ClientStatus>;
  /** staff id → consultation kind, and per-client kinds already booked — used to
   *  disable Book for a duplicate initial consult before the server rejects it. */
  providerKind?: Record<string, string>;
  bookedKinds?: Record<string, string[]>;
  /** The active service catalogue (name + category) — drives the Type dropdown. */
  serviceTypes?: { name: string; category: string }[];
  /** client id → { discipline display name → assigned staff id }. Used to
   *  auto-fill the provider once a client + discipline are chosen. */
  careTeamByClient?: Record<string, Record<string, string>>;
}) {
  const navBtn: React.CSSProperties = { border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 13, textDecoration: "none", color: "var(--brand-text)", fontWeight: 600 };
  const [tab, setTab] = useState<"calendar" | "tracker" | "list" | "records" | "unscheduled">("calendar");
  // Deep-link from a client's "Book →": ?client=<id>&disc=<discipline> opens the
  // booking form pre-filled with that patient and filters the clinician list to
  // the discipline, so front desk lands straight on date/slot/provider.
  const params = useSearchParams();
  const preClient = params.get("client") ?? "";
  const preDisc = params.get("disc") ?? "";
  const preType = params.get("type") ?? "";
  const [disc, setDisc] = useState(DISCIPLINES.includes(preDisc) ? preDisc : "All");
  const [booking, setBooking] = useState<{ open: boolean; date: string; hour: number; provider: string; client: string; taskId?: string }>(
    preClient
      ? { open: true, date: today, hour: 10, provider: "", client: preClient }
      : { open: false, date: today, hour: 10, provider: "", client: "" },
  );
  const [bookErr, setBookErr] = useState<string | null>(null);
  // Bookable types come from the active service catalogue, grouped by category.
  // Fall back to a minimal generic set if no services are configured yet.
  const FALLBACK_TYPES = ["Consultation", "Assessment", "Follow-up", "Diet Chart Explanation"];
  const groupedServices = serviceTypes.reduce<Record<string, string[]>>((acc, s) => {
    (acc[s.category] ??= []).push(s.name);
    return acc;
  }, {});
  const serviceCategories = Object.keys(groupedServices);
  const hasServices = serviceCategories.length > 0;
  // A sensible starting type: the deep-linked one, else the initial consult for
  // the pre-filtered discipline, else the first "Initial …" service / generic.
  const discCat = preDisc === "Fitness Trainer" ? "fitness" : preDisc === "Dietitian" ? "diet" : preDisc === "Doctor" ? "doctor" : null;
  const discInitial = discCat ? serviceTypes.find((s) => new RegExp(discCat, "i").test(s.category) && /initial/i.test(s.name))?.name : undefined;
  const firstInitial = serviceTypes.find((s) => /initial/i.test(s.name))?.name;
  const defaultType = preType || discInitial || firstInitial || (hasServices ? serviceTypes[0].name : "Consultation");
  const [apptType, setApptType] = useState<string>(defaultType);

  // Fewer clicks: as soon as a patient + discipline are known, pre-fill the
  // obvious choices — the client's assigned care-team clinician as Provider, and
  // that discipline's initial service as Type. Both remain freely changeable.
  useEffect(() => {
    if (!booking.client || disc === "All") return;
    const assigned = careTeamByClient[booking.client]?.[disc];
    if (assigned) setBooking((b) => (b.provider === assigned ? b : { ...b, provider: assigned }));
    if (!preType) {
      const cat = DISC_CATEGORY[disc];
      const svc = cat
        ? serviceTypes.find((s) => s.category === cat && /initial/i.test(s.name))?.name
          ?? serviceTypes.find((s) => s.category === cat)?.name
        : undefined;
      if (svc) setApptType(svc);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking.client, disc]);
  const [booking2, startBooking] = useTransition();
  const submitBooking = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBookErr(null);
    startBooking(async () => {
      const r = await createAppointment(fd);
      if (r?.ok) setBooking((b) => ({ ...b, open: false }));
      else setBookErr(r?.error ?? "Could not book");
    });
  };

  const provMap = new Map(providers.map((p) => [p.id, p]));
  const provDisc = (pid: string | null) => (pid ? provMap.get(pid)?.discipline ?? null : null);
  const provColor = (pid: string | null) => (pid ? provMap.get(pid)?.color ?? "#e11f34" : "#e11f34");

  // Hours already taken on the chosen date — greyed out in the time picker so
  // front desk can't pick a clashing slot. Two kinds of clash, both enforced by
  // the server: the chosen provider is busy, OR the chosen client is already
  // booked (with anyone). (This UI covers the loaded week; the server covers any date.)
  const providerTakenHours = booking.provider
    ? appts.filter((a) => a.status === "scheduled" && a.provider_id === booking.provider && a.date === booking.date).map((a) => a.hour)
    : [];
  const clientTakenHours = booking.client
    ? appts.filter((a) => a.status === "scheduled" && a.client_id === booking.client && a.date === booking.date).map((a) => a.hour)
    : [];
  const takenHours = new Set<number>([...providerTakenHours, ...clientTakenHours]);
  const clientClash = clientTakenHours.includes(booking.hour);

  const visible = appts.filter((a) => a.status !== "cancelled" && (disc === "All" || provDisc(a.provider_id) === disc));
  const cells = new Map<string, ViewAppt[]>();
  for (const a of visible) { const k = `${a.date}|${a.hour}`; (cells.get(k) ?? cells.set(k, []).get(k)!).push(a); }

  const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
  const statusStyle = (s: string): React.CSSProperties => s === "completed" ? { opacity: 0.75 } : s === "no_show" ? { opacity: 0.6, textDecoration: "line-through" } : {};
  // Small colour + label so completed vs not-completed reads at a glance on the grid.
  const STATUS_MARK: Record<string, { color: string; label: string }> = {
    scheduled: { color: "var(--blue-text)", label: "Scheduled" },
    completed: { color: "var(--green-text)", label: "✓ Completed" },
    no_show: { color: "var(--red-text)", label: "No-show" },
    cancelled: { color: "#64748b", label: "Cancelled" },
  };
  const statusMark = (s: string) => {
    const m = STATUS_MARK[s] ?? STATUS_MARK.scheduled;
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 9.5, fontWeight: 700, color: m.color }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: m.color, display: "inline-block" }} />
        {m.label}
      </span>
    );
  };
  const chip = (active: boolean): React.CSSProperties => ({ padding: "6px 13px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "1px solid var(--border)", background: active ? "var(--brand-fill)" : "#fff", color: active ? "#fff" : "var(--muted)" });
  const statusChip = (s: string) => {
    const m: Record<string, [string, string]> = { scheduled: ["var(--blue-bg)", "var(--blue-text)"], completed: ["var(--green-bg)", "var(--green-text)"], no_show: ["var(--red-bg)", "var(--red-text)"], cancelled: ["var(--neutral-bg)", "#64748b"] };
    const [bg, fg] = m[s] ?? ["var(--neutral-bg)", "#64748b"];
    return <span style={{ background: bg, color: fg, borderRadius: 999, padding: "2px 9px", fontSize: 11, fontWeight: 600 }}>{s.replace("_", " ")}</span>;
  };

  const openBooking = (date: string, hour: number) => setBooking({ open: true, date, hour, provider: "", client: "" });
  const visibleUnsched = unscheduled.filter((u) => disc === "All" || u.disc === disc);
  // Book one of the "to book" items: pre-fill the form with its client and
  // filter clinicians to its discipline, then open it.
  const bookUnsched = (u: Unsched) => {
    setDisc(DISCIPLINES.includes(u.disc) ? u.disc : "All");
    setBooking({ open: true, date: today, hour: 10, provider: "", client: u.clientId, taskId: u.id });
  };
  const sorted = [...visible].sort((a, b) => a.date === b.date ? a.hour - b.hour : a.date < b.date ? -1 : 1);

  // Proactive one-initial-consult-per-discipline guard for the booking form,
  // mirroring the createAppointment rule so Book is disabled up front instead of
  // erroring on submit. Only bites for an initial type (Consultation/Assessment)
  // with a provider whose discipline the client already has booked.
  const selKind = booking.provider ? (providerKind[booking.provider] ?? null) : null;
  // "Initial …" services (and the legacy generic Consultation/Assessment) are
  // the once-per-discipline bookings the duplicate guard applies to.
  const isInitialType = /initial/i.test(apptType) || apptType === "Consultation" || apptType === "Assessment";
  const dupConsult = Boolean(selKind && isInitialType && (bookedKinds[booking.client] ?? []).includes(selKind));
  const dupLabel = selKind === "Diet" ? "dietitian" : selKind === "Trainer" ? "fitness" : (selKind ?? "").toLowerCase();
  const upcoming = sorted.filter((a) => a.date >= today && a.status === "scheduled");
  const records = sorted.filter((a) => a.status === "completed" || a.date < today);
  const counts = { scheduled: visible.filter((a) => a.status === "scheduled").length, completed: visible.filter((a) => a.status === "completed").length, no_show: visible.filter((a) => a.status === "no_show").length };

  return (
    <div>
      {/* header: title + New Booking */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 6 }}>
        <div>
          <h1 style={{ fontSize: 20, margin: "0 0 2px" }}>Appointment Calendar</h1>
          <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>Calendar · tracker · list · records — consultations, assessments &amp; follow-ups</p>
        </div>
        <span style={{ flex: 1 }} />
        <button type="button" onClick={() => setBooking({ open: true, date: today, hour: 10, provider: "", client: "" })} style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 10, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ New Booking</button>
      </div>

      {/* week nav */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "12px 0 14px", flexWrap: "wrap" }}>
        <Link href={prevHref} style={navBtn}>← Prev</Link>
        <Link href="/appointments" style={{ ...navBtn, background: isThisWeek ? "var(--brand-fill)" : "#fff", color: isThisWeek ? "#fff" : "var(--brand-text)" }}>This week</Link>
        <Link href={nextHref} style={navBtn}>Next →</Link>
        <span style={{ color: "var(--muted)", fontSize: 14, fontWeight: 600 }}>{weekLabel}</span>
      </div>

      {/* sub-view tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        <SegTabs active={tab} onSelect={(k) => setTab(k as typeof tab)} items={[
          { key: "calendar", label: "Calendar" },
          { key: "tracker", label: "Tracker" },
          { key: "unscheduled", label: `To book${visibleUnsched.length ? ` · ${visibleUnsched.length}` : ""}` },
          { key: "list", label: "List" },
          { key: "records", label: "Records" },
        ]} />
      </div>

      <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 12px" }}>
        Consultations, assessments &amp; follow-ups — doctor, dietitian, psychologist, health coach and fitness assessments. Click any empty cell to book.
      </p>

      {/* discipline filter + provider legend */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
        {DISCIPLINES.map((d) => <button key={d} type="button" onClick={() => setDisc(d)} style={chip(disc === d)}>{d}</button>)}
        <span style={{ width: 1, height: 22, background: "var(--border)", margin: "0 4px" }} />
        {providers.map((p) => (
          <span key={p.id} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--muted)" }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: p.color }} />{p.name}
          </span>
        ))}
      </div>

      {/* inline booking form */}
      {booking.open && (
        <form key={`${booking.client}|${booking.taskId ?? ""}`} onSubmit={submitBooking} style={{ ...box, padding: 16, marginBottom: 16, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, alignItems: "end" }}>
          {booking.taskId && <input type="hidden" name="task_id" value={booking.taskId} />}
          <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Patient</label><select style={input} name="client_id" required value={booking.client} onChange={(e) => setBooking((b) => ({ ...b, client: e.target.value }))}><option value="" disabled>Patient…</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Provider ({disc === "All" ? "any discipline" : disc})</label><select style={input} name="provider_id" value={booking.provider} onChange={(e) => setBooking((b) => ({ ...b, provider: e.target.value }))}><option value="">— any available —</option>{providers.filter((s) => disc === "All" || s.discipline === disc).map((s) => <option key={s.id} value={s.id}>{s.name} · {s.discipline}</option>)}</select></div>
          <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Type</label><select style={input} name="type" value={apptType} onChange={(e) => setApptType(e.target.value)}>
            {hasServices
              ? serviceCategories.map((cat) => (
                  <optgroup key={cat} label={cat}>
                    {groupedServices[cat].map((n) => <option key={n} value={n}>{n}</option>)}
                  </optgroup>
                ))
              : FALLBACK_TYPES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select></div>
          <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Title (optional)</label><input style={input} name="title" placeholder="e.g. Diet review" /></div>
          <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Date</label><input style={input} name="date" type="date" required value={booking.date} onChange={(e) => setBooking((b) => ({ ...b, date: e.target.value }))} /></div>
          <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Time{takenHours.size > 0 ? " · booked slots greyed" : ""}</label><select style={input} name="hour" value={String(booking.hour)} onChange={(e) => setBooking((b) => ({ ...b, hour: Number(e.target.value) }))}>{hours.map((h) => <option key={h} value={h} disabled={takenHours.has(h)}>{hourLabelFull(h)}{takenHours.has(h) ? " · booked" : ""}</option>)}</select></div>
          <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Duration</label><select style={input} name="duration_min" defaultValue="30"><option value="15">15 min</option><option value="30">30 min</option><option value="45">45 min</option><option value="60">60 min</option></select></div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" disabled={booking2 || dupConsult || takenHours.has(booking.hour)} style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: (booking2 || dupConsult || takenHours.has(booking.hour)) ? "default" : "pointer", opacity: (dupConsult || takenHours.has(booking.hour)) ? 0.5 : 1 }}>{booking2 ? "Booking…" : "Book"}</button>
            <button type="button" onClick={() => { setBookErr(null); setBooking((b) => ({ ...b, open: false })); }} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 14px", fontSize: 13, cursor: "pointer" }}>Cancel</button>
          </div>
          {dupConsult && !bookErr && <div style={{ gridColumn: "1 / -1", fontSize: 12.5, color: "var(--amber-text)", background: "var(--amber-bg)", borderRadius: 8, padding: "8px 10px" }}>This client already has a {dupLabel} consultation for this package — the initial consult is one per package. Change Type to <b>Follow-up</b> to book another, or cancel the existing one first.</div>}
          {takenHours.has(booking.hour) && !dupConsult && !bookErr && <div style={{ gridColumn: "1 / -1", fontSize: 12.5, color: "var(--amber-text)", background: "var(--amber-bg)", borderRadius: 8, padding: "8px 10px" }}>{clientClash ? "This client already has an appointment at this time — pick another slot." : "That provider is already booked at this time — pick another slot."}</div>}
          {bookErr && <div style={{ gridColumn: "1 / -1", fontSize: 12.5, color: "var(--red-text)", background: "var(--red-bg)", borderRadius: 8, padding: "8px 10px" }}>{bookErr}</div>}
        </form>
      )}

      {tab === "calendar" && (
        <div style={{ ...box, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
            <thead>
              <tr>
                <th style={{ width: 56, padding: "8px 6px", borderBottom: "1px solid var(--border)" }} />
                {days.map((d) => (
                  <th key={d} style={{ padding: "8px 6px", borderBottom: "1px solid var(--border)", borderLeft: "1px solid var(--border)", textAlign: "center", background: d === today ? "var(--brand-tint)" : "transparent" }}>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>{dayName(d)}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: d === today ? "var(--brand-text)" : "inherit" }}>{dayNum(d)}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {hours.map((h) => (
                <tr key={h}>
                  <td style={{ padding: "4px 6px", color: "var(--muted)", fontSize: 11, textAlign: "right", verticalAlign: "top", borderTop: "1px solid var(--border)" }}>{hourLabel(h)}</td>
                  {days.map((d) => {
                    const list = cells.get(`${d}|${h}`) ?? [];
                    return (
                      <td key={d} onClick={() => list.length === 0 && openBooking(d, h)} style={{ borderTop: "1px solid var(--border)", borderLeft: "1px solid var(--border)", padding: 3, verticalAlign: "top", height: 42, cursor: list.length === 0 ? "pointer" : "default", background: d === today ? "rgba(224,242,241,0.35)" : "transparent" }}>
                        {list.map((a) => {
                          const col = provColor(a.provider_id);
                          return (
                            <div key={a.id} style={{ ...statusStyle(a.status), background: col + "1a", borderLeft: `3px solid ${col}`, borderRadius: 6, padding: "3px 6px", marginBottom: 3 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.2 }}>
                                {a.clientName ? <Link href={`/clients/${a.client_id}`} style={{ color: "inherit", textDecoration: "none" }}>{a.clientName}</Link> : "—"}
                              </div>
                              <div style={{ fontSize: 10.5, color: "var(--muted)" }}>{a.title ?? a.type}{a.providerName ? ` · ${a.providerName}` : ""}</div>
                              <div style={{ marginTop: 2 }}>{statusMark(a.status)}</div>
                              <AppointmentActions id={a.id} status={a.status} date={a.date} hour={a.hour} />
                            </div>
                          );
                        })}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "tracker" && (
        <div>
          <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
            {([["Scheduled", counts.scheduled, "var(--blue-text)"], ["Completed", counts.completed, "var(--green-text)"], ["No-shows", counts.no_show, "var(--red-text)"], ["To book", visibleUnsched.length, "var(--amber-text)"]] as const).map(([k, v, c]) => (
              <div key={k} style={{ ...box, padding: "14px 18px", minWidth: 130 }}>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>{k}</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: c }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ ...box, padding: "14px 18px" }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Upcoming ({upcoming.length})</div>
            {upcoming.length === 0 ? <div style={{ color: "var(--muted)", fontSize: 13 }}>Nothing upcoming this week.</div> : upcoming.map((a) => (
              <div key={a.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 0", borderTop: "1px solid var(--border)", fontSize: 13 }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: provColor(a.provider_id) }} />
                <b style={{ minWidth: 120 }}>{fmtDate(a.date)} · {hourLabel(a.hour)}</b>
                <span style={{ flex: 1 }}>{a.clientName ?? "—"} <span style={{ color: "var(--muted)" }}>· {a.title ?? a.type} · {a.providerName ?? "any"}</span>{a.client_id && statusByClient[a.client_id] ? <span style={{ marginLeft: 6 }}><ClientStatusBadge status={statusByClient[a.client_id]} size="sm" /></span> : null}</span>
                <AppointmentActions id={a.id} status={a.status} date={a.date} hour={a.hour} />
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "unscheduled" && (() => {
        const dayDiff = (iso: string) => Math.round((Date.parse(iso + "T00:00:00Z") - Date.parse(today + "T00:00:00Z")) / 86400000);
        const upcoming2 = visibleUnsched.filter((u) => !u.due || dayDiff(u.due) >= 0).sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999"));
        const overdue2 = visibleUnsched.filter((u) => u.due && dayDiff(u.due) < 0).sort((a, b) => (a.due ?? "").localeCompare(b.due ?? ""));

        const cellH: React.CSSProperties = { padding: "9px 14px", textAlign: "left", color: "var(--muted)", fontSize: 10.5, fontWeight: 700, letterSpacing: ".4px", textTransform: "uppercase" };
        const cell: React.CSSProperties = { padding: "11px 14px", fontSize: 13, verticalAlign: "middle" };
        const bookBtn: React.CSSProperties = { background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" };
        const badge = (bg: string, fg: string, text: string) => <span style={{ background: bg, color: fg, borderRadius: 999, padding: "3px 10px", fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap" }}>{text}</span>;
        const dueBadge = (due: string | null) => {
          if (!due) return <span style={{ color: "var(--muted)" }}>—</span>;
          const d = dayDiff(due);
          if (d < 0) return badge("var(--red-bg)", "var(--red-text)", `${-d}d overdue`);
          if (d === 0) return badge("var(--amber-bg, #fef3c7)", "var(--amber-text, #92400e)", "Due today");
          return badge("var(--amber-bg, #fef3c7)", "var(--amber-text, #92400e)", `Due in ${d}d`);
        };
        const ownerPill = (name?: string | null) => name
          ? <span style={{ background: "var(--brand-tint)", color: "var(--brand-text)", borderRadius: 999, padding: "3px 10px", fontSize: 11.5, fontWeight: 600, whiteSpace: "nowrap" }}>{name}</span>
          : <span style={{ color: "var(--muted)" }}>Unassigned</span>;
        const header = (icon: string, title: string, count: number, tone: string) => (
          <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 8px" }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{icon ? `${icon} ` : ""}{title}</span>
            <span style={{ background: tone, color: "#fff", borderRadius: 999, minWidth: 20, height: 20, padding: "0 6px", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11.5, fontWeight: 700 }}>{count}</span>
          </div>
        );

        const unschedTable = (rows: Unsched[], overdue: boolean) => (
          <div style={{ ...box, overflow: "auto", marginBottom: 20 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 860 }}>
              <thead><tr style={{ background: "var(--neutral-bg, #fafafa)" }}>
                <th style={cellH}>Client</th><th style={cellH}>Owner</th><th style={cellH}>Service Type</th><th style={cellH}>Category</th>
                <th style={cellH}>{overdue ? "Was due" : "Due"}</th><th style={cellH}>{overdue ? "Overdue" : "Status"}</th><th style={cellH}>Action</th>
              </tr></thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ ...cell, fontWeight: 600 }}><Link href={`/clients/${u.clientId}`} style={{ color: "var(--ink)", textDecoration: "none" }}>{u.clientName}</Link></td>
                    <td style={cell}>{ownerPill(u.owner)}</td>
                    <td style={cell}>{u.label}</td>
                    <td style={{ ...cell, color: "var(--muted)" }}>{u.category ?? u.disc}</td>
                    <td style={cell}>{u.due ? fmtDate(u.due) : "Set on booking"}</td>
                    <td style={cell}>{dueBadge(u.due)}</td>
                    <td style={cell}><button type="button" onClick={() => bookUnsched(u)} style={bookBtn}>Book</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

        return (
          <div>
            {header("", "Upcoming", upcoming2.length, "var(--blue-text, #2563eb)")}
            {upcoming2.length ? unschedTable(upcoming2, false)
              : <div style={{ ...box, padding: "18px", textAlign: "center", color: "var(--muted)", fontSize: 13, marginBottom: 20 }}>Nothing upcoming</div>}

            {header("", "Due by Service Schedule", overdue2.length, "var(--red-text, #dc2626)")}
            {overdue2.length ? unschedTable(overdue2, true)
              : <div style={{ ...box, padding: "18px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>Nothing overdue</div>}
          </div>
        );
      })()}

      {(tab === "list" || tab === "records") && (
        <div style={{ ...box, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 720 }}>
            <thead>
              <tr style={{ color: "var(--muted)", fontSize: 12, textAlign: "left" }}>
                <th style={{ padding: "10px 14px" }}>Date</th><th style={{ padding: "10px 14px" }}>Time</th>
                <th style={{ padding: "10px 14px" }}>Patient</th><th style={{ padding: "10px 14px" }}>Type</th>
                <th style={{ padding: "10px 14px" }}>Provider</th><th style={{ padding: "10px 14px" }}>Status</th><th style={{ padding: "10px 14px" }} />
              </tr>
            </thead>
            <tbody>
              {(tab === "list" ? sorted : records).map((a) => (
                <tr key={a.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "10px 14px" }}>{fmtDate(a.date)}</td>
                  <td style={{ padding: "10px 14px" }}>{hourLabel(a.hour)}</td>
                  <td style={{ padding: "10px 14px" }}>{a.clientName ? <Link href={`/clients/${a.client_id}`} style={{ color: "var(--brand-text)", textDecoration: "none", fontWeight: 600 }}>{a.clientName}</Link> : "—"}{a.client_id && statusByClient[a.client_id] ? <div style={{ marginTop: 3 }}><ClientStatusBadge status={statusByClient[a.client_id]} size="sm" /></div> : null}</td>
                  <td style={{ padding: "10px 14px" }}>{a.title ?? a.type ?? "—"}</td>
                  <td style={{ padding: "10px 14px" }}><span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: "50%", background: provColor(a.provider_id) }} />{a.providerName ?? "—"}</span></td>
                  <td style={{ padding: "10px 14px" }}>{statusChip(a.status)}</td>
                  <td style={{ padding: "10px 14px", textAlign: "right" }}><AppointmentActions id={a.id} status={a.status} date={a.date} hour={a.hour} /></td>
                </tr>
              ))}
              {(tab === "list" ? sorted : records).length === 0 && (
                <tr><td colSpan={7} style={{ padding: "24px 14px", textAlign: "center", color: "var(--muted)" }}>No appointments</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const input: React.CSSProperties = { padding: "0 10px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, background: "#fff", width: "100%" , height: 36, boxSizing: "border-box" };
const lbl: React.CSSProperties = { fontSize: 10, color: "var(--muted)" };
