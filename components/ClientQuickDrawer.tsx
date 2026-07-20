"use client";

// The front desk's console. Slides in over the Clients list so a walk-in or
// phone call can be handled end to end without losing your place in the list —
// which matters at 998 rows. Mirrors the prototype's openDrawer().

import { useEffect, useState } from "react";
import Link from "next/link";
import { getClientQuickView, type ClientQuickView } from "@/lib/actions";
import { ageFromDob } from "@/lib/dob";
import { band, BP_SCORES } from "@/lib/blueprint";

const money = (n: number) => "₹" + Math.round(Number(n || 0)).toLocaleString("en-IN");
const hh = (h: number | null) => {
  if (h == null) return "—";
  const am = h < 12, x = h % 12 === 0 ? 12 : h % 12;
  return `${x}:00 ${am ? "AM" : "PM"}`;
};

type Tone = { bg: string; color: string };
const GREY: Tone = { bg: "#eef2f1", color: "var(--muted)" };
const GREEN: Tone = { bg: "var(--green-bg)", color: "#166534" };
const RED: Tone = { bg: "var(--red-bg)", color: "#991b1b" };
const AMBER: Tone = { bg: "var(--amber-bg)", color: "#92400e" };
const TEAL: Tone = { bg: "#e0f2f1", color: "var(--teal-dark)" };
const chip = (label: string, t: Tone) => (
  <span key={label} style={{ background: t.bg, color: t.color, borderRadius: 999, padding: "3px 10px", fontSize: 11.5, fontWeight: 600 }}>{label}</span>
);

/** Supabase types embedded relations as arrays; collapse to the single row. */
const rel = (v: unknown): { name?: string; role?: string } =>
  (Array.isArray(v) ? v[0] : v) ?? {};

const panel: React.CSSProperties = {
  background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 12,
  padding: "13px 15px", marginBottom: 14,
};
const secTitle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, letterSpacing: ".6px", textTransform: "uppercase",
  color: "var(--muted)", margin: "16px 0 7px",
};
const row: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 10, padding: "8px 0",
  borderTop: "1px solid var(--border)", fontSize: 12.5,
};
const empty = (t: string) => <div style={{ color: "var(--muted)", fontSize: 12.5, padding: "8px 0" }}>{t}</div>;
const btn: React.CSSProperties = {
  border: "1px solid var(--border)", background: "#fff", borderRadius: 9,
  padding: "8px 13px", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
  textDecoration: "none", color: "var(--ink)", whiteSpace: "nowrap",
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".5px" }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, marginTop: 1 }}>{value}</div>
    </div>
  );
}

