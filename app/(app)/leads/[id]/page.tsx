import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canSee } from "@/lib/roles";
import { todayISO } from "@/lib/today";
import { leadScore, leadProduct, LS, TIER_STYLE } from "@/lib/leadscore";
import { LeadEditForm, CallCell, type Lead } from "@/components/LeadControls";
import ConvertPanel from "@/components/ConvertPanel";
import ExperiencePanel from "@/components/ExperiencePanel";
import LeadRemarks, { type Remark } from "@/components/LeadRemarks";
import LeadOpportunity from "@/components/LeadOpportunity";
import ActivityTimeline from "@/components/ActivityTimeline";
import { buildTimeline, atDay, type TimelineEvent } from "@/lib/timeline";
import { canWrite } from "@/lib/roles";
import { ivrStatus } from "@/lib/ivr/config";

export const dynamic = "force-dynamic";

const money = (n: number) => "₹" + Number(n || 0).toLocaleString("en-IN");
const SIGNALS: { key: string; label: string }[] = [
  { key: "interest", label: "Interest" }, { key: "urgency", label: "Urgency" }, { key: "history", label: "History" },
  { key: "goals", label: "Goal" }, { key: "location", label: "Location" }, { key: "budget", label: "Budget" }, { key: "profession", label: "Profession" },
];

