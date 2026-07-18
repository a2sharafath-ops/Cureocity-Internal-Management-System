import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile, getViewRole } from "@/lib/auth";
import { canSee } from "@/lib/roles";
import { getPersona } from "@/lib/personas";
import { todayISO, todayLabel } from "@/lib/today";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import SegTabs from "@/components/SegTabs";
import StatCard from "@/components/StatCard";
import WorkspaceClients, { type WsClientRow } from "@/components/WorkspaceClients";
import ConcernsPanel, { type ConcernRow } from "@/components/ConcernsPanel";
import MdtBoard, { type MdtRow } from "@/components/MdtBoard";
import {
  WS_ROLES, WS_TABS, wsRole, roleFromPersonaKind, scopeClients, type WsClient, type WsRoleKey,
} from "@/lib/workspaces";

export const dynamic = "force-dynamic";

type ClientRow = WsClient & { packages: { name: string } | null };

export default async function WorkspacePage({ searchParams }: { searchParams: { role?: string; tab?: string } }) {
  const me = await getProfile();
  if (!me || !canSee(me.role, "/workspace")) redirect("/dashboard");

  // Resolve active role: ?role → persona → default.
  const { profession } = await getViewRole();
  const roleKey: WsRoleKey =
    (WS_ROLES.find((r) => r.key === searchParams.role)?.key)
    ?? roleFromPersonaKind(getPersona(profession)?.kind)
    ?? "doctor";
  const role = wsRole(roleKey);
  const tabs = WS_TABS[roleKey];

  // Resolve active tab — only in-workspace tabs (live or stub) are selectable here.
  const inWs = tabs.filter((t) => !t.href);
  const tab = inWs.find((t) => t.key === searchParams.tab) ? searchParams.tab! : "dash";

  const supabase = createClient();
  const today = todayISO();
  const isTrainer = roleKey === "trainer";

  const [{ data: clientData }, { data: enrollData }, { count: pendingSummaries }, todayRes, { data: concernData }, { data: mdtData }] = await Promise.all([
    supabase.from("clients").select("id, name, code, package_id, pro_id, conditions, goals, packages(name)").order("name"),
    supabase.from("enrollments").select("client_id"),
    supabase.from("consultations").select("id", { count: "exact", head: true }).eq("kind", role.kind).eq("approved", false),
    isTrainer
      ? supabase.from("sessions").select("id, hour, status, clients(name)").eq("date", today).order("hour")
      : supabase.from("appointments").select("id, hour, type, title, status, clients(name)").eq("date", today).eq("status", "scheduled").order("hour"),
    supabase.from("concerns").select("id, client_id, category, body, raised_by, status, created_at, clients(name)").in("role", [roleKey, "general"]).order("created_at", { ascending: false }),
    supabase.from("mdt_notes").select("id, client_id, author, body, escalated, to_role, status, created_at, clients(name)").order("created_at", { ascending: false }).limit(60),
  ]);

  const allClients = (clientData ?? []) as unknown as ClientRow[];
  const trainingIds = new Set(((enrollData ?? []) as { client_id: string }[]).map((e) => e.client_id));
  const scoped = scopeClients(roleKey, allClients, trainingIds);
  const rosterRows: WsClientRow[] = scoped.map((c) => ({
    id: c.id, name: c.name, code: c.code,
    pkg: (c as ClientRow).packages?.name ?? c.package_id,
    conditions: c.conditions, goals: c.goals ?? [],
  }));

  const todayList = (todayRes.data ?? []) as unknown as { id: string; hour: number | null; type?: string; title?: string | null; status?: string; clients: { name: string } | null }[];

  type CJoin = { clients: { name: string } | null };
  const concerns: ConcernRow[] = ((concernData ?? []) as unknown as (ConcernRow & CJoin)[]).map((r) => ({
    id: r.id, client_id: r.client_id, client_name: r.clients?.name ?? null,
    category: r.category, body: r.body, raised_by: r.raised_by, status: r.status, created_at: r.created_at,
  }));
  const mdtNotes: MdtRow[] = ((mdtData ?? []) as unknown as (MdtRow & CJoin)[]).map((r) => ({
    id: r.id, client_id: r.client_id, client_name: r.clients?.name ?? null,
    author: r.author, body: r.body, escalated: r.escalated, to_role: r.to_role, status: r.status, created_at: r.created_at,
  }));
  const openConcerns = concerns.filter((c) => c.status === "Open").length;
  const clientOpts = allClients.map((c) => ({ id: c.id, name: c.name }));

  const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
  const fmtHour = (h: number | null) => {
    if (h == null) return "—";
    const am = h < 12, hr = h % 12 === 0 ? 12 : h % 12;
    return `${hr}:00 ${am ? "AM" : "PM"}`;
  };

  // Tab bar — live/stub tabs stay in the workspace, href tabs bridge to existing pages.
  const tabItems = tabs.map((t) => ({ key: t.key, label: t.label, href: t.href ?? `/workspace?role=${roleKey}&tab=${t.key}` }));
  const stubDef = tabs.find((t) => t.key === tab && !t.live && !t.href);

  return (
    <div style={{ maxWidth: 1160 }}>
      <RealtimeRefresh tables={["consultations", "appointments", "sessions", "clients", "concerns", "mdt_notes"]} />

      {/* Workspace chrome: role switcher */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: role.color, color: "#fff", display: "grid", placeItems: "center", fontSize: 20 }}>{role.icon}</div>
        <div>
          <h1 style={{ fontSize: 20, margin: 0 }}>{role.label}</h1>
          <p style={{ color: "var(--muted)", fontSize: 12.5, margin: 0 }}>Your clients, consultations, blueprint sign-off and role tools in one place</p>
        </div>
        <span style={{ flex: 1 }} />
        <div style={{ display: "inline-flex", gap: 4, padding: 4, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 12, flexWrap: "wrap" }}>
          {WS_ROLES.map((r) => {
            const on = r.key === roleKey;
            return (
              <Link key={r.key} href={`/workspace?role=${r.key}`} style={{
                display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 11px", borderRadius: 9, fontSize: 12.5, fontWeight: 600,
                textDecoration: "none", background: on ? "var(--card)" : "transparent", color: on ? "var(--ink)" : "var(--muted)",
                boxShadow: on ? "var(--shadow)" : "none",
              }}>{r.icon} {r.short}</Link>
            );
          })}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ marginBottom: 16 }}>
        <SegTabs active={tab} items={tabItems} />
      </div>

      {/* ---- DASHBOARD ---- */}
      {tab === "dash" && (
        <>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
            <StatCard label="My clients" value={scoped.length} />
            <StatCard label={isTrainer ? "Sessions today" : "Appointments today"} value={todayList.length} />
            <StatCard label="Pending summaries" value={pendingSummaries ?? 0} color="#b45309" />
            <StatCard label="Client concerns" value={openConcerns} color={openConcerns ? "#b45309" : undefined} />
            <StatCard label="MDT updates" value={mdtNotes.length} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16, alignItems: "start" }}>
            <div style={{ ...box, overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", fontWeight: 700 }}>📅 Today — {todayLabel()}</div>
              {todayList.length ? todayList.map((a) => (
                <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 16px", borderTop: "1px solid var(--border)" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <b style={{ fontSize: 13 }}>{a.clients?.name ?? "—"}</b>
                    <div style={{ color: "var(--muted)", fontSize: 12 }}>{a.title || a.type || (isTrainer ? "Training session" : "Consultation")}</div>
                  </div>
                  <b style={{ fontSize: 13 }}>{fmtHour(a.hour)}</b>
                </div>
              )) : <div style={{ padding: "18px 16px", color: "var(--muted)", fontSize: 13, borderTop: "1px solid var(--border)" }}>Nothing scheduled today.</div>}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ ...box, padding: "14px 16px" }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>⚡ Quick actions</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <Link href="/pro" style={qa}>📝 Consultations</Link>
                  <Link href="/appointments" style={qa}>📅 Appointments</Link>
                  <Link href="/blueprint" style={qa}>🧬 BluePrint</Link>
                  {roleKey === "diet" && <Link href="/meals" style={qa}>🍽️ Meal follow-ups</Link>}
                  {roleKey === "trainer" && <Link href="/trainer" style={qa}>🎽 Session board</Link>}
                  {roleKey === "coach" && <Link href="/followups" style={qa}>📞 Follow-ups</Link>}
                  {roleKey === "doctor" && <Link href="/emr" style={qa}>🩺 Patient records</Link>}
                </div>
              </div>
              <div style={{ ...box, padding: "14px 16px" }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>My clients <span style={{ color: "var(--muted)", fontWeight: 500 }}>· {scoped.length}</span></div>
                {scoped.slice(0, 5).map((c) => (
                  <div key={c.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13, borderTop: "1px solid var(--border)" }}>
                    <span>{c.name}</span>
                    <Link href={`/clients/${c.id}`} style={{ color: "var(--teal-dark)", textDecoration: "none", fontSize: 12 }}>Open →</Link>
                  </div>
                ))}
                <Link href={`/workspace?role=${roleKey}&tab=clients`} style={{ display: "inline-block", marginTop: 8, color: "var(--teal-dark)", textDecoration: "none", fontSize: 12.5, fontWeight: 600 }}>View all clients →</Link>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ---- MY CLIENTS ---- */}
      {tab === "clients" && <WorkspaceClients role={roleKey} color={role.color} clients={rosterRows} />}

      {/* ---- CONCERNS ---- */}
      {tab === "concerns" && <ConcernsPanel concerns={concerns} />}

      {/* ---- MDT BOARD ---- */}
      {tab === "board" && <MdtBoard notes={mdtNotes} clients={clientOpts} />}

      {/* ---- STUB TABS (later phases) ---- */}
      {stubDef && (
        <div style={{ ...box, padding: "40px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 30, marginBottom: 8 }}>🚧</div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{stubDef.label}</div>
          <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 6, maxWidth: 420, marginLeft: "auto", marginRight: "auto" }}>{stubDef.note}</div>
        </div>
      )}
    </div>
  );
}

const qa: React.CSSProperties = { border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "7px 12px", fontSize: 12.5, fontWeight: 600, textDecoration: "none", color: "var(--ink)" };