export default function ClientQuickDrawer({ clientId, onClose }: { clientId: string; onClose: () => void }) {
  const [data, setData] = useState<ClientQuickView | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let live = true;
    getClientQuickView(clientId).then((d) => { if (live) { if (d) setData(d as ClientQuickView); else setErr(true); } });
    return () => { live = false; };
  }, [clientId]);

  // Escape closes; lock the page behind so the list doesn't scroll under it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const c = data?.client;
  const pkg = data?.pkg;
  const credits = pkg?.sessions ?? 0;
  const used = Number(c?.used ?? 0);
  const pct = credits ? Math.min(100, Math.round((used / credits) * 100)) : 0;
  const active = data?.clientPackages?.find((p) => p.status === "active");

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, background: "rgba(15,15,20,0.35)",
        display: "flex", justifyContent: "flex-end", zIndex: 90,
      }}
    >
      <aside
        role="dialog"
        aria-label="Client quick view"
        style={{
          width: 460, maxWidth: "94vw", height: "100%", overflowY: "auto",
          background: "var(--card)", padding: "18px 20px 28px",
          boxShadow: "-8px 0 32px rgba(15,15,20,0.16)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
          <button type="button" onClick={onClose} style={{ ...btn, border: "none", background: "transparent", color: "var(--muted)" }}>✕ Close</button>
        </div>

        {err && <div style={{ color: "var(--muted)", fontSize: 13 }}>Couldn&apos;t load this client.</div>}
        {!data && !err && <div style={{ color: "var(--muted)", fontSize: 13, padding: "20px 0" }}>Loading…</div>}

        {data && c && (
          <>
            {/* identity */}
            <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 12 }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--teal)", color: "#fff", display: "grid", placeItems: "center", fontSize: 17, fontWeight: 700 }}>
                {String(c.name).split(" ").map((w: string) => w[0]).slice(0, 2).join("")}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{c.name}</div>
                <div style={{ color: "var(--muted)", fontSize: 12.5 }}>
                  {c.phone ?? "no phone"}{c.email ? ` · ${c.email}` : ""}
                </div>
              </div>
            </div>

            {/* chips */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
              {chip(c.code ?? "—", GREY)}
              {chip(c.verified ? "Verified ✓" : "Unverified", c.verified ? GREEN : AMBER)}
              {pkg && chip(pkg.name, TEAL)}
              {pkg?.is_facility
                ? chip("Facility access", GREY)
                : data.enrolment && chip(`${hh(data.enrolment.hour)} · ${rel(data.enrolment.staff).name ?? "—"}`, TEAL)}
              {c.joined && chip(`Joined ${c.joined}`, GREY)}
              {c.branch && chip(c.branch, GREY)}
              {chip(`T&C ${c.consent_tnc ? "✓" : "missing"}`, c.consent_tnc ? GREEN : RED)}
              {chip(`Waiver ${c.consent_waiver ? "✓" : "missing"}`, c.consent_waiver ? GREEN : RED)}
            </div>

            {/* session credits */}
            <div style={panel}>
              <b style={{ fontSize: 13 }}>Session credits</b>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                <div style={{ flex: 1, background: "#eef2f1", borderRadius: 6, height: 8, overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: "var(--teal)" }} />
                </div>
                <b style={{ fontSize: 13, whiteSpace: "nowrap" }}>{used} / {credits || "—"}</b>
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6, lineHeight: 1.7 }}>
                {data.assignments.length > 0 && (
                  <>Care team: {data.assignments.map((a) => rel(a.staff).name).filter(Boolean).join(", ")}<br /></>
                )}
                {pkg && <>Valid {pkg.validity} days{active?.end_date ? ` · ends ${active.end_date}` : ""}<br /></>}
                {data.enrolment && <>Slot: <b style={{ color: "var(--ink)" }}>{hh(data.enrolment.hour)} with {rel(data.enrolment.staff).name ?? "—"}</b>{data.sessions.next ? ` · next ${data.sessions.next.date}` : ""}</>}
              </div>
            </div>

            {/* blueprint */}
            {(data.blueprint || data.blood) && (
              <div style={panel}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <b style={{ fontSize: 13 }}>BluePrint</b>
                  <span style={{ flex: 1 }} />
                  {chip(data.blueprint?.generated ? "Generated" : data.blood?.submitted ? "Blood in" : "Not started",
                    data.blueprint?.generated ? GREEN : data.blood?.submitted ? AMBER : GREY)}
                </div>
                {data.blueprint?.scores && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginTop: 10 }}>
                    {BP_SCORES.slice(0, 6).map((s) => {
                      const v = (data.blueprint!.scores as Record<string, number>)[s.key];
                      const b = band(v);
                      return (
                        <div key={s.key} style={{ background: b.bg, borderRadius: 8, padding: "6px 8px" }}>
                          <div style={{ fontSize: 10, color: b.color }}>{s.label}</div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: b.color }}>{v ?? "—"}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* health profile */}
            <div style={panel}>
              <b style={{ fontSize: 13 }}>Health profile</b>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 10 }}>
                <Stat label="Age" value={ageFromDob(c.dob) ? `${ageFromDob(c.dob)} yrs` : "—"} />
                <Stat label="Gender" value={c.gender ?? "—"} />
                <Stat label="Occupation" value={c.occupation ?? "—"} />
                <Stat label="Height" value={c.height ? `${c.height} cm` : "—"} />
                <Stat label="Weight" value={data.measurement?.weight ? `${data.measurement.weight} kg` : c.weight ? `${c.weight} kg` : "—"} />
                <Stat label="BMI" value={data.measurement?.bmi ? String(data.measurement.bmi) : "—"} />
              </div>
              {(c.goals ?? []).length > 0 && (
                <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {(c.goals as string[]).map((g) => chip(g, TEAL))}
                </div>
              )}
              {c.conditions && c.conditions !== "None" && (
                <div style={{ marginTop: 7, display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {String(c.conditions).split(",").map((x: string) => chip(x.trim(), AMBER))}
                </div>
              )}
              <div style={{ marginTop: 11, fontSize: 12, color: "var(--muted)", lineHeight: 1.8 }}>
                {c.address ?? "No address"}<br />
                Emergency: <b style={{ color: "var(--ink)" }}>{c.emergency ?? "—"}</b>
              </div>
            </div>

            {/* appointments */}
            <div style={secTitle}>Appointments</div>
            {data.appointments.length ? data.appointments.map((a) => (
              <div key={a.id} style={row}>
                <span style={{ color: "var(--muted)", minWidth: 78 }}>{a.date}</span>
                <span style={{ flex: 1, minWidth: 0 }}>{a.type ?? "Appointment"}<span style={{ color: "var(--muted)" }}> · {rel(a.staff).name ?? "—"}</span></span>
                {chip(a.status, a.status === "completed" ? GREY : TEAL)}
              </div>
            )) : empty("No appointments")}

            {/* invoices */}
            <div style={secTitle}>Invoices</div>
            {data.invoices.length ? data.invoices.map((i) => (
              <div key={i.id} style={row}>
                <span style={{ color: "var(--muted)", minWidth: 62 }}>INV-{String(i.num ?? 0).padStart(3, "0")}</span>
                <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{i.description}</span>
                <b>{money(i.amount)}</b>
                {chip(i.status, i.status === "Paid" ? GREEN : AMBER)}
              </div>
            )) : empty("No invoices")}

            {/* assessments */}
            <div style={secTitle}>Assessments</div>
            {data.assessments.length ? data.assessments.map((a) => (
              <div key={a.id} style={row}>
                <span style={{ flex: 1 }}>{a.kind}<span style={{ color: "var(--muted)" }}> · due {a.due_date}</span></span>
                {chip(a.status, a.status === "done" ? GREEN : AMBER)}
              </div>
            )) : empty("No assessments yet")}

            {/* documents */}
            <div style={secTitle}>Documents</div>
            {data.files.length ? data.files.map((f) => (
              <div key={f.id} style={row}>
                <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.name ?? "Untitled"}</span>
                <span style={{ color: "var(--muted)" }}>{f.kind}</span>
              </div>
            )) : empty("No documents")}

            {/* actions */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 22, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
              <Link href={`/clients/${clientId}`} style={{ ...btn, background: "var(--ink)", color: "#fff", border: "none", flex: 1, textAlign: "center" }}>Open 360°</Link>
              {data.canWrite && <Link href={`/appointments?client=${clientId}`} style={btn}>Book</Link>}
              {data.canBill && <Link href={`/clients/${clientId}?tab=card`} style={btn}>Invoice</Link>}
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