export default async function LeadDetailPage({ params }: { params: { id: string } }) {
  const me = await getProfile();
  if (!me || !canSee(me.role, "/leads")) redirect("/dashboard");

  const supabase = createClient();
  const [{ data: leadRow }, { data: pkgRows }, { data: campRows }, { data: clientRows }, { data: apptRows }, { data: sessRows }, { data: trainerRows }, { data: remarkRows }, { data: emailRows }, { data: msgRows }] = await Promise.all([
    supabase.from("leads").select("id, name, phone, source, campaign, interest, urgency, history, goals, location, budget, profession, stage, fde, objection, notes, next_follow_up, next_follow_up_note, follow_up_owner, expected_package_id, expected_value, expected_close, disqualified_at, disqualified_reason, disqualified_by").eq("id", params.id).maybeSingle(),
    supabase.from("packages").select("id, name, price, is_facility").eq("active", true).order("id"),
    supabase.from("campaigns").select("name").order("created_at", { ascending: false }).limit(30),
    supabase.from("clients").select("id, name").order("name"),
    // Pre-sale bookings live on the lead until they convert (0080).
    supabase.from("appointments")
      .select("id, type, date, hour, status, is_experience, staff(name)")
      .eq("lead_id", params.id).order("date"),
    supabase.from("sessions")
      .select("id, date, hour, status, is_experience, staff(name)")
      .eq("lead_id", params.id).order("date"),
    supabase.from("staff").select("id, name, role")
      .in("role", ["Fitness Trainer", "Health Coach"]).order("name"),
    supabase.from("lead_remarks")
      .select("id, body, outcome, by_name, created_at")
      .eq("lead_id", params.id).order("created_at", { ascending: false }),
    supabase.from("email_log").select("subject, status, created_at").eq("lead_id", params.id),
    supabase.from("messages").select("body, sender, sender_name, created_at").eq("lead_id", params.id),
  ]);
  if (!leadRow) notFound();
  const lead = leadRow as Lead;
  const packages = (pkgRows ?? []) as { id: string; name: string; price: number; is_facility: boolean }[];
  const campaigns = [...new Set(((campRows ?? []) as { name: string }[]).map((c) => c.name))];
  const clients = (clientRows ?? []) as { id: string; name: string }[];
  const ivr = ivrStatus();
  // Supabase types embedded relations as arrays; collapse to the one row.
  const staffName = (v: unknown): string | null =>
    ((Array.isArray(v) ? v[0] : v) as { name?: string } | null)?.name ?? null;
  const experienceAppts = ((apptRows ?? []) as unknown as { id: string; type: string | null; date: string | null; hour: number | null; status: string; is_experience: boolean | null; staff: unknown }[])
    .map((a) => ({ ...a, providerName: staffName(a.staff) }));
  const experienceSessions = ((sessRows ?? []) as unknown as { id: string; date: string | null; hour: number | null; status: string; is_experience: boolean | null; staff: unknown }[])
    .map((x) => ({ ...x, providerName: staffName(x.staff) }));
  const trainers = (trainerRows ?? []) as { id: string; name: string }[];
  const remarks = (remarkRows ?? []) as Remark[];
  const opp = leadRow as unknown as {
    expected_package_id: string | null; expected_value: number | null; expected_close: string | null;
    disqualified_at: string | null; disqualified_reason: string | null; disqualified_by: string | null;
  };

  // One stream from every source that can reference a lead. Assembled at read
  // time rather than from an events table — an events table needs every write
  // path to remember to append, and the one that forgets is the one that
  // matters.
  const timeline: TimelineEvent[] = buildTimeline([
    remarks.map((r) => ({
      at: r.created_at, kind: "remark" as const,
      title: r.body, detail: r.outcome, by: r.by_name,
    })),
    experienceAppts.map((a) => ({
      at: atDay(a.date) ?? "", kind: "appointment" as const,
      title: a.type ?? "Appointment",
      detail: a.providerName ? `with ${a.providerName}` : null,
      pending: a.status === "scheduled",
    })),
    experienceSessions.map((x) => ({
      at: atDay(x.date) ?? "", kind: "session" as const,
      title: "Trial training session",
      detail: x.providerName ? `with ${x.providerName}` : null,
      pending: x.status === "scheduled",
    })),
    ((emailRows ?? []) as { subject: string | null; status: string | null; created_at: string }[])
      .map((e) => ({ at: e.created_at, kind: "email" as const, title: e.subject ?? "Email", detail: e.status })),
    ((msgRows ?? []) as { body: string; sender: string; sender_name: string | null; created_at: string }[])
      .map((m) => ({ at: m.created_at, kind: "message" as const, title: m.body, by: m.sender_name ?? m.sender })),
  ]);

  const fu = leadRow as unknown as { next_follow_up: string | null; next_follow_up_note: string | null; follow_up_owner: string | null };

  const { total, tier } = leadScore(lead);
  const product = leadProduct(lead);

  const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "18px 20px" };
  const lblS: React.CSSProperties = { fontSize: 11, color: "var(--muted)" };
  const input: React.CSSProperties = { padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, background: "#fff" };

  return (
    <div style={{ maxWidth: 900 }}>
      <Link href="/leads" style={{ color: "var(--brand-text)", fontSize: 13, textDecoration: "none" }}>← CRM &amp; Leads</Link>

      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "10px 0 18px" }}>
        <div>
          <h1 style={{ fontSize: 22, margin: "0 0 2px" }}>{lead.name}</h1>
          <div style={{ color: "var(--muted)", fontSize: 13 }}>{lead.phone ?? "—"}{lead.source ? ` · ${lead.source}` : ""}{lead.campaign ? ` · ${lead.campaign}` : ""} · {lead.stage ?? "1-New Lead"}</div>
        </div>
        <span style={{ flex: 1 }} />
        <CallCell phone={lead.phone} ivrConfigured={ivr.configured} />
      </div>

      {/* score breakdown */}
      <div style={{ ...box, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <b style={{ fontSize: 15 }}>Lead score</b>
          <span style={{ fontSize: 22, fontWeight: 800 }}>{total ?? "—"}</span>
          {tier && <span style={{ background: TIER_STYLE[tier].bg, color: TIER_STYLE[tier].color, borderRadius: 999, padding: "2px 12px", fontSize: 12, fontWeight: 700 }}>{tier}</span>}
          <span style={{ flex: 1 }} />
          <span style={{ color: "var(--muted)", fontSize: 13 }}>Best-fit: <b style={{ color: "var(--brand-text)" }}>{product}</b></span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
          {SIGNALS.map((s) => {
            const val = (lead as unknown as Record<string, string | null>)[s.key];
            const pts = val && LS[s.key] && LS[s.key][val] !== undefined ? LS[s.key][val] : 0;
            return (
              <div key={s.key as string} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={lblS}>{s.label}</span><b style={{ fontSize: 13, color: pts > 0 ? "var(--brand-text)" : "var(--muted)" }}>+{pts}</b></div>
                <div style={{ fontSize: 12, marginTop: 2 }}>{val ?? "—"}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* edit details */}
      <div style={{ ...box, marginBottom: 16 }}>
        <b style={{ fontSize: 15 }}>Lead details</b>
        <div style={{ marginTop: 12 }}>
          <LeadEditForm lead={lead} campaigns={campaigns} />
        </div>
      </div>

      {/* convert — kept at the bottom */}
      <div style={{ ...box, background: "#f0fdf9" }}>
        <b style={{ fontSize: 15 }}>Convert to client</b>
        <p style={{ color: "var(--muted)", fontSize: 13, margin: "4px 0 14px" }}>Pick a package &amp; offer, record referral, capture consent, and verify by OTP. On success the client, sessions and package invoice are created and you're taken to billing.</p>
        <LeadOpportunity
          leadId={lead.id}
          stage={lead.stage}
          packages={packages.map((x) => ({ id: x.id, name: x.name, price: x.price }))}
          expectedPackageId={opp.expected_package_id}
          expectedValue={opp.expected_value == null ? null : Number(opp.expected_value)}
          expectedClose={opp.expected_close}
          disqualifiedAt={opp.disqualified_at}
          disqualifiedReason={opp.disqualified_reason}
          disqualifiedBy={opp.disqualified_by}
          canWrite={canWrite(me.role)}
        />

        <div style={{ marginTop: 16, background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "16px 18px" }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>📜 Activity</div>
          <ActivityTimeline events={timeline} today={todayISO()} max={30}
            emptyLabel="No activity yet — log a remark or book an experience session." />
        </div>

        <LeadRemarks
          leadId={lead.id}
          remarks={remarks}
          nextFollowUp={fu.next_follow_up}
          followUpNote={fu.next_follow_up_note}
          followUpOwner={fu.follow_up_owner}
          today={todayISO()}
          canWrite={canWrite(me.role)}
          legacyNotes={lead.notes ?? null}
        />

        <ExperiencePanel
          leadId={lead.id}
          appointments={experienceAppts}
          sessions={experienceSessions}
          trainers={trainers}
          today={todayISO()}
          canBook={canWrite(me.role)}
        />

        <ConvertPanel leadId={lead.id} phone={lead.phone} packages={packages.map((p) => ({ id: p.id, name: p.name, price: p.price }))} clients={clients} />
      </div>
    </div>
  );
}
