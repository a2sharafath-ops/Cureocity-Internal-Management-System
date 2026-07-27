import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canSee } from "@/lib/roles";
import { packageCategory } from "@/lib/packages";
import { disciplinesForCategory } from "@/lib/assignment";
import { onboardingRow, CATEGORY_LABEL, type ClientInput, type ConsultState } from "@/lib/onboarding";
import { cancelBooking, repairClientJourney } from "@/lib/actions";
import RealtimeRefresh from "@/components/RealtimeRefresh";

const DISC_LABEL: Record<string, string> = {
  doctor: "Doctor", dietitian: "Dietitian", trainer: "Trainer", coach: "Coach", psychologist: "Psychologist",
};

export const dynamic = "force-dynamic";

const PRIORITY = ["blueprint", "comprehensive", "training", "membership"];
const CATS = ["blueprint", "comprehensive", "training", "membership"] as const;

export default async function OnboardingPage({ searchParams }: { searchParams: { cat?: string; done?: string } }) {
  const me = await getProfile();
  if (!me || !canSee(me.role, "/onboarding")) redirect("/dashboard");

  const supabase = createClient();
  const [{ data: clientsD }, { data: pkgsD }, { data: cpsD }, { data: invD }, { data: bloodD }, { data: bpD }, { data: consultD }, { data: sessD }, { data: staffD }, { data: apptD }, { data: assignD }] =
    await Promise.all([
      supabase.from("clients").select("id, name, package_id, pro_id, joined").limit(5000),
      supabase.from("packages").select("id, name, is_facility"),
      supabase.from("client_packages").select("client_id, category, package_name, status").eq("status", "active"),
      supabase.from("invoices").select("client_id"),
      supabase.from("blood_requests").select("client_id, submitted"),
      supabase.from("blueprints").select("client_id, generated"),
      supabase.from("consultations").select("client_id, kind, status"),
      supabase.from("sessions").select("client_id, status").eq("status", "scheduled"),
      supabase.from("staff").select("id, name, role"),
      supabase.from("appointments").select("id, client_id, provider_id, status").neq("status", "cancelled"),
      supabase.from("client_assignments").select("client_id, discipline, staff_id"),
    ]);

  const pkgById = new Map(((pkgsD ?? []) as { id: string; name: string; is_facility: boolean }[]).map((p) => [p.id, p]));
  const staffName = new Map(((staffD ?? []) as { id: string; name: string; role: string }[]).map((s) => [s.id, s.name]));
  const staffRole = new Map(((staffD ?? []) as { id: string; name: string; role: string }[]).map((s) => [s.id, s.role]));
  const hasInvoice = new Set(((invD ?? []) as { client_id: string | null }[]).map((r) => r.client_id).filter(Boolean) as string[]);
  const blood = new Map<string, { submitted: boolean }>();
  for (const b of (bloodD ?? []) as { client_id: string; submitted: boolean }[]) blood.set(b.client_id, { submitted: Boolean(b.submitted) });
  const bpGen = new Set(((bpD ?? []) as { client_id: string; generated: boolean }[]).filter((b) => b.generated).map((b) => b.client_id));
  const sessSched = new Set(((sessD ?? []) as { client_id: string | null }[]).map((s) => s.client_id).filter(Boolean) as string[]);

  // categories + package name per client (from client_packages)
  const catsByClient = new Map<string, string[]>();
  const cpNameByCat = new Map<string, string>();   // key: `${clientId}|${cat}`
  for (const cp of (cpsD ?? []) as { client_id: string; category: string; package_name: string | null }[]) {
    (catsByClient.get(cp.client_id) ?? catsByClient.set(cp.client_id, []).get(cp.client_id)!).push(cp.category);
    if (cp.package_name) cpNameByCat.set(`${cp.client_id}|${cp.category}`, cp.package_name);
  }

  // consultation state per client per kind
  const consult = new Map<string, Record<string, ConsultState>>();
  for (const c of (consultD ?? []) as { client_id: string; kind: string; status: string }[]) {
    const rec = consult.get(c.client_id) ?? {};
    const cur = rec[c.kind] ?? { scheduled: false, completed: false };
    rec[c.kind] = { scheduled: true, completed: cur.completed || c.status === "completed" };
    consult.set(c.client_id, rec);
  }
  const cs = (clientId: string, kind: string): ConsultState => consult.get(clientId)?.[kind] ?? { scheduled: false, completed: false };

  // non-cancelled appointments per client (for booked/done state + cancel)
  const apptsByClient = new Map<string, { id: string; provider_id: string | null; status: string }[]>();
  for (const a of (apptD ?? []) as { id: string; client_id: string | null; provider_id: string | null; status: string }[]) {
    if (!a.client_id) continue;
    (apptsByClient.get(a.client_id) ?? apptsByClient.set(a.client_id, []).get(a.client_id)!).push({ id: a.id, provider_id: a.provider_id, status: a.status });
  }
  // care-team assignments per client: discipline -> staff_id
  const assignByClient = new Map<string, Record<string, string>>();
  for (const r of (assignD ?? []) as { client_id: string; discipline: string; staff_id: string | null }[]) {
    if (!r.staff_id) continue;
    const rec = assignByClient.get(r.client_id) ?? {};
    rec[r.discipline] = r.staff_id;
    assignByClient.set(r.client_id, rec);
  }
  // A consultation is "booked" when there's a scheduled appointment with a
  // provider of the RIGHT DISCIPLINE — any Fitness Trainer counts for the
  // fitness assessment, not only the rotation-assigned one. We surface who they
  // are actually booked with (falling back to the care-team assignment).
  const KIND_ROLE: Record<string, string> = { Doctor: "Doctor", Diet: "Dietitian", Trainer: "Fitness Trainer" };
  const csFull = (clientId: string, kind: string, disc: string): ConsultState => {
    const base = consult.get(clientId)?.[kind] ?? { scheduled: false, completed: false };
    const role = KIND_ROLE[kind];
    const mine = (apptsByClient.get(clientId) ?? []).filter((a) => a.provider_id && staffRole.get(a.provider_id) === role);
    // A completed appointment of the discipline means the consult is done, even
    // when it never became a `consultations` row (e.g. a fitness assessment
    // marked ✓ on the calendar).
    const completedAppt = mine.find((a) => a.status === "completed") ?? null;
    const scheduledAppt = mine.find((a) => a.status === "scheduled") ?? null;
    const match = scheduledAppt ?? completedAppt;
    const assignedStaffId = assignByClient.get(clientId)?.[disc] ?? null;
    const providerName = match?.provider_id ? (staffName.get(match.provider_id) ?? null) : null;
    return {
      scheduled: base.scheduled || Boolean(scheduledAppt),
      completed: base.completed || Boolean(completedAppt),
      assignedName: providerName ?? (assignedStaffId ? (staffName.get(assignedStaffId) ?? null) : null),
      apptId: scheduledAppt?.id ?? null,
    };
  };

  const rows = ((clientsD ?? []) as { id: string; name: string; package_id: string | null; pro_id: string | null; joined: string | null }[])
    .map((c) => {
      const cats = catsByClient.get(c.id) ?? [];
      const legacyCat = c.package_id ? packageCategory(c.package_id, pkgById.get(c.package_id)?.is_facility ?? false) : "other";
      const category = PRIORITY.find((p) => cats.includes(p)) ?? (PRIORITY.includes(legacyCat) ? legacyCat : cats[0] ?? legacyCat);
      if (!PRIORITY.includes(category)) return null;   // only journey/membership packages
      const packageName = cpNameByCat.get(`${c.id}|${category}`) ?? pkgById.get(c.package_id ?? "")?.name ?? "—";
      const bl = blood.get(c.id);
      // The FULL care team the package calls for — assigned clinicians shown by
      // name, unfilled slots shown as placeholders so the whole team is visible.
      const assignedMap = assignByClient.get(c.id) ?? {};
      const scope = disciplinesForCategory(category);
      const assignments = (scope.length ? scope : Object.keys(assignedMap))
        .map((discipline) => {
          const sid = assignedMap[discipline];
          return { discipline, name: sid ? (staffName.get(sid) ?? sid) : null };
        });
      const input: ClientInput = {
        clientId: c.id, clientName: c.name, category, packageName,
        ownerName: c.pro_id ? (staffName.get(String(c.pro_id)) ?? null) : null,
        assignments,
        hasInvoice: hasInvoice.has(c.id),
        bloodRequested: Boolean(bl), bloodSubmitted: Boolean(bl?.submitted),
        doctor: csFull(c.id, "Doctor", "doctor"), diet: csFull(c.id, "Diet", "dietitian"), trainer: csFull(c.id, "Trainer", "trainer"),
        blueprintGenerated: bpGen.has(c.id),
        sessionScheduled: sessSched.has(c.id),
      };
      return onboardingRow(input);
    })
    .filter((r): r is NonNullable<typeof r> => Boolean(r));

  const showDone = searchParams.done === "1";
  const catFilter = (CATS as readonly string[]).includes(searchParams.cat ?? "") ? searchParams.cat! : null;
  const filtered = rows
    .filter((r) => (showDone ? true : !r.complete))
    .filter((r) => (!catFilter || r.category === catFilter))
    .sort((a, b) => (a.complete === b.complete ? a.doneCount / a.total - b.doneCount / b.total : a.complete ? 1 : -1));

  const inProgress = rows.filter((r) => !r.complete).length;

  const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
  const th: React.CSSProperties = { padding: "11px 16px", textAlign: "left", color: "var(--muted)", fontSize: 10.5, fontWeight: 700, letterSpacing: ".5px", textTransform: "uppercase" };
  const td: React.CSSProperties = { padding: "14px 16px", fontSize: 13.5, verticalAlign: "top" };
  const chip = (active: boolean): React.CSSProperties => ({ padding: "5px 12px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, textDecoration: "none", border: "1px solid var(--border)", background: active ? "var(--brand-fill)" : "#fff", color: active ? "#fff" : "var(--muted)" });
  const btn = (emphasis: boolean, color: string): React.CSSProperties => ({ display: "inline-block", border: "1px solid var(--border)", background: emphasis ? "var(--brand-tint)" : "#fff", borderRadius: 8, padding: "4px 11px", fontSize: 11.5, fontWeight: 600, textDecoration: "none", color, whiteSpace: "nowrap", lineHeight: 1.3 });
  const catHref = (c: string | null) => { const p = new URLSearchParams(); if (c) p.set("cat", c); if (showDone) p.set("done", "1"); const s = p.toString(); return s ? `/onboarding?${s}` : "/onboarding"; };

  return (
    <div style={{ maxWidth: 1180 }}>
      <RealtimeRefresh tables={["clients", "consultations", "blood_requests", "blueprints", "invoices", "sessions", "appointments", "client_packages", "client_assignments"]} />
      <h1 style={{ fontSize: 20, margin: "0 0 2px" }}>Onboarding</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "6px 0 14px" }}>
        Every client mid-onboarding, by package — where each one is and the next action. {inProgress} in progress.
      </p>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
        <Link href={catHref(null)} style={chip(!catFilter)}>All</Link>
        {CATS.map((c) => <Link key={c} href={catHref(c)} style={chip(catFilter === c)}>{CATEGORY_LABEL[c]}</Link>)}
        <span style={{ flex: 1 }} />
        <Link href={showDone ? catHref(catFilter) : `/onboarding?${new URLSearchParams({ ...(catFilter ? { cat: catFilter } : {}), done: "1" }).toString()}`}
          style={{ ...chip(showDone), color: showDone ? "#fff" : "var(--brand-text)" }}>
          {showDone ? "Hide completed" : "Show completed"}
        </Link>
      </div>

      <div style={{ ...box, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 920, tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: 150 }} />
            <col style={{ width: 108 }} />
            <col style={{ width: 132 }} />
            <col />
            <col style={{ width: 172 }} />
          </colgroup>
          <thead>
            <tr style={{ background: "var(--neutral-bg, #fafafa)" }}>
              <th style={th}>Client</th><th style={th}>Package</th><th style={th}>Progress</th>
              <th style={th}>Steps — done ✓ · pending ○</th><th style={th}>Assigned</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.clientId} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ ...td, fontWeight: 600, verticalAlign: "top" }}><Link href={`/clients/${r.clientId}`} style={{ color: "var(--ink)", textDecoration: "none" }}>{r.clientName}</Link></td>
                <td style={{ ...td, verticalAlign: "top" }}><span style={{ background: "var(--brand-tint)", color: "var(--brand-text)", borderRadius: 999, padding: "2px 9px", fontSize: 11, fontWeight: 700 }}>{CATEGORY_LABEL[r.category]}</span></td>
                <td style={td}>
                  <div style={{ display: "grid", gap: 5 }}>
                    <div style={{ width: "100%", height: 7, borderRadius: 999, background: "var(--neutral-bg)", overflow: "hidden" }}>
                      <div style={{ width: `${Math.round((r.doneCount / r.total) * 100)}%`, height: "100%", background: r.complete ? "var(--green-text)" : "var(--brand-fill)" }} />
                    </div>
                    <span style={{ color: "var(--muted)", fontSize: 11.5 }}>{r.doneCount} of {r.total} done</span>
                  </div>
                </td>
                <td style={td}>
                  {r.complete ? (
                    <span style={{ color: "var(--green-text)", fontWeight: 600 }}>✓ Onboarded</span>
                  ) : (
                    <div style={{ display: "grid", gap: 7 }}>
                      {r.steps.map((s, i) => {
                        const isNext = !s.done && i === r.steps.findIndex((x) => !x.done);
                        return (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                            <span style={{ width: 14, flexShrink: 0, textAlign: "center", color: s.done ? "var(--green-text)" : "var(--muted)", fontSize: 12 }}>{s.done ? "✓" : "○"}</span>
                            <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, lineHeight: 1.35, color: s.done ? "var(--muted)" : "var(--ink)", fontWeight: isNext ? 600 : 400, textDecoration: s.done ? "line-through" : "none" }}>{s.label}</span>
                            <div style={{ display: "flex", gap: 6, flexShrink: 0, marginLeft: "auto" }}>
                              {!s.done && s.action && (
                                <Link href={s.action.href} style={btn(isNext, "var(--brand-text)")}>{s.action.cta} →</Link>
                              )}
                              {!s.done && s.repairClientId && (
                                <form action={repairClientJourney} style={{ margin: 0 }}>
                                  <input type="hidden" name="client_id" value={s.repairClientId} />
                                  <button type="submit" title="Seed the missing journey items for this client" style={{ ...btn(isNext, "var(--brand-text)"), cursor: "pointer" }}>Repair →</button>
                                </form>
                              )}
                              {!s.done && s.cancelApptId && (
                                <form action={cancelBooking} style={{ margin: 0 }}>
                                  <input type="hidden" name="appt_id" value={s.cancelApptId} />
                                  <button type="submit" title="Cancel this booking" style={{ ...btn(false, "var(--danger-text, #b42318)"), cursor: "pointer" }}>Cancel</button>
                                </form>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </td>
                <td style={td}>
                  {r.assignments.length ? (
                    <div style={{ display: "grid", gap: 6 }}>
                      {r.assignments.map((a, i) => {
                        const bookingLed = ["doctor", "dietitian", "psychologist"].includes(a.discipline);
                        return (
                          <div key={i} style={{ fontSize: 12, lineHeight: 1.3 }}>
                            <span style={{ color: "var(--muted)", fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".3px" }}>{DISC_LABEL[a.discipline] ?? a.discipline}</span>
                            <div style={{ color: a.name ? "var(--ink)" : "var(--muted)", fontWeight: a.name ? 500 : 400, fontStyle: a.name ? "normal" : "italic" }}>
                              {a.name ?? (bookingLed ? "book to assign" : "unassigned")}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : <span style={{ color: "var(--muted)" }}>—</span>}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={5} style={{ ...td, textAlign: "center", color: "var(--muted)", padding: "24px 14px" }}>Nobody is mid-onboarding here.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
