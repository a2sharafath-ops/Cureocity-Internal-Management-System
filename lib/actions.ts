"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/auth";
import { canWrite, canManageSessions } from "@/lib/roles";

// ---- helpers ---------------------------------------------------------------

function fmtDate(d: Date) {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

// 12-per-4-week strength sessions on alternate days from a start date.
function buildSessions(
  clientId: string,
  trainerId: string,
  hour: number,
  startISO: string,
  count: number
) {
  const start = new Date(startISO + "T00:00:00");
  const rows: {
    client_id: string; trainer_id: string; seq: number; date: string; hour: number; status: string;
  }[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + (i + 1) * 2);
    rows.push({
      client_id: clientId, trainer_id: trainerId, seq: i + 1,
      date: fmtDate(d), hour, status: "scheduled",
    });
  }
  return rows;
}

// ---- auth ------------------------------------------------------------------

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

const ALLOWED_ROLES = [
  "Administrator", "Manager", "Front Desk", "Health Professional", "Finance", "HR", "Staff",
];

export async function updateUserRole(formData: FormData) {
  const me = await getProfile();
  if (!me || me.role !== "Administrator") return; // only admins manage roles
  const id = String(formData.get("id"));
  const role = String(formData.get("role"));
  if (!ALLOWED_ROLES.includes(role)) return;
  if (id === me.id && role !== "Administrator") return; // don't let an admin demote themselves
  const admin = createAdminClient();
  await admin.from("profiles").update({ role }).eq("id", id);
  revalidatePath("/users");
  revalidatePath("/", "layout");
}

// ---- sessions --------------------------------------------------------------

export async function rescheduleSession(formData: FormData) {
  const p = await getProfile();
  if (!p || !canManageSessions(p.role)) return;
  const id = String(formData.get("id"));
  const date = String(formData.get("date"));
  const hour = Number(formData.get("hour"));
  const trainer_id = String(formData.get("trainer_id"));
  const supabase = createClient();
  await supabase
    .from("sessions")
    .update({ date, hour, trainer_id, rescheduled: true })
    .eq("id", id);
  revalidatePath("/", "layout");
}

export async function markSessionComplete(formData: FormData) {
  const p = await getProfile();
  if (!p || !canManageSessions(p.role)) return;
  const id = String(formData.get("id"));
  const clientId = String(formData.get("client_id"));
  const supabase = createClient();
  await supabase.from("sessions").update({ status: "completed" }).eq("id", id);
  // bump the client's used count
  const { data: c } = await supabase.from("clients").select("used").eq("id", clientId).maybeSingle();
  if (c) await supabase.from("clients").update({ used: (c.used ?? 0) + 1 }).eq("id", clientId);
  revalidatePath("/", "layout");
}

// ---- leads -----------------------------------------------------------------

export async function updateLeadStage(formData: FormData) {
  const p = await getProfile();
  if (!p || !canWrite(p.role)) return;
  const id = String(formData.get("id"));
  const stage = String(formData.get("stage"));
  const supabase = createClient();
  await supabase.from("leads").update({ stage }).eq("id", id);
  revalidatePath("/leads");
}

// ---- clients ---------------------------------------------------------------

function parseClientForm(formData: FormData) {
  const goalsRaw = String(formData.get("goals") ?? "").trim();
  return {
    name: String(formData.get("name") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim() || null,
    email: String(formData.get("email") ?? "").trim() || null,
    package_id: String(formData.get("package_id") ?? "") || null,
    branch: String(formData.get("branch") ?? "").trim() || null,
    gender: String(formData.get("gender") ?? "").trim() || null,
    occupation: String(formData.get("occupation") ?? "").trim() || null,
    height: formData.get("height") ? Number(formData.get("height")) : null,
    weight: formData.get("weight") ? Number(formData.get("weight")) : null,
    conditions: String(formData.get("conditions") ?? "").trim() || null,
    goals: goalsRaw ? goalsRaw.split(",").map((g) => g.trim()).filter(Boolean) : [],
    joined: String(formData.get("joined") ?? "") || null,
  };
}

export async function createClientRecord(formData: FormData) {
  const p = await getProfile();
  if (!p || !canWrite(p.role)) return;
  const supabase = createClient();
  const c = parseClientForm(formData);
  if (!c.name) return;

  // next client code
  const { count } = await supabase.from("clients").select("id", { count: "exact", head: true });
  const code = "CUR-" + String((count ?? 0) + 1).padStart(3, "0");

  const { data: inserted } = await supabase
    .from("clients")
    .insert({ ...c, code, used: 0, verified: true, consent_tnc: true, consent_waiver: true, pro_id: "d1" })
    .select("id")
    .single();

  // auto-schedule sessions for PT / Comprehensive
  if (inserted && c.package_id && c.joined) {
    const { data: pkg } = await supabase
      .from("packages").select("sessions, is_facility").eq("id", c.package_id).maybeSingle();
    if (pkg && !pkg.is_facility && pkg.sessions > 0) {
      await supabase.from("enrollments").insert({ client_id: inserted.id, trainer_id: "t0", hour: 9, session: "PT" });
      await supabase.from("sessions").insert(buildSessions(inserted.id, "t0", 9, c.joined, pkg.sessions));
    }
  }
  revalidatePath("/clients");
  redirect("/clients");
}

export async function updateClientRecord(formData: FormData) {
  const p = await getProfile();
  if (!p || !canWrite(p.role)) return;
  const id = String(formData.get("id"));
  const supabase = createClient();
  const c = parseClientForm(formData);
  await supabase.from("clients").update(c).eq("id", id);
  revalidatePath("/", "layout");
  redirect(`/clients/${id}`);
}
