"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
const BP_PANEL = "blueprint";
import { getProfile } from "@/lib/auth";
import { canSee, canWrite, canManageSessions, canManagePackages, canManageServices, canSetTargets, canManageSops, canManageTasks, canConsult, canManageBlueprint, canBill, canManageInvoices, canMessage, canClasses, canRetention, canPos, canEmr, canClaims, canCompliance, canAppointments, canCampaigns, canHr } from "@/lib/roles";
import { BP_SCORES } from "@/lib/blueprint";
import { todayISO } from "@/lib/today";
import { packageCategory, requiresMembership, hasActiveMembership, addDaysISO, MEMBERSHIP_RULE_MSG } from "@/lib/packages";
import { getPersona } from "@/lib/personas";
import { canWriteNutrition, ownsConsultKind, wsKeyForRole } from "@/lib/discipline";
import { buildFollowupRows } from "@/lib/followups";
import { directoryDefaults, needsDirectoryRow, staffIdFor, namesMatch } from "@/lib/staff-directory";
import { assignCareTeam } from "@/lib/care-team";
import { notifyRoles } from "@/lib/notify";
import { BP_BOOKING_TASKS, BP_BOOKING_DUE_DAYS } from "@/lib/blueprint-sla";
import { SUGGESTED_OFFSET, type RemarkOutcome } from "@/lib/lead-followup";
import { leadScore } from "@/lib/leadscore";
import {
  EXPERIENCE_ASSESSMENT_TYPE, EXPERIENCE_ASSESSMENT_TITLE,
  EXPERIENCE_TRAINING_TITLE, EXPERIENCE_SEQ,
} from "@/lib/experience";
import {
  INITIAL_BOOKINGS, PT_BOOKING_LABEL, BOOKING_DUE_DAYS,
  BLOOD_PANEL, COMPREHENSIVE_CATEGORY,
} from "@/lib/comprehensive";
import { paymentConfig } from "@/lib/payments/config";
import { telehealthConfig } from "@/lib/telehealth/config";
import { ivrConfig } from "@/lib/ivr/config";
import crypto from "crypto";
import { createRazorpayOrder, verifyCheckoutSignature } from "@/lib/payments/razorpay";
import { sendEmail } from "@/lib/email/send";
import { renderChoice, tplInvoiceCreated, tplPaymentReceived, type Template } from "@/lib/email/templates";


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

// ---- audit -----------------------------------------------------------------

async function logAudit(
  actor: { id?: string; name?: string; role?: string } | null,
  action: string,
  target?: string | null,
  detail?: string | null
) {
  try {
    const supabase = createClient();
    await supabase.from("audit_log").insert({
      actor_id: actor?.id ?? null,
      actor_name: actor?.name ?? null,
      actor_role: actor?.role ?? null,
      action,
      target: target ?? null,
      detail: detail ?? null,
    });
  } catch {
    // never let logging failures break the action
  }
}

// ---- auth ------------------------------------------------------------------

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function setPreviewRole(formData: FormData) {
  const me = await getProfile();
  if (!me || (me.role !== "Administrator" && me.role !== "Super Admin")) return; // only admins can preview
  const role = String(formData.get("role") ?? "");
  const store = cookies();

  // Professional persona → step into that professional's workspace
  const persona = getPersona(role);
  if (persona) {
    store.set("preview_role", persona.key, { path: "/", sameSite: "lax" });
    store.set("preview_profession", persona.key, { path: "/", sameSite: "lax" });
    revalidatePath("/", "layout");
    redirect(persona.route);
  }

  // Plain role preview (or clear)
  store.delete("preview_profession");
  if (!role || role === "off") store.delete("preview_role");
  else store.set("preview_role", role, { path: "/", sameSite: "lax" });
  revalidatePath("/", "layout");
}

export type PwState = { error?: string; ok?: string };

export async function changePassword(_prev: PwState, formData: FormData): Promise<PwState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) return { error: "You must be signed in." };

  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (next.length < 6) return { error: "New password must be at least 6 characters." };
  if (next !== confirm) return { error: "New passwords don't match." };

  // verify the current password before changing it
  const check = await supabase.auth.signInWithPassword({ email: user.email, password: current });
  if (check.error) return { error: "Current password is incorrect." };

  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) return { error: error.message };

  const me = await getProfile();
  await logAudit(me, "Password changed", user.email, null);
  return { ok: "Your password has been updated." };
}

const ALLOWED_ROLES = [
  "Super Admin", "Administrator", "Manager", "Front Desk",
  "Doctor", "Dietitian", "Fitness Trainer", "Health Coach", "Psychologist",
  "Finance", "HR", "Staff",
];

export type InviteState = { error?: string; ok?: string };

export async function inviteStaff(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const me = await getProfile();
  if (!me || (me.role !== "Administrator" && me.role !== "Super Admin")) return { error: "Not authorized." };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "Front Desk");
  const branch = String(formData.get("branch") ?? "Kochi");
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { error: "Email and a temporary password are required." };
  if (password.length < 6) return { error: "Password must be at least 6 characters." };
  if (!ALLOWED_ROLES.includes(role)) return { error: "Invalid role." };

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });
  if (error) return { error: error.message };

  const uid = data.user?.id;
  const displayName = name || email.split("@")[0];
  let staffId: string | null = null;

  if (uid) {
    // A login alone can't be booked — appointments/sessions/HR all reference
    // staff(id). Reuse an existing directory row for this person if there is
    // one, otherwise create it, then link the two.
    if (needsDirectoryRow(role)) {
      const { data: existing } = await admin.from("staff").select("id, name");
      const rows = (existing ?? []) as { id: string; name: string }[];
      const match = rows.find((s) => namesMatch(s.name, displayName));

      if (match) {
        staffId = match.id;
        // adopt the fuller of the two names so the directory and login agree
        if (displayName.length > (match.name ?? "").length) {
          await admin.from("staff").update({ name: displayName }).eq("id", match.id);
        }
        await admin.from("staff").update({ role, branch }).eq("id", match.id);
      } else {
        const d = directoryDefaults(role);
        staffId = staffIdFor(displayName, email, rows.map((s) => s.id));
        await admin.from("staff").insert({
          id: staffId, name: displayName, role, branch,
          designation: d.designation, department: d.department,
          is_trainer: d.is_trainer, color: d.color,
        });
      }
    }

    // the signup trigger creates a Front Desk profile; set the chosen name + role
    await admin.from("profiles").upsert({ id: uid, email, name: displayName, role, branch, staff_id: staffId });
  }

  await logAudit(me, "Staff created", email, `role: ${role} · ${branch}${staffId ? ` · directory: ${staffId}` : ""}`);
  revalidatePath("/users");
  revalidatePath("/hr");
  revalidatePath("/appointments");
  return { ok: `Created ${email} as ${role}${staffId ? " and added them to the care-team directory" : ""}. Share the temporary password with them.` };
}

export async function createPortalLogin(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const me = await getProfile();
  if (!me || !canWrite(me.role)) return { error: "Not authorized." };

  const clientId = String(formData.get("client_id"));
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!clientId || !email || !password) return { error: "Email and a password are required." };
  if (password.length < 6) return { error: "Password must be at least 6 characters." };

  const admin = createAdminClient();
  const { data: cl } = await admin.from("clients").select("name").eq("id", clientId).maybeSingle();
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { name: cl?.name ?? email },
  });
  if (error) return { error: error.message };

  const uid = data.user?.id;
  if (uid) {
    await admin.from("profiles").upsert({ id: uid, email, name: cl?.name ?? email, role: "Client", client_id: clientId });
  }
  await logAudit(me, "Portal login created", cl?.name ?? email, email);
  revalidatePath(`/clients/${clientId}`);
  return { ok: `Portal login created for ${email}. Share the password with the client.` };
}

export async function updateUserRole(formData: FormData) {
  const me = await getProfile();
  if (!me || (me.role !== "Administrator" && me.role !== "Super Admin")) return; // only admins manage roles
  const id = String(formData.get("id"));
  const role = String(formData.get("role"));
  if (!ALLOWED_ROLES.includes(role)) return;
  if (id === me.id && role !== "Administrator" && role !== "Super Admin") return; // don't let an admin demote themselves
  const admin = createAdminClient();
  const { data: target } = await admin.from("profiles").select("email, role, client_id, staff_id").eq("id", id).maybeSingle();
  // a portal login belongs to a client record — it is never staff
  if (target?.client_id) return;
  await admin.from("profiles").update({ role }).eq("id", id);
  if (target?.staff_id) await admin.from("staff").update({ role }).eq("id", target.staff_id);
  await logAudit(me, "Role changed", target?.email ?? id, `${target?.role ?? "?"} → ${role}`);
  revalidatePath("/users");
  revalidatePath("/", "layout");
}

// Assign a staff/user to a branch (Kochi / Calicut).
export async function setUserBranch(formData: FormData) {
  const me = await getProfile();
  if (!me || (me.role !== "Administrator" && me.role !== "Super Admin")) return;
  const id = String(formData.get("id"));
  const branch = String(formData.get("branch"));
  const admin = createAdminClient();
  const { data: target } = await admin.from("profiles").select("email, name, staff_id").eq("id", id).maybeSingle();
  await admin.from("profiles").update({ branch }).eq("id", id);
  // keep the linked care-team staff row in sync (id first — names can drift)
  if (target?.staff_id) await admin.from("staff").update({ branch }).eq("id", target.staff_id);
  else if (target?.name) await admin.from("staff").update({ branch }).eq("name", target.name);
  await logAudit(me, "Branch changed", target?.email ?? id, branch);
  revalidatePath("/users");
}

// Rename a staff/user.
export async function updateUserName(formData: FormData) {
  const me = await getProfile();
  if (!me || (me.role !== "Administrator" && me.role !== "Super Admin")) return;
  const id = String(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const admin = createAdminClient();
  const { data: target } = await admin.from("profiles").select("name, staff_id").eq("id", id).maybeSingle();
  await admin.from("profiles").update({ name }).eq("id", id);
  // rename the directory row too, so the login and the care team stay in step
  if (target?.staff_id) await admin.from("staff").update({ name }).eq("id", target.staff_id);
  else if (target?.name) await admin.from("staff").update({ name }).eq("name", target.name);
  await logAudit(me, "Staff renamed", name, target?.name && target.name !== name ? `${target.name} → ${name}` : null);
  revalidatePath("/users");
  revalidatePath("/hr");
  revalidatePath("/", "layout");
}

// ---- credentials -----------------------------------------------------------
//
// Changing someone else's login is the most dangerous thing on this page: it's
// how an account takeover would look if it ever happened here. So three rules
// hold across everything below.
//   1. Every change writes to the audit log with the before value, because the
//      whole point of an audit trail is answering "who moved this, and from
//      what" months later.
//   2. Changing an email notifies the OLD address. If the change wasn't
//      theirs, that message is the only way they'd find out.
//   3. Portal (client) logins are out of scope — they're managed from the
//      client card, and letting staff admin reach them widens the blast radius
//      for no benefit.

/** Manager, Administrator and Super Admin may manage staff credentials. */
function canManageCredentials(role: string): boolean {
  return role === "Manager" || role === "Administrator" || role === "Super Admin";
}

export type CredState = { ok?: string; error?: string };

/**
 * Change a staff login email.
 *
 * Updates the auth user and the profile together — they're two tables holding
 * the same fact, and letting them drift means someone signs in with one
 * address while the app shows another.
 */
export async function updateUserEmail(_prev: CredState, formData: FormData): Promise<CredState> {
  const me = await getProfile();
  if (!me || !canManageCredentials(me.role)) return { error: "Not authorized." };

  const id = String(formData.get("id"));
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { error: "An email address is required." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "That doesn't look like an email address." };

  const admin = createAdminClient();
  const { data: target } = await admin.from("profiles")
    .select("email, name, role, client_id").eq("id", id).maybeSingle();
  if (!target) return { error: "User not found." };
  if (target.client_id) return { error: "Portal logins are managed from the client's card." };
  if (target.email === email) return { error: "That's already their email address." };

  // Reject a collision before touching auth, so we don't half-apply the change.
  const { data: clash } = await admin.from("profiles")
    .select("id").eq("email", email).neq("id", id).maybeSingle();
  if (clash) return { error: "Another account already uses that email." };

  const { error } = await admin.auth.admin.updateUserById(id, { email, email_confirm: true });
  if (error) return { error: error.message };
  await admin.from("profiles").update({ email }).eq("id", id);

  // Tell the address that just lost access. Best-effort: a bounced notice must
  // not fail the change, or a stale address would make the account unfixable.
  const previous = target.email;
  if (previous) {
    try {
      await sendEmail(
        previous,
        "Your Cureocity sign-in email was changed",
        `<p>Hello ${target.name ?? ""},</p>
<p>The email used to sign in to Cureocity was changed from <b>${previous}</b> to <b>${email}</b> by ${me.name}.</p>
<p>If you did not expect this, contact your administrator immediately.</p>`,
      );
    } catch { /* notice is best-effort; the change still stands */ }
  }

  await logAudit(me, "Login email changed", target.name ?? id, `${previous ?? "?"} → ${email}`);
  revalidatePath("/users");
  return { ok: `Sign-in email updated to ${email}. The previous address has been notified.` };
}

/**
 * Send a password reset link.
 *
 * The default path, and the one to reach for: nobody on staff ever learns
 * another person's password, and no password passes through this app.
 */
export async function sendUserPasswordReset(_prev: CredState, formData: FormData): Promise<CredState> {
  const me = await getProfile();
  if (!me || !canManageCredentials(me.role)) return { error: "Not authorized." };

  const id = String(formData.get("id"));
  const admin = createAdminClient();
  const { data: target } = await admin.from("profiles")
    .select("email, name, client_id").eq("id", id).maybeSingle();
  if (!target?.email) return { error: "User not found." };
  if (target.client_id) return { error: "Portal logins are managed from the client's card." };

  // Where the reset link lands. Supabase also enforces its own redirect
  // allow-list, so an unset/incorrect value here fails closed rather than
  // sending anyone somewhere unexpected.
  const origin = process.env.NEXT_PUBLIC_SITE_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  const { error } = await admin.auth.resetPasswordForEmail(target.email, {
    redirectTo: `${origin}/account`,
  });
  if (error) return { error: error.message };

  await logAudit(me, "Password reset sent", target.name ?? target.email, target.email);
  revalidatePath("/users");
  return { ok: `Reset link sent to ${target.email}.` };
}

/**
 * Set a password directly.
 *
 * The fallback for staff whose email doesn't actually receive mail — several
 * of the current logins are like that, so a reset-link-only design would leave
 * them permanently locked out. Deliberately the secondary control: it means a
 * manager briefly knows someone's password, so it's logged loudly and the
 * person should change it at /account afterwards.
 */
export async function setUserPassword(_prev: CredState, formData: FormData): Promise<CredState> {
  const me = await getProfile();
  if (!me || !canManageCredentials(me.role)) return { error: "Not authorized." };

  const id = String(formData.get("id"));
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) return { error: "Use at least 8 characters." };

  const admin = createAdminClient();
  const { data: target } = await admin.from("profiles")
    .select("email, name, client_id").eq("id", id).maybeSingle();
  if (!target) return { error: "User not found." };
  if (target.client_id) return { error: "Portal logins are managed from the client's card." };

  const { error } = await admin.auth.admin.updateUserById(id, { password });
  if (error) return { error: error.message };

  await logAudit(me, "Password set by admin", target.name ?? target.email ?? id,
    "temporary — the user should change it at /account");
  revalidatePath("/users");
  return { ok: `Password set for ${target.email}. Ask them to change it at /account once they're in.` };
}

// Delete a staff login (removes the auth user + profile).
export async function deleteStaff(formData: FormData) {
  const me = await getProfile();
  if (!me || (me.role !== "Administrator" && me.role !== "Super Admin")) return;
  const id = String(formData.get("id"));
  if (id === me.id) return; // can't delete yourself
  const admin = createAdminClient();
  const { data: target } = await admin.from("profiles").select("email").eq("id", id).maybeSingle();
  try { await admin.auth.admin.deleteUser(id); } catch { /* not an auth user — fall through */ }
  await admin.from("profiles").delete().eq("id", id);
  await logAudit(me, "Staff deleted", target?.email ?? id, null);
  revalidatePath("/users");
}

// ---- sessions --------------------------------------------------------------

// ---- training schedule: trainer slots, assessments, recovery ---------------

// Toggle a trainer/hour slot between available and unavailable.
export async function setTrainerSlot(formData: FormData) {
  const p = await getProfile();
  if (!p || !canManageSessions(p.role)) return;
  const trainer_id = String(formData.get("trainer_id"));
  const hour = Number(formData.get("hour"));
  const status = String(formData.get("status")); // available | unavailable
  const supabase = createClient();
  await supabase.from("trainer_slots").upsert(
    { trainer_id, hour, status, client_id: null, tag: null, updated_by: p.name, updated_at: new Date().toISOString() },
    { onConflict: "trainer_id,hour" }
  );
  revalidatePath("/sessions");
}

// Assign a client (with a tag) to an available trainer slot.
export async function assignTrainerSlot(formData: FormData) {
  const p = await getProfile();
  if (!p || !canManageSessions(p.role)) return;
  const trainer_id = String(formData.get("trainer_id"));
  const hour = Number(formData.get("hour"));
  const client_id = String(formData.get("client_id")) || null;
  const tag = String(formData.get("tag") || "PT");
  if (!client_id) return;
  const supabase = createClient();
  await supabase.from("trainer_slots").upsert(
    { trainer_id, hour, status: "available", client_id, tag, updated_by: p.name, updated_at: new Date().toISOString() },
    { onConflict: "trainer_id,hour" }
  );
  revalidatePath("/sessions");
}

// Clear a client from a slot (keeps it available).
export async function unassignTrainerSlot(formData: FormData) {
  const p = await getProfile();
  if (!p || !canManageSessions(p.role)) return;
  const trainer_id = String(formData.get("trainer_id"));
  const hour = Number(formData.get("hour"));
  const supabase = createClient();
  await supabase.from("trainer_slots").update({ client_id: null, tag: null, updated_by: p.name }).eq("trainer_id", trainer_id).eq("hour", hour);
  revalidatePath("/sessions");
}

export async function createAssessment(formData: FormData) {
  const p = await getProfile();
  if (!p || !canManageSessions(p.role)) return;
  const client_id = String(formData.get("client_id")) || null;
  const trainer_id = String(formData.get("trainer_id")) || null;
  const kind = String(formData.get("kind") || "initial");
  const due_date = String(formData.get("due_date") || todayISO());
  if (!client_id) return;
  const supabase = createClient();
  await supabase.from("assessments").insert({ client_id, trainer_id, kind, due_date, status: "due", created_by: p.name });
  revalidatePath("/sessions");
}

export async function markAssessmentBooked(formData: FormData) {
  const p = await getProfile();
  if (!p || !canManageSessions(p.role)) return;
  const id = String(formData.get("id"));
  const supabase = createClient();
  await supabase.from("assessments").update({ status: "booked", scheduled_date: todayISO() }).eq("id", id);
  revalidatePath("/sessions");
}

export async function completeAssessment(formData: FormData) {
  const p = await getProfile();
  if (!p || !canManageSessions(p.role)) return;
  const id = String(formData.get("id"));
  const supabase = createClient();
  await supabase.from("assessments").update({ status: "done", scheduled_date: todayISO() }).eq("id", id);
  revalidatePath("/sessions");
}

export async function toggleAssessmentShared(formData: FormData) {
  const p = await getProfile();
  if (!p || !canManageSessions(p.role)) return;
  const id = String(formData.get("id"));
  const shared = String(formData.get("shared")) === "true";
  const supabase = createClient();
  await supabase.from("assessments").update({ shared: !shared }).eq("id", id);
  revalidatePath("/sessions");
}

export async function addRecoverySession(formData: FormData) {
  const p = await getProfile();
  if (!p || !canManageSessions(p.role)) return;
  const client_id = String(formData.get("client_id")) || null;
  const kind = String(formData.get("kind") || "Recovery");
  const staff_id = String(formData.get("staff_id")) || null;
  const date = String(formData.get("date") || todayISO());
  const hour = Number(formData.get("hour")) || null;
  const supabase = createClient();
  await supabase.from("recovery_sessions").insert({ client_id, kind, staff_id, date, hour, status: "scheduled", created_by: p.name });
  revalidatePath("/sessions");
}

export async function completeRecoverySession(formData: FormData) {
  const p = await getProfile();
  if (!p || !canManageSessions(p.role)) return;
  const id = String(formData.get("id"));
  const supabase = createClient();
  await supabase.from("recovery_sessions").update({ status: "completed" }).eq("id", id);
  revalidatePath("/sessions");
}

export async function rescheduleSession(formData: FormData) {
  const p = await getProfile();
  if (!p || !canManageSessions(p.role)) return;
  const id = String(formData.get("id"));
  const date = String(formData.get("date"));
  const hour = Number(formData.get("hour"));
  const trainer_id = String(formData.get("trainer_id"));
  const supabase = createClient();
  const { data: s } = await supabase.from("sessions").select("seq, clients(name)").eq("id", id).maybeSingle();
  await supabase
    .from("sessions")
    .update({ date, hour, trainer_id, rescheduled: true })
    .eq("id", id);
  const cName = (s as { clients?: { name?: string } } | null)?.clients?.name;
  await logAudit(p, "Session rescheduled", cName, `#${s?.seq ?? "?"} → ${date} ${hour}:00`);
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
  const { data: c } = await supabase.from("clients").select("used, name").eq("id", clientId).maybeSingle();
  if (c) await supabase.from("clients").update({ used: (c.used ?? 0) + 1 }).eq("id", clientId);
  await logAudit(p, "Session completed", c?.name, null);
  revalidatePath("/", "layout");
}

// ---- packages --------------------------------------------------------------

export async function togglePackageActive(formData: FormData) {
  const p = await getProfile();
  if (!p || !canManagePackages(p.role)) return;
  const id = String(formData.get("id"));
  const active = String(formData.get("active")) === "true";
  const supabase = createClient();
  await supabase.from("packages").update({ active: !active }).eq("id", id);
  await logAudit(p, active ? "Package deactivated" : "Package activated", id, null);
  revalidatePath("/packages");
}

// Create or edit a package (with per-branch pricing).
export async function savePackage(formData: FormData) {
  const p = await getProfile();
  if (!p || !canManagePackages(p.role)) return;
  let id = String(formData.get("id") || "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const sessions = Number(formData.get("sessions")) || 0;
  const validity = Number(formData.get("validity")) || 0;
  const is_facility = String(formData.get("is_facility")) === "on";
  const one_time = String(formData.get("one_time")) === "on";
  const requires_slot = String(formData.get("requires_slot")) === "on";
  const delivery_mode = String(formData.get("delivery_mode") || "Offline");
  const tags = String(formData.get("tags") ?? "").split(",").map((t) => t.trim()).filter(Boolean);
  const priceKochi = Number(formData.get("price_kochi")) || 0;
  const priceCalicut = Number(formData.get("price_calicut")) || priceKochi;
  const base = priceKochi || priceCalicut;

  const supabase = createClient();
  const fields = { name, sessions, validity, price: base, is_facility, one_time, requires_slot, delivery_mode, tags };
  if (id) {
    await supabase.from("packages").update(fields).eq("id", id);
  } else {
    id = "pkg_" + Math.random().toString(36).slice(2, 8);
    await supabase.from("packages").insert({ id, active: true, ...fields });
  }
  await supabase.from("package_prices").upsert([
    { package_id: id, branch: "Kochi", price: priceKochi },
    { package_id: id, branch: "Calicut", price: priceCalicut },
  ]);
  await logAudit(p, "Package saved", name, id);
  revalidatePath("/packages");
}

// ---- leads -----------------------------------------------------------------

export async function updateLeadStage(formData: FormData) {
  const p = await getProfile();
  if (!p || !canWrite(p.role)) return;
  const id = String(formData.get("id"));
  const stage = String(formData.get("stage"));
  const supabase = createClient();
  const { data: lead } = await supabase.from("leads").select("name").eq("id", id).maybeSingle();
  await supabase.from("leads").update({ stage }).eq("id", id);
  await logAudit(p, "Lead stage changed", lead?.name, `→ ${stage}`);
  revalidatePath("/leads");
}

const LEAD_FIELDS = ["name", "phone", "source", "campaign", "interest", "urgency", "history", "goals", "location", "budget", "profession", "fde", "objection", "notes"];

export async function createLead(formData: FormData) {
  const p = await getProfile();
  if (!p || !canWrite(p.role)) return;
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const supabase = createClient();
  const { data: last } = await supabase.from("leads").select("num").order("num", { ascending: false }).limit(1).maybeSingle();
  const num = ((last?.num as number | null) ?? 0) + 1;
  const row: Record<string, unknown> = { num };
  for (const f of LEAD_FIELDS) row[f] = String(formData.get(f) ?? "").trim() || null;
  row.name = name;
  row.stage = String(formData.get("stage") || "").trim() || "1-New Lead";
  // Score at creation so a new lead is immediately filterable by tier.
  const fresh = leadScore(row as Parameters<typeof leadScore>[0]);
  row.score = fresh.total;
  row.tier = fresh.tier;
  row.scored_at = new Date().toISOString();
  await supabase.from("leads").insert(row);
  await logAudit(p, "Lead added", name, null);
  revalidatePath("/leads");
}

export async function updateLead(formData: FormData) {
  const p = await getProfile();
  if (!p || !canWrite(p.role)) return;
  const id = String(formData.get("id"));
  if (!id) return;
  const supabase = createClient();
  const patch: Record<string, unknown> = {};
  for (const f of LEAD_FIELDS) patch[f] = String(formData.get(f) ?? "").trim() || null;
  const stage = String(formData.get("stage") || "").trim();
  if (stage) patch.stage = stage;
  await supabase.from("leads").update(patch).eq("id", id);
  // The 7 scoring signals may have changed — restore the stored score so it
  // stays queryable rather than drifting from what the page computes.
  await restoreLeadScore(supabase, id);
  await logAudit(p, "Lead updated", String(formData.get("name") ?? ""), null);
  revalidatePath("/leads");
}

// Convert a lead into a client on a chosen package — creates the client,
// auto-schedules sessions, raises the package invoice, and lands on the client's
// billing so payment can be collected.
export async function convertLeadWithPackage(formData: FormData) {
  const p = await getProfile();
  if (!p || !canWrite(p.role)) return;
  const id = String(formData.get("id"));
  const package_id = String(formData.get("package_id") || "") || null;
  const joined = String(formData.get("joined") || todayISO());
  const supabase = createClient();
  const { data: lead } = await supabase.from("leads").select("name, phone").eq("id", id).maybeSingle();
  if (!lead?.name) return;

  const { count } = await supabase.from("clients").select("id", { count: "exact", head: true });
  const code = "CUR-" + String((count ?? 0) + 1).padStart(3, "0");
  const { data: inserted } = await supabase.from("clients").insert({
    code, name: lead.name, phone: lead.phone ?? null, joined,
    package_id, used: 0, verified: true, converted_from: id, pro_id: "d1",
  }).select("id").single();

  // Experience bookings move across before anything else, so the client's
  // history starts at their first visit rather than at payment.
  if (inserted) await carryExperienceToClient(supabase, id, inserted.id);

  if (inserted && package_id) {
    const { data: pkg } = await supabase.from("packages").select("name, price, sessions, is_facility").eq("id", package_id).maybeSingle();
    if (pkg && !pkg.is_facility && pkg.sessions > 0) {
      await supabase.from("enrollments").insert({ client_id: inserted.id, trainer_id: "t0", hour: 9, session: "PT" });
      await supabase.from("sessions").insert(buildSessions(inserted.id, "t0", 9, joined, pkg.sessions));
    }
    if (pkg) {
      const num = await nextInvoiceNum(supabase);
      await supabase.from("invoices").insert({
        num, client_id: inserted.id, description: `${pkg.name} package`, amount: pkg.price ?? 0,
        status: "Unpaid", issued_date: todayISO(), created_by: p.name,
      });
    }
  }
  await supabase.from("leads").update({ stage: "5-Close" }).eq("id", id);
  await logAudit(p, "Lead converted to client", lead.name, code);
  // On a CRM-only deployment the client card isn't reachable, so send them
  // back to the pipeline rather than bouncing them off a page that redirects.
  if (inserted) redirect(canSee(p.role, "/clients") ? `/clients/${inserted.id}?tab=timeline` : "/leads");
}

// Send a 6-digit OTP to the lead's phone for conversion consent. SMS isn't
// wired, so the code is returned for the front desk to read to the client; once
// an SMS provider is configured it would be texted instead.
export async function sendLeadOtp(formData: FormData): Promise<{ ok: boolean; devCode?: string; error?: string }> {
  const p = await getProfile();
  if (!p || !canWrite(p.role)) return { ok: false, error: "Not permitted" };
  const phone = String(formData.get("phone") || "").trim();
  if (!phone) return { ok: false, error: "No phone on this lead" };
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const supabase = createClient();
  await supabase.from("verifications").insert({
    phone, code, purpose: "lead_convert", expires_at: new Date(Date.now() + 10 * 60000).toISOString(),
  });
  await logAudit(p, "Conversion OTP sent", phone, null);
  // SMS provider not configured → hand the code back for manual entry.
  return { ok: true, devCode: code };
}

// Verify OTP + consent, then convert the lead into a client on a package with an
// optional offer/discount and referral attribution.
export async function convertLeadVerified(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const p = await getProfile();
  if (!p || !canWrite(p.role)) return { ok: false, error: "Not permitted" };
  const id = String(formData.get("id"));
  const otp = String(formData.get("otp") || "").trim();
  if (String(formData.get("tnc")) !== "on" || String(formData.get("consent")) !== "on") {
    return { ok: false, error: "Terms & informed consent must be accepted" };
  }
  const supabase = createClient();
  const { data: lead } = await supabase.from("leads").select("name, phone").eq("id", id).maybeSingle();
  if (!lead?.name) return { ok: false, error: "Lead not found" };

  // verify OTP
  const { data: v } = await supabase.from("verifications")
    .select("id, code, expires_at, verified").eq("phone", lead.phone ?? "").eq("purpose", "lead_convert")
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!v || v.code !== otp) return { ok: false, error: "Invalid OTP" };
  if (new Date(v.expires_at).getTime() < Date.now()) return { ok: false, error: "OTP expired — resend" };
  await supabase.from("verifications").update({ verified: true }).eq("id", v.id);

  const package_id = String(formData.get("package_id") || "") || null;
  // A client is someone who has bought something. Without this, conversion
  // produced an empty shell with no package, no invoice and no journey.
  if (!package_id) return { ok: false, error: "Choose a package — a lead can't be converted without one." };
  const joined = String(formData.get("joined") || todayISO());
  const discount = Math.max(0, Number(formData.get("discount")) || 0);
  const referrer_id = String(formData.get("referrer_id") || "") || null;
  const referral_code = String(formData.get("referral_code") ?? "").trim() || null;

  // Membership-prerequisite rule: a brand-new client cannot convert straight
  // onto a PT/Comprehensive package — they must hold a membership first.
  if (package_id) {
    const { data: pk0 } = await supabase.from("packages").select("is_facility").eq("id", package_id).maybeSingle();
    if (pk0 && requiresMembership(packageCategory(package_id, pk0.is_facility))) {
      return { ok: false, error: MEMBERSHIP_RULE_MSG };
    }
  }

  const { count } = await supabase.from("clients").select("id", { count: "exact", head: true });
  const code = "CUR-" + String((count ?? 0) + 1).padStart(3, "0");
  // pro_id is left null here — the assignment engine fills it in below, once
  // it knows the client's booking and the current rotation state.
  const { data: inserted } = await supabase.from("clients").insert({
    code, name: lead.name, phone: lead.phone ?? null, joined,
    package_id, used: 0, verified: true, consent_tnc: true, consent_waiver: true, converted_from: id,
  }).select("id").single();

  if (inserted && package_id) {
    const { data: pkg } = await supabase.from("packages").select("name, price, sessions, is_facility, validity").eq("id", package_id).maybeSingle();

    // Assign the care team: doctor/dietitian/psychologist follow whoever the
    // client was booked with; health coach and trainer come off the rotation.
    const slotHour = Number(formData.get("slot_hour")) || 9;
    const team = await assignCareTeam(supabase, inserted.id, {
      slot: { date: joined, hour: slotHour }, actor: p.name,
    });
    const trainerId = team.find((t) => t.discipline === "trainer")?.staff_id ?? null;

    if (pkg && !pkg.is_facility && pkg.sessions > 0 && trainerId) {
      await supabase.from("enrollments").insert({ client_id: inserted.id, trainer_id: trainerId, hour: slotHour, session: "PT" });
      await supabase.from("sessions").insert(buildSessions(inserted.id, trainerId, slotHour, joined, pkg.sessions));
    }
    if (pkg) {
      const amount = Math.max(0, Number(pkg.price ?? 0) - discount);
      const num = await nextInvoiceNum(supabase);
      await supabase.from("invoices").insert({
        num, client_id: inserted.id,
        description: `${pkg.name} package${discount > 0 ? ` (offer −₹${discount.toLocaleString("en-IN")})` : ""}`,
        amount, status: "Unpaid", issued_date: todayISO(), created_by: p.name,
      });
      await supabase.from("client_packages").insert({
        client_id: inserted.id, package_id, package_name: pkg.name,
        category: packageCategory(package_id, pkg.is_facility), start_date: joined,
        end_date: pkg.validity ? addDaysISO(joined, pkg.validity) : null,
        price: amount, status: "active", created_by: p.name,
      });
      const cat0 = packageCategory(package_id, pkg.is_facility);
      if (cat0 === "blueprint") {
        await startBlueprintJourney(supabase, inserted.id, lead.name, p.name);
      } else if (cat0 === COMPREHENSIVE_CATEGORY) {
        await startComprehensiveJourney(supabase, inserted.id, lead.name, joined, p.name);
      }
    }
  }
  // record referral attribution
  if (inserted && (referrer_id || referral_code)) {
    await supabase.from("referrals").insert({
      referrer_id, referred_name: lead.name, status: "joined",
      note: referral_code ? `Code: ${referral_code}` : null, created_by: p.name,
    });
  }
  await supabase.from("leads").update({ stage: "5-Close" }).eq("id", id);
  await logAudit(p, "Lead converted (verified)", lead.name, code);
  // On a CRM-only deployment the client card isn't reachable, so send them
  // back to the pipeline rather than bouncing them off a page that redirects.
  if (inserted) redirect(canSee(p.role, "/clients") ? `/clients/${inserted.id}?tab=timeline` : "/leads");
  return { ok: true };
}

// NOTE: the old package-less quick-convert lived here. It created clients with
// no package, no invoice and a hardcoded pro — which is how CUR-003 ended up as
// an empty shell. Conversion now goes through convertLeadVerified, which
// requires a package. Deliberately not reinstated.

// click-to-call via IVR provider (key-ready). Falls back to a tel: link in the UI.
export async function initiateCall(formData: FormData) {
  const p = await getProfile();
  if (!p || !canWrite(p.role)) return;
  const phone = String(formData.get("phone") || "");
  const cfg = ivrConfig();
  if (cfg.configured) {
    // Provider-specific bridge (Exotel/Knowlarity/Twilio) goes here using
    // IVR_API_KEY + IVR_CALLER_ID + IVR_AGENT_NUMBER. Left inert until keys set.
  }
  await logAudit(p, cfg.configured ? "IVR call initiated" : "Call opened", phone, null);
  revalidatePath("/leads");
}

// Add a package to an existing client. Enforces the membership-prerequisite rule:
// PT / Comprehensive can only be sold if the client has an active membership
// covering the chosen start date.
export async function purchasePackage(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const p = await getProfile();
  if (!p || !canBill(p.role)) return { ok: false, error: "Not permitted" };
  const client_id = String(formData.get("client_id") || "");
  const package_id = String(formData.get("package_id") || "");
  const start = String(formData.get("start_date") || todayISO());
  const discount = Math.max(0, Number(formData.get("discount")) || 0);
  if (!client_id || !package_id) return { ok: false, error: "Missing client or package" };

  const supabase = createClient();
  const { data: pkg } = await supabase.from("packages")
    .select("name, price, sessions, is_facility, validity").eq("id", package_id).maybeSingle();
  if (!pkg) return { ok: false, error: "Package not found" };

  const cat = packageCategory(package_id, pkg.is_facility);
  if (requiresMembership(cat)) {
    const { data: existing } = await supabase.from("client_packages")
      .select("category, start_date, end_date").eq("client_id", client_id).eq("status", "active");
    if (!hasActiveMembership((existing ?? []) as { category: string; start_date: string | null; end_date: string | null }[], start)) {
      return { ok: false, error: MEMBERSHIP_RULE_MSG };
    }
  }

  const amount = Math.max(0, Number(pkg.price ?? 0) - discount);
  await supabase.from("client_packages").insert({
    client_id, package_id, package_name: pkg.name, category: cat, start_date: start,
    end_date: pkg.validity ? addDaysISO(start, pkg.validity) : null,
    price: amount, status: "active", created_by: p.name,
  });
  const num = await nextInvoiceNum(supabase);
  await supabase.from("invoices").insert({
    num, client_id, description: `${pkg.name} package${discount > 0 ? ` (offer −₹${discount.toLocaleString("en-IN")})` : ""}`,
    amount, status: "Unpaid", issued_date: todayISO(), created_by: p.name,
  });
  if (!pkg.is_facility && pkg.sessions > 0) {
    await supabase.from("enrollments").insert({ client_id, trainer_id: "t0", hour: 9, session: "PT" });
    await supabase.from("sessions").insert(buildSessions(client_id, "t0", 9, start, pkg.sessions));
  }
  if (cat === "blueprint" || cat === COMPREHENSIVE_CATEGORY) {
    const { data: cli } = await supabase.from("clients").select("name").eq("id", client_id).maybeSingle();
    const who = cli?.name ?? "Client";
    if (cat === "blueprint") await startBlueprintJourney(supabase, client_id, who, p.name);
    else await startComprehensiveJourney(supabase, client_id, who, start, p.name);
  }
  await logAudit(p, "Package purchased", pkg.name, client_id);
  revalidatePath(`/clients/${client_id}`);
  return { ok: true };
}

// ---- consultations (professional workspace) --------------------------------

export async function createConsultation(formData: FormData) {
  const p = await getProfile();
  if (!p || !canConsult(p.role)) return;
  const client_id = String(formData.get("client_id"));
  const kind = String(formData.get("kind"));
  const notes = String(formData.get("notes") ?? "").trim() || null;
  if (!client_id || !kind) return;
  if (!ownsConsultKind(p.role, kind)) return; // only the owning discipline
  const supabase = createClient();
  await supabase.from("consultations").insert({
    client_id, kind, notes, status: "scheduled", by_name: p.name, by_role: p.role,
  });
  const { data: c } = await supabase.from("clients").select("name").eq("id", client_id).maybeSingle();
  await logAudit(p, "Consultation created", c?.name, kind);
  revalidatePath("/pro");
}

// Start a live consultation and jump into the console.
export async function startConsult(formData: FormData) {
  const p = await getProfile();
  if (!p || !canConsult(p.role)) return;
  const client_id = String(formData.get("client_id"));
  const kind = String(formData.get("kind"));
  if (!client_id || !kind) return;
  if (!ownsConsultKind(p.role, kind)) return; // only the owning discipline
  const supabase = createClient();
  const { data: row } = await supabase.from("consultations").insert({
    client_id, kind, status: "scheduled", by_name: p.name, by_role: p.role, started_at: new Date().toISOString(),
  }).select("id").maybeSingle();
  const { data: c } = await supabase.from("clients").select("name").eq("id", client_id).maybeSingle();
  await logAudit(p, "Consultation started", c?.name, kind);
  if (row?.id) redirect(`/console/${row.id}`);
  redirect("/workspace?tab=summaries");
}

// Save the console session — intake answers + scribe summary, optionally complete.
export async function saveConsultSession(formData: FormData) {
  const p = await getProfile();
  if (!p || !canConsult(p.role)) return;
  const id = String(formData.get("id"));
  const kind = String(formData.get("kind"));
  const complete = String(formData.get("complete") || "") === "true";
  if (!id) return;
  if (!ownsConsultKind(p.role, kind)) return; // only the owning discipline
  const { consultQ } = await import("@/lib/consult-questions");
  const questions = consultQ(kind).questions;
  const answers = questions.map((q, i) => [q, String(formData.get("a_" + i) ?? "").trim()]).filter(([, a]) => a);
  const summary = String(formData.get("summary") ?? "").trim() || null;
  const duration = Number(formData.get("duration_min")) || null;
  const supabase = createClient();
  await supabase.from("consultations").update({
    answers, summary, ...(complete ? { status: "completed" } : {}), ...(duration ? { duration_min: duration } : {}),
  }).eq("id", id);
  await logAudit(p, complete ? "Consultation completed" : "Consultation session saved", kind, null);
  revalidatePath("/workspace");
  if (complete) redirect("/workspace?tab=summaries");
  revalidatePath(`/console/${id}`);
}

export async function completeConsultation(formData: FormData) {
  const p = await getProfile();
  if (!p || !canConsult(p.role)) return;
  const id = String(formData.get("id"));
  const summary = String(formData.get("summary") ?? "").trim() || null;
  // The doctor's answer on the summary. Only meaningful on a Doctor consult,
  // and only `true` starts the 24h prescription-delivery clock — a recorded
  // "no" is a fact, an unanswered null is not a breach.
  const rxRaw = formData.get("prescription_needed");
  const rxNeeded = rxRaw == null ? null : String(rxRaw) === "true";
  const supabase = createClient();
  const { data: row } = await supabase.from("consultations").select("kind").eq("id", id).maybeSingle();
  if (!row || !ownsConsultKind(p.role, row.kind)) return; // only the owning discipline
  // Starts this clinician's 24h sign-off clock, and — once all three
  // disciplines are complete — the 48h delivery clock. See lib/blueprint-sla.
  await supabase.from("consultations")
    .update({
      status: "completed", summary, completed_at: new Date().toISOString(),
      ...(row.kind === "Doctor" && rxNeeded !== null ? { prescription_needed: rxNeeded } : {}),
    })
    .eq("id", id);
  revalidatePath("/pro");
  revalidatePath("/", "layout");
}

export async function toggleConsultFlag(formData: FormData) {
  const p = await getProfile();
  if (!p || !canConsult(p.role)) return;
  const id = String(formData.get("id"));
  const field = String(formData.get("field")); // "approved" | "shared"
  const value = String(formData.get("value")) === "true";
  if (field !== "approved" && field !== "shared") return;
  const supabase = createClient();
  const { data: row } = await supabase.from("consultations").select("kind").eq("id", id).maybeSingle();
  if (!row || !ownsConsultKind(p.role, row.kind)) return; // only the owning discipline
  const next = !value;
  // Stamp who signed off and when — this is what stops the 24h clock. Clearing
  // the flag clears the stamp, so un-approving restarts the clock rather than
  // leaving a stale "approved at" behind.
  const patch: Record<string, unknown> = { [field]: next };
  if (field === "approved") {
    patch.approved_at = next ? new Date().toISOString() : null;
    patch.approved_by = next ? p.name : null;
  }
  await supabase.from("consultations").update(patch).eq("id", id);
  revalidatePath("/pro");
  revalidatePath("/", "layout");
}

// ---- BluePrint -------------------------------------------------------------

/**
 * Everything that must happen the moment a client buys BluePrint.
 *
 * Two things start immediately and were previously left to somebody
 * remembering: the blood report request, and getting the three clinical
 * appointments into the diary. The blood request is created outright — it's a
 * message to the client, it has no calendar consequence, and delaying it
 * delays everything downstream. The three appointments are *not* auto-booked:
 * picking a slot in a clinician's diary without a human choosing it produces
 * times that suit nobody and a pile of reschedules. Instead each becomes a
 * front-desk task, so the work is visible and owned but the humans still pick
 * the time.
 *
 * Safe to call twice — the blood request upserts on client_id and the tasks
 * are skipped if a matching open one already exists.
 */
async function startBlueprintJourney(
  supabase: ReturnType<typeof createClient>,
  clientId: string,
  clientName: string,
  actor: string,
) {
  await supabase.from("blood_requests").upsert(
    { client_id: clientId, panel: BP_PANEL, requested_at: todayISO(), submitted: false },
    { onConflict: "client_id,panel" },
  );
  // The blueprint row exists from the start so the SLA sweep has somewhere to
  // record holds, rather than materialising only at the end of the journey.
  await supabase.from("blueprints").upsert(
    { client_id: clientId, status: "in_progress", updated_at: new Date().toISOString() },
    { onConflict: "client_id", ignoreDuplicates: true },
  );

  const titles = BP_BOOKING_TASKS.map((t) => `${t.label} — ${clientName}`);
  const { data: existing } = await supabase.from("tasks")
    .select("title").eq("client_id", clientId).neq("status", "done").in("title", titles);
  const taken = new Set(((existing ?? []) as { title: string }[]).map((r) => r.title));

  const rows = BP_BOOKING_TASKS
    .map((t, i) => ({ t, title: titles[i] }))
    .filter(({ title }) => !taken.has(title))
    .map(({ t, title }) => ({
      title, client_id: clientId, type: "Ops", priority: "High",
      status: "todo", due_date: addDaysISO(todayISO(), BP_BOOKING_DUE_DAYS),
      created_by: actor,
    }));
  if (rows.length) await supabase.from("tasks").insert(rows);

  await notifyRoles(supabase, ["Administrator", "Manager", "Super Admin"], {
    title: "BluePrint started",
    body: `${clientName} — blood report requested, ${rows.length} appointment${rows.length === 1 ? "" : "s"} to book.`,
    href: "/blueprint",
    icon: "🧬",
  });
}

/**
 * Pause or resume the SLA clocks for one client.
 *
 * "Unless there is a delay from the client side" — this is that escape hatch.
 * Closing a hold banks the elapsed time rather than discarding it, so the
 * deadline slides by exactly as long as we were actually waiting, the same way
 * the package freeze works. Held time is only ever discounted from work that
 * hadn't been delivered yet, so a hold cannot retroactively rescue a blueprint
 * that already went out late.
 */
export async function toggleBlueprintHold(formData: FormData) {
  const p = await getProfile();
  if (!p || !canManageBlueprint(p.role)) return;
  const client_id = String(formData.get("client_id"));
  const note = String(formData.get("note") ?? "").trim() || null;
  const supabase = createClient();

  const { data: bp } = await supabase.from("blueprints")
    .select("hold_since, hold_ms").eq("client_id", client_id).maybeSingle();
  const now = Date.now();
  const open = bp?.hold_since ? new Date(bp.hold_since).getTime() : null;

  const patch = open
    ? {
        hold_since: null,
        hold_ms: Math.max(0, Number(bp?.hold_ms ?? 0)) + Math.max(0, now - open),
        hold_note: null,
      }
    : { hold_since: new Date(now).toISOString(), hold_note: note };

  await supabase.from("blueprints").upsert({
    client_id, ...patch, updated_at: new Date(now).toISOString(),
  });
  const { data: c } = await supabase.from("clients").select("name").eq("id", client_id).maybeSingle();
  await logAudit(p, open ? "BluePrint SLA resumed" : "BluePrint SLA held", c?.name, note);
  revalidatePath("/blueprint");
  revalidatePath("/", "layout");
}

/**
 * Everything that must happen the moment a client buys Comprehensive.
 *
 * Day 0 does four things, and only the first is fully automatic:
 *   1. request the Comprehensive blood panel — a different set of reports from
 *      the BluePrint panel, which is why blood_requests now carries a `panel`
 *      and a client can hold one of each;
 *   2. assign the care team, including the health coach (rotation, seniority
 *      first) — the coach owns scheduling the diet chart explanation later;
 *   3. queue four front-desk bookings: doctor, dietitian, trainer, and the 12
 *      strength sessions. Prompted rather than auto-booked, so a human picks
 *      times that suit the client;
 *   4. open the protocol row that anchors every day-offset milestone and
 *      holds the client-side pause.
 *
 * Idempotent: blood upserts on (client_id, panel), the protocol row is unique
 * per (client, protocol, start), and tasks are skipped when an open one with
 * the same title already exists.
 */
async function startComprehensiveJourney(
  supabase: ReturnType<typeof createClient>,
  clientId: string,
  clientName: string,
  startDate: string,
  actor: string,
) {
  await supabase.from("blood_requests").upsert(
    { client_id: clientId, panel: BLOOD_PANEL, requested_at: todayISO(), submitted: false },
    { onConflict: "client_id,panel" },
  );

  // Doctor / dietitian / trainer come from the initial booking once it exists;
  // coach and trainer fall back to rotation. Safe to call before any booking —
  // it assigns what it can and fills the rest in later.
  await assignCareTeam(supabase, clientId, { actor });

  await supabase.from("care_protocols").upsert(
    {
      client_id: clientId, protocol: COMPREHENSIVE_CATEGORY,
      start_date: startDate, status: "active", created_by: actor,
    },
    { onConflict: "client_id,protocol,start_date", ignoreDuplicates: true },
  );

  const wanted = [
    ...INITIAL_BOOKINGS.map((b) => `${b.label} — ${clientName}`),
    `${PT_BOOKING_LABEL} — ${clientName}`,
  ];
  const { data: existing } = await supabase.from("tasks")
    .select("title").eq("client_id", clientId).neq("status", "done").in("title", wanted);
  const taken = new Set(((existing ?? []) as { title: string }[]).map((r) => r.title));

  const rows = wanted.filter((t) => !taken.has(t)).map((title) => ({
    title, client_id: clientId, type: "Ops", priority: "High", status: "todo",
    due_date: addDaysISO(todayISO(), BOOKING_DUE_DAYS), created_by: actor,
  }));
  if (rows.length) await supabase.from("tasks").insert(rows);

  await notifyRoles(supabase, ["Administrator", "Manager", "Super Admin"], {
    title: "Comprehensive started",
    body: `${clientName} — blood panel requested, care team assigned, ${rows.length} booking${rows.length === 1 ? "" : "s"} to make.`,
    href: `/clients/${clientId}`,
    icon: "\u{1FA7A}",
  });
}


/**
 * Pause or resume the Comprehensive clocks for one client.
 *
 * "Unless there is a delay from the client side" — this is that escape hatch,
 * and it covers both shapes of commitment: the 24h turnarounds and the
 * day-offset milestones. Closing a hold banks the elapsed time rather than
 * discarding it, so every deadline slides by exactly how long we were waiting.
 * Held time only ever discounts work not yet delivered, so a hold cannot
 * retroactively rescue something that already went out late.
 */
export async function toggleComprehensiveHold(formData: FormData) {
  const p = await getProfile();
  if (!p || !canWrite(p.role)) return;
  const client_id = String(formData.get("client_id"));
  const note = String(formData.get("note") ?? "").trim() || null;
  const supabase = createClient();

  const { data: row } = await supabase.from("care_protocols")
    .select("id, hold_since, hold_ms")
    .eq("client_id", client_id).eq("protocol", COMPREHENSIVE_CATEGORY).eq("status", "active")
    .maybeSingle();
  if (!row) return;

  const now = Date.now();
  const open = row.hold_since ? new Date(row.hold_since).getTime() : null;
  const patch = open
    ? {
        hold_since: null,
        hold_ms: Math.max(0, Number(row.hold_ms ?? 0)) + Math.max(0, now - open),
        hold_note: null,
      }
    : { hold_since: new Date(now).toISOString(), hold_note: note };

  await supabase.from("care_protocols").update(patch).eq("id", row.id);
  const { data: c } = await supabase.from("clients").select("name").eq("id", client_id).maybeSingle();
  await logAudit(p, open ? "Comprehensive SLA resumed" : "Comprehensive SLA held", c?.name, note);
  revalidatePath(`/clients/${client_id}`);
  revalidatePath("/", "layout");
}

/** A client can hold a BluePrint panel and a Comprehensive panel at once. When
 *  they upload a report from the portal we can't tell which it satisfies, so
 *  close the oldest outstanding one — that's the one they were asked for
 *  first. Staff can correct it from the BluePrint page. */
async function markEarliestPanelReceived(
  supabase: ReturnType<typeof createClient>,
  clientId: string,
) {
  const { data } = await supabase.from("blood_requests")
    .select("id").eq("client_id", clientId).eq("submitted", false)
    .order("requested_at", { ascending: true }).limit(1);
  const row = (data ?? [])[0] as { id: string } | undefined;
  if (row) {
    await supabase.from("blood_requests")
      .update({ submitted: true, submitted_date: todayISO() }).eq("id", row.id);
  }
}

/**
 * The Comprehensive protocol picture for one client — every clock, ready to
 * render. Mirrors the shape the nightly sweep builds, so the panel a clinician
 * looks at and the notification they receive can never disagree.
 */
export async function getComprehensiveView(clientId: string) {
  const p = await getProfile();
  if (!p || !canSee(p.role, "/clients")) return null;
  const supabase = createClient();

  const { data: proto } = await supabase.from("care_protocols")
    .select("start_date, consolidated_at, approved_at, hold_since, hold_ms, hold_note")
    .eq("client_id", clientId).eq("protocol", COMPREHENSIVE_CATEGORY).eq("status", "active")
    .maybeSingle();
  if (!proto) return null;

  const [
    { data: consults }, { data: charts }, { data: workouts },
    { data: rx }, { data: sessions }, { data: appts }, { data: cp },
  ] = await Promise.all([
    supabase.from("consultations")
      .select("kind, completed_at, approved_at, prescription_needed").eq("client_id", clientId),
    supabase.from("diet_charts").select("drafted_at").eq("client_id", clientId).order("drafted_at").limit(1),
    supabase.from("client_workouts").select("created_at, plan_weeks").eq("client_id", clientId).order("created_at").limit(5),
    supabase.from("prescriptions").select("shared_at").eq("client_id", clientId).not("shared_at", "is", null).order("shared_at").limit(1),
    supabase.from("sessions").select("status").eq("client_id", clientId).eq("status", "completed"),
    supabase.from("appointments").select("type, date, status").eq("client_id", clientId),
    supabase.from("client_packages").select("package_id").eq("client_id", clientId).eq("status", "active").maybeSingle(),
  ]);

  const plan = ((workouts ?? []) as { created_at: string; plan_weeks: number | null }[])
    .find((w) => (w.plan_weeks ?? 1) >= 1);

  return {
    startDate: proto.start_date as string,
    validityDays: (cp?.package_id === "comp12" ? 84 : 28),
    consults: ((consults ?? []) as { kind: string; completed_at: string | null; approved_at: string | null; prescription_needed: boolean | null }[])
      .map((c) => ({ kind: c.kind, completedAt: c.completed_at, approvedAt: c.approved_at, prescriptionNeeded: c.prescription_needed })),
    consolidatedAt: proto.consolidated_at as string | null,
    approvedAt: proto.approved_at as string | null,
    dietDraftedAt: ((charts ?? [])[0] as { drafted_at: string | null } | undefined)?.drafted_at ?? null,
    workoutPlannedAt: plan?.created_at ?? null,
    prescriptionSharedAt: ((rx ?? [])[0] as { shared_at: string | null } | undefined)?.shared_at ?? null,
    sessionsCompleted: (sessions ?? []).length,
    appointments: ((appts ?? []) as { type: string | null; date: string | null; status: string }[]),
    hold: { holdSince: proto.hold_since as string | null, holdMs: Number(proto.hold_ms ?? 0) },
    holdNote: (proto.hold_note as string | null) ?? null,
  };
}


// ---- free experience sessions (pre-sale) -----------------------------------

/**
 * Book a lead's free fitness assessment or trial training session.
 *
 * These are the only bookings that exist before someone pays. The database
 * enforces one of each per lead (0080), so a second attempt fails at the
 * index rather than here — this returns the error rather than throwing, so
 * front desk sees "already booked" instead of a stack trace.
 *
 * Free, so no invoice. A no-show costs a slot, not money.
 */
export async function bookExperienceSession(
  _prev: { ok?: string; error?: string },
  formData: FormData,
): Promise<{ ok?: string; error?: string }> {
  const p = await getProfile();
  if (!p || !canWrite(p.role)) return { error: "Not permitted." };

  const lead_id = String(formData.get("lead_id") || "");
  const kind = String(formData.get("kind") || "");     // assessment | training
  const date = String(formData.get("date") || "");
  const hour = Number(formData.get("hour")) || 9;
  const staff_id = String(formData.get("staff_id") || "") || null;
  if (!lead_id || !date) return { error: "Pick a date." };
  if (kind !== "assessment" && kind !== "training") return { error: "Unknown session type." };

  const supabase = createClient();
  const { data: lead } = await supabase.from("leads").select("name, stage").eq("id", lead_id).maybeSingle();
  if (!lead) return { error: "Lead not found." };

  if (kind === "assessment") {
    const { error } = await supabase.from("appointments").insert({
      lead_id, client_id: null, provider_id: staff_id,
      type: EXPERIENCE_ASSESSMENT_TYPE, title: EXPERIENCE_ASSESSMENT_TITLE,
      date, hour, duration_min: 45, status: "scheduled",
      is_experience: true, created_by: p.name,
    });
    if (error) {
      return { error: /duplicate|unique/i.test(error.message)
        ? "This lead has already had their free assessment."
        : error.message };
    }
  } else {
    // sessions.trainer_id is NOT NULL, so a trainer must be chosen for a
    // training session even though it's optional for an assessment.
    if (!staff_id) return { error: "Pick a trainer for the training session." };
    const { error } = await supabase.from("sessions").insert({
      lead_id, client_id: null, trainer_id: staff_id,
      seq: EXPERIENCE_SEQ, date, hour, status: "scheduled", is_experience: true,
    });
    if (error) {
      return { error: /duplicate|unique/i.test(error.message)
        ? "This lead has already had their free training session."
        : error.message };
    }
  }

  // A booked experience session means the lead is further along than
  // "contacted" — reflect that, but never move a lead backwards.
  if (lead.stage === "1-New Lead" || lead.stage === "2-Discovery") {
    await supabase.from("leads").update({ stage: "4-Visit/Trial" }).eq("id", lead_id);
  }

  await logAudit(p, "Experience session booked", lead.name, `${kind} · ${date} ${hour}:00`);
  revalidatePath(`/leads/${lead_id}`);
  revalidatePath("/leads");
  revalidatePath("/appointments");
  return { ok: `Booked — ${kind === "assessment" ? "free assessment" : "free training session"} on ${date}.` };
}

/** Mark an experience session attended, cancelled or a no-show. */
export async function setExperienceStatus(formData: FormData) {
  const p = await getProfile();
  if (!p || !canWrite(p.role)) return;
  const lead_id = String(formData.get("lead_id") || "");
  const kind = String(formData.get("kind") || "");
  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "");
  if (!id || !["completed", "cancelled", "no_show"].includes(status)) return;

  const supabase = createClient();
  const table = kind === "training" ? "sessions" : "appointments";
  // `sessions` has no no_show state; treat it as cancelled there so the row
  // stays truthful rather than inventing a status the table doesn't have.
  const value = table === "sessions" && status === "no_show" ? "cancelled" : status;
  await supabase.from(table).update({ status: value }).eq("id", id);

  await logAudit(p, "Experience session updated", kind, status);
  revalidatePath(`/leads/${lead_id}`);
  revalidatePath("/leads");
}

/**
 * Move a converting lead's experience bookings onto their new client record.
 *
 * Without this the history is orphaned: the assessment that sold them the
 * package would vanish the moment they bought it, and the client's timeline
 * would start at payment rather than at their first real visit.
 */
async function carryExperienceToClient(
  supabase: ReturnType<typeof createClient>,
  leadId: string,
  clientId: string,
) {
  await supabase.from("appointments")
    .update({ client_id: clientId, lead_id: null }).eq("lead_id", leadId);
  await supabase.from("sessions")
    .update({ client_id: clientId, lead_id: null }).eq("lead_id", leadId);
}


// ---- lead remarks + callbacks ----------------------------------------------

/**
 * Log a remark and set the next callback in one step.
 *
 * Deliberately one action, not two. The sales audit found the follow-up date
 * filled 17% of the time while remarks said "call tomorrow" — that gap exists
 * precisely because recording what happened and deciding what happens next
 * were separate chores. Here the date defaults from the outcome (no answer →
 * tomorrow, spoke → a week) so the common case is one click.
 */
export async function addLeadRemark(
  _prev: { ok?: string; error?: string },
  formData: FormData,
): Promise<{ ok?: string; error?: string }> {
  const p = await getProfile();
  if (!p || !canWrite(p.role)) return { error: "Not permitted." };

  const lead_id = String(formData.get("lead_id") || "");
  const body = String(formData.get("body") ?? "").trim();
  const outcome = String(formData.get("outcome") || "note") as RemarkOutcome;
  if (!lead_id || !body) return { error: "Write what happened." };

  const supabase = createClient();
  const { data: lead } = await supabase.from("leads").select("name, fde").eq("id", lead_id).maybeSingle();
  if (!lead) return { error: "Lead not found." };

  await supabase.from("lead_remarks").insert({
    lead_id, body, outcome, by_name: p.name,
  });

  // Explicit date wins; otherwise fall back to the outcome's suggestion. An
  // outcome with no suggestion (not interested) clears the callback rather
  // than leaving a stale one to chase.
  const explicit = String(formData.get("next_follow_up") || "").trim();
  const offset = SUGGESTED_OFFSET[outcome] ?? null;
  const next = explicit || (offset != null ? addDaysISO(todayISO(), offset) : null);

  await supabase.from("leads").update({
    next_follow_up: next,
    next_follow_up_note: String(formData.get("next_note") ?? "").trim() || null,
    follow_up_owner: p.name,
  }).eq("id", lead_id);

  await logAudit(p, "Lead remark added", lead.name, `${outcome}${next ? ` · callback ${next}` : ""}`);
  revalidatePath(`/leads/${lead_id}`);
  revalidatePath("/leads");
  return { ok: next ? `Saved. Next callback ${next}.` : "Saved. No callback scheduled." };
}

/** Change or clear a lead's callback date without logging a remark. */
export async function setLeadFollowup(formData: FormData) {
  const p = await getProfile();
  if (!p || !canWrite(p.role)) return;
  const lead_id = String(formData.get("lead_id") || "");
  const date = String(formData.get("next_follow_up") || "").trim() || null;
  if (!lead_id) return;
  const supabase = createClient();
  await supabase.from("leads").update({
    next_follow_up: date, follow_up_owner: date ? p.name : null,
  }).eq("id", lead_id);
  const { data: l } = await supabase.from("leads").select("name").eq("id", lead_id).maybeSingle();
  await logAudit(p, date ? "Lead callback set" : "Lead callback cleared", l?.name, date);
  revalidatePath(`/leads/${lead_id}`);
  revalidatePath("/leads");
}


// ---- opportunity + disqualification ----------------------------------------

/** Reasons a lead was never a real opportunity. Distinct from LOST, which
 *  means we competed and lost. */
export const DISQUALIFY_REASONS = [
  { key: "unreachable",     label: "Never reachable" },
  { key: "wrong_number",    label: "Wrong number" },
  { key: "duplicate",       label: "Duplicate of another lead" },
  { key: "out_of_area",     label: "Outside our area" },
  { key: "not_our_service", label: "Wants something we don't offer" },
  { key: "spam",            label: "Spam / test entry" },
] as const;

/**
 * Set the expected package, value and close date — the "light opportunity".
 *
 * Value defaults to the package's list price but stays editable, because
 * discounts and part-payments are real and a forecast built on list price
 * would be consistently optimistic.
 */
/** Store score + tier so they can be filtered, sorted and tracked over time.
 *  They were derived at render and thrown away, which made "who moved from
 *  COLD to HOT this week" unanswerable. */
async function restoreLeadScore(
  supabase: ReturnType<typeof createClient>,
  leadId: string,
) {
  const { data } = await supabase.from("leads")
    .select("interest, urgency, history, goals, location, budget, profession")
    .eq("id", leadId).maybeSingle();
  if (!data) return;
  const { total, tier } = leadScore(data as Parameters<typeof leadScore>[0]);
  await supabase.from("leads").update({
    score: total, tier, scored_at: new Date().toISOString(),
  }).eq("id", leadId);
}

export async function setLeadOpportunity(
  _prev: { ok?: string; error?: string },
  formData: FormData,
): Promise<{ ok?: string; error?: string }> {
  const p = await getProfile();
  if (!p || !canWrite(p.role)) return { error: "Not permitted." };

  const lead_id = String(formData.get("lead_id") || "");
  const pkg = String(formData.get("expected_package_id") || "") || null;
  const rawValue = String(formData.get("expected_value") || "").trim();
  const close = String(formData.get("expected_close") || "").trim() || null;
  if (!lead_id) return { error: "Lead not found." };

  const supabase = createClient();
  let value: number | null = rawValue ? Number(rawValue) : null;
  if (value != null && (!Number.isFinite(value) || value < 0)) {
    return { error: "Expected value must be a positive number." };
  }
  // Fall back to list price when a package is chosen and no value typed.
  if (value == null && pkg) {
    const { data: row } = await supabase.from("packages").select("price").eq("id", pkg).maybeSingle();
    value = row?.price != null ? Number(row.price) : null;
  }

  await supabase.from("leads").update({
    expected_package_id: pkg, expected_value: value, expected_close: close,
  }).eq("id", lead_id);

  const { data: l } = await supabase.from("leads").select("name").eq("id", lead_id).maybeSingle();
  await logAudit(p, "Lead opportunity set", l?.name,
    `${pkg ?? "no package"} · ${value != null ? `₹${value}` : "no value"}${close ? ` · close ${close}` : ""}`);
  revalidatePath(`/leads/${lead_id}`);
  revalidatePath("/leads");
  return { ok: "Opportunity saved." };
}

/**
 * Mark a lead as never having been a real opportunity.
 *
 * Kept separate from LOST and from `stage`, so the stage it died in survives —
 * that is exactly the leak-point data the sales audit asks for. A disqualified
 * lead drops out of pipeline value and out of conversion-rate denominators.
 */
export async function disqualifyLead(formData: FormData) {
  const p = await getProfile();
  if (!p || !canWrite(p.role)) return;
  const lead_id = String(formData.get("lead_id") || "");
  const reason = String(formData.get("reason") || "").trim();
  if (!lead_id || !reason) return;

  const supabase = createClient();
  await supabase.from("leads").update({
    disqualified_at: new Date().toISOString(),
    disqualified_reason: reason,
    disqualified_by: p.name,
    next_follow_up: null,      // stop chasing someone who isn't a prospect
    follow_up_owner: null,
  }).eq("id", lead_id);

  const { data: l } = await supabase.from("leads").select("name").eq("id", lead_id).maybeSingle();
  await logAudit(p, "Lead disqualified", l?.name, reason);
  revalidatePath(`/leads/${lead_id}`);
  revalidatePath("/leads");
}

/** Undo a disqualification — mistakes happen, and a wrong "wrong number" is a
 *  lead silently deleted from every report. */
export async function requalifyLead(formData: FormData) {
  const p = await getProfile();
  if (!p || !canWrite(p.role)) return;
  const lead_id = String(formData.get("lead_id") || "");
  if (!lead_id) return;
  const supabase = createClient();
  await supabase.from("leads").update({
    disqualified_at: null, disqualified_reason: null, disqualified_by: null,
  }).eq("id", lead_id);
  const { data: l } = await supabase.from("leads").select("name").eq("id", lead_id).maybeSingle();
  await logAudit(p, "Lead requalified", l?.name, null);
  revalidatePath(`/leads/${lead_id}`);
  revalidatePath("/leads");
}

export async function requestBlood(formData: FormData) {
  const p = await getProfile();
  if (!p || !canManageBlueprint(p.role)) return;
  const client_id = String(formData.get("client_id"));
  const supabase = createClient();
  await supabase.from("blood_requests").upsert(
    { client_id, panel: BP_PANEL, requested_at: todayISO(), submitted: false },
    { onConflict: "client_id,panel" },
  );
  const { data: c } = await supabase.from("clients").select("name").eq("id", client_id).maybeSingle();
  await logAudit(p, "Blood report requested", c?.name, null);
  revalidatePath("/blueprint");
}

export async function markBloodReceived(formData: FormData) {
  const p = await getProfile();
  if (!p || !canManageBlueprint(p.role)) return;
  const client_id = String(formData.get("client_id"));
  const supabase = createClient();
  // Panel comes from the form so front desk can receive either report set;
  // defaults to the BluePrint panel, which is what every existing row is.
  const panel = String(formData.get("panel") ?? BP_PANEL);
  await supabase.from("blood_requests")
    .update({ submitted: true, submitted_date: todayISO() })
    .eq("client_id", client_id).eq("panel", panel);
  const { data: c } = await supabase.from("clients").select("name").eq("id", client_id).maybeSingle();
  await logAudit(p, "Blood report received", c?.name, null);
  revalidatePath("/blueprint");
}

export async function saveBlueprintScores(formData: FormData) {
  const p = await getProfile();
  if (!p || !canManageBlueprint(p.role)) return;
  const client_id = String(formData.get("client_id"));
  const scores: Record<string, number> = {};
  for (const s of BP_SCORES) {
    const raw = formData.get("s_" + s.key);
    if (raw !== null && String(raw).trim() !== "") {
      const n = Math.max(0, Math.min(100, Number(raw)));
      if (!Number.isNaN(n)) scores[s.key] = n;
    }
  }
  const supabase = createClient();
  await supabase.from("blueprints").upsert({ client_id, scores, updated_at: new Date().toISOString() });
  const { data: c } = await supabase.from("clients").select("name").eq("id", client_id).maybeSingle();
  await logAudit(p, "Blueprint scores updated", c?.name, `${Object.keys(scores).length}/9 scores`);
  revalidatePath("/blueprint");
  revalidatePath("/", "layout");
}

// ---- file uploads (Supabase Storage) ---------------------------------------

async function storeFile(clientId: string, kind: string, file: File, uploadedBy: string) {
  const supabase = createClient();
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${clientId}/${crypto.randomUUID()}-${safe}`;
  const { error } = await supabase.storage.from("client-files").upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  });
  if (error) return { error: error.message };
  await supabase.from("files").insert({ client_id: clientId, bucket: "client-files", path, name: file.name, kind, uploaded_by: uploadedBy });
  return { ok: true };
}

export type UploadState = { error?: string; ok?: string };

// staff upload for a client (client 360)
export async function uploadClientFile(_prev: UploadState, formData: FormData): Promise<UploadState> {
  const me = await getProfile();
  if (!me || me.role === "Client") return { error: "Not authorized." };
  const clientId = String(formData.get("client_id"));
  const kind = String(formData.get("kind") || "document");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file to upload." };
  if (file.size > 10 * 1024 * 1024) return { error: "File too large (max 10 MB)." };
  const r = await storeFile(clientId, kind, file, me.name);
  if (r.error) return { error: r.error };
  const supabase = createClient();
  const { data: c } = await supabase.from("clients").select("name").eq("id", clientId).maybeSingle();
  await logAudit(me, "File uploaded", c?.name, `${kind}: ${file.name}`);
  revalidatePath(`/clients/${clientId}`);
  return { ok: "Uploaded." };
}

// client uploads from the portal (their own files)
export async function uploadPortalFile(_prev: UploadState, formData: FormData): Promise<UploadState> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };
  const { data: prof } = await supabase.from("profiles").select("client_id, name").eq("id", user.id).maybeSingle();
  if (!prof?.client_id) return { error: "No client linked to your login." };
  const kind = String(formData.get("kind") || "document");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file to upload." };
  if (file.size > 10 * 1024 * 1024) return { error: "File too large (max 10 MB)." };
  const r = await storeFile(prof.client_id, kind, file, prof.name ?? "Client");
  if (r.error) return { error: r.error };
  if (kind === "blood_report") {
    // A client uploading a report satisfies whichever panel is still open. If
    // both are, the earliest requested wins — they were asked for it first.
    await markEarliestPanelReceived(supabase, prof.client_id);
  }
  await logAudit({ id: user.id, name: prof.name ?? undefined, role: "Client" }, "File uploaded (portal)", prof.name, `${kind}: ${file.name}`);
  revalidatePath("/portal");
  return { ok: "Uploaded." };
}

// client marks their own blood report submitted (portal)
export async function submitBloodSelf() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data: prof } = await supabase.from("profiles").select("client_id, role, name").eq("id", user.id).maybeSingle();
  if (!prof?.client_id) return;
  await supabase.from("blood_requests").update({ submitted: true, submitted_date: todayISO() }).eq("client_id", prof.client_id);
  await logAudit({ id: user.id, name: prof.name ?? undefined, role: prof.role ?? undefined }, "Blood report submitted (portal)", prof.name, null);
  revalidatePath("/portal");
}

export async function generateBlueprint(formData: FormData) {
  const p = await getProfile();
  if (!p || !canManageBlueprint(p.role)) return;
  const client_id = String(formData.get("client_id"));
  const consolidated = String(formData.get("consolidated") ?? "").trim() || null;
  const supabase = createClient();
  const now = new Date().toISOString();
  // One click still does both halves — writing the consolidated summary and
  // approving the blueprint — but they're stamped separately so the 48h
  // delivery clock can be measured, and so the two can be split into distinct
  // gates later without another migration.
  await supabase.from("blueprints").upsert({
    client_id, consolidated, status: "generated", generated: true, generated_date: todayISO(),
    consolidated_at: now, approved: true, approved_at: now, approved_by: p.name,
    updated_at: now,
  });
  const { data: c } = await supabase.from("clients").select("name").eq("id", client_id).maybeSingle();
  await logAudit(p, "Blueprint generated", c?.name, null);
  revalidatePath("/blueprint");
  revalidatePath("/", "layout");
}

// ---- group classes + room booking ------------------------------------------

export async function createClass(formData: FormData) {
  const p = await getProfile();
  if (!p || !canClasses(p.role)) return;
  const room_id = String(formData.get("room_id"));
  const title = String(formData.get("title") ?? "").trim() || "Class";
  const trainer_id = String(formData.get("trainer_id")) || null;
  const date = String(formData.get("date"));
  const hour = Number(formData.get("hour")) || 9;
  const capacity = Number(formData.get("capacity")) || 12;
  if (!room_id || !date) return;
  const supabase = createClient();
  await supabase.from("classes").insert({ room_id, title, trainer_id, date, hour, capacity });
  await logAudit(p, "Class created", title, `${date} ${hour}:00`);
  revalidatePath("/classes");
}

export async function deleteClass(formData: FormData) {
  const p = await getProfile();
  if (!p || !canClasses(p.role)) return;
  const id = String(formData.get("id"));
  const supabase = createClient();
  await supabase.from("classes").delete().eq("id", id);
  revalidatePath("/classes");
}

async function classHasRoom(supabase: ReturnType<typeof createClient>, classId: string) {
  const { data: cls } = await supabase.from("classes").select("capacity").eq("id", classId).maybeSingle();
  if (!cls) return false;
  const { count } = await supabase.from("class_bookings").select("id", { count: "exact", head: true }).eq("class_id", classId);
  return (count ?? 0) < (cls.capacity ?? 0);
}

export async function bookClientStaff(formData: FormData) {
  const p = await getProfile();
  if (!p || !canClasses(p.role)) return;
  const class_id = String(formData.get("class_id"));
  const client_id = String(formData.get("client_id"));
  if (!class_id || !client_id) return;
  const supabase = createClient();
  if (!(await classHasRoom(supabase, class_id))) return;
  await supabase.from("class_bookings").insert({ class_id, client_id });
  revalidatePath("/classes");
}

export async function cancelBookingStaff(formData: FormData) {
  const p = await getProfile();
  if (!p || !canClasses(p.role)) return;
  const id = String(formData.get("id"));
  const supabase = createClient();
  await supabase.from("class_bookings").delete().eq("id", id);
  revalidatePath("/classes");
}

// portal: client books / cancels their own class
export async function bookClassSelf(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data: prof } = await supabase.from("profiles").select("client_id").eq("id", user.id).maybeSingle();
  if (!prof?.client_id) return;
  const class_id = String(formData.get("class_id"));
  if (!class_id || !(await classHasRoom(supabase, class_id))) return;
  await supabase.from("class_bookings").insert({ class_id, client_id: prof.client_id });
  revalidatePath("/portal");
}

export async function cancelClassSelf(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data: prof } = await supabase.from("profiles").select("client_id").eq("id", user.id).maybeSingle();
  if (!prof?.client_id) return;
  const class_id = String(formData.get("class_id"));
  await supabase.from("class_bookings").delete().eq("class_id", class_id).eq("client_id", prof.client_id);
  revalidatePath("/portal");
}

// ---- messages / inbox ------------------------------------------------------

export async function sendMessageStaff(formData: FormData) {
  const p = await getProfile();
  if (!p || !canMessage(p.role)) return;
  const client_id = String(formData.get("client_id"));
  const body = String(formData.get("body") ?? "").trim();
  if (!client_id || !body) return;
  const channel = String(formData.get("channel") || "WhatsApp");
  const supabase = createClient();
  await supabase.from("messages").insert({ client_id, sender: "staff", sender_name: p.name, body, channel });
  revalidatePath("/messages");
  revalidatePath(`/messages/${client_id}`);
}

export async function sendMessageSelf(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data: prof } = await supabase.from("profiles").select("client_id, name").eq("id", user.id).maybeSingle();
  if (!prof?.client_id) return;
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;
  await supabase.from("messages").insert({ client_id: prof.client_id, sender: "client", sender_name: prof.name, body });
  revalidatePath("/portal");
}

export async function markThreadRead(clientId: string) {
  const p = await getProfile();
  if (!p || !canMessage(p.role)) return;
  const supabase = createClient();
  await supabase.from("messages").update({ read: true }).eq("client_id", clientId).eq("sender", "client").eq("read", false);
  revalidatePath("/messages");
}

// ---- billing / invoices ----------------------------------------------------

async function nextInvoiceNum(supabase: ReturnType<typeof createClient>) {
  const { data } = await supabase.from("invoices").select("num").order("num", { ascending: false }).limit(1).maybeSingle();
  return ((data?.num as number | null) ?? 0) + 1;
}

export async function createInvoice(formData: FormData) {
  const p = await getProfile();
  if (!p || !canManageInvoices(p.role)) return;
  const client_id = String(formData.get("client_id")) || null;
  const description = String(formData.get("description") ?? "").trim() || "Invoice";
  const amount = Number(formData.get("amount")) || 0;
  const method = String(formData.get("method") ?? "").trim() || null;
  const supabase = createClient();
  const num = await nextInvoiceNum(supabase);
  await supabase.from("invoices").insert({
    num, client_id, description, amount, method, status: "Unpaid", issued_date: todayISO(), created_by: p.name,
  });
  await logAudit(p, "Invoice created", description, `₹${amount}`);
  // best-effort email to the client (logs 'skipped' until email is configured)
  if (client_id) {
    const { data: c } = await supabase.from("clients").select("name, email").eq("id", client_id).maybeSingle();
    if (c?.email) await notifyEmail({ supabase, to: c.email, clientId: client_id, template: "invoice", tpl: tplInvoiceCreated(c.name ?? "there", `INV-${String(num).padStart(3, "0")}`, amount, description), actor: p.name });
  }
  revalidatePath("/billing");
  if (client_id) revalidatePath(`/clients/${client_id}`);
}

export async function markInvoicePaid(formData: FormData) {
  const p = await getProfile();
  if (!p || !canManageInvoices(p.role)) return;
  const id = String(formData.get("id"));
  const method = String(formData.get("method") ?? "").trim() || "Cash";
  const supabase = createClient();
  await supabase.from("invoices").update({ status: "Paid", paid_date: todayISO(), method }).eq("id", id);
  await logAudit(p, "Invoice marked paid", null, method);
  revalidatePath("/billing");
  revalidatePath("/", "layout");
}

export async function refundInvoice(formData: FormData) {
  const p = await getProfile();
  if (!p || !canManageInvoices(p.role)) return;
  const id = String(formData.get("id"));
  const supabase = createClient();
  await supabase.from("invoices").update({ status: "Refunded" }).eq("id", id);
  await logAudit(p, "Invoice refunded", null, null);
  revalidatePath("/billing");
  revalidatePath("/", "layout");
}

// ---- subscriptions / recurring billing -------------------------------------

function addDays(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function createSubscription(formData: FormData) {
  const p = await getProfile();
  if (!p || !canBill(p.role)) return;
  const client_id = String(formData.get("client_id"));
  const package_id = String(formData.get("package_id"));
  const auto_renew = String(formData.get("auto_renew") ?? "true") === "true";
  if (!client_id || !package_id) return;
  const supabase = createClient();
  const { data: pkg } = await supabase.from("packages").select("price, validity, name").eq("id", package_id).maybeSingle();
  const interval = pkg?.validity ?? 30;
  const start = todayISO();
  await supabase.from("subscriptions").insert({
    client_id, package_id, amount: pkg?.price ?? 0, interval_days: interval,
    status: "active", auto_renew, start_date: start, renews_on: addDays(start, interval),
  });
  await logAudit(p, "Subscription created", pkg?.name ?? package_id, null);
  revalidatePath("/subscriptions");
}

export async function setSubStatus(formData: FormData) {
  const p = await getProfile();
  if (!p || !canBill(p.role)) return;
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  if (!["active", "paused", "cancelled"].includes(status)) return;
  const supabase = createClient();
  await supabase.from("subscriptions").update({ status }).eq("id", id);
  await logAudit(p, "Subscription " + status, null, null);
  revalidatePath("/subscriptions");
}

export async function toggleAutoRenew(formData: FormData) {
  const p = await getProfile();
  if (!p || !canBill(p.role)) return;
  const id = String(formData.get("id"));
  const value = String(formData.get("value")) === "true";
  const supabase = createClient();
  await supabase.from("subscriptions").update({ auto_renew: !value }).eq("id", id);
  revalidatePath("/subscriptions");
}

async function renewOne(supabase: ReturnType<typeof createClient>, sub: { id: string; client_id: string; package_id: string | null; amount: number; interval_days: number; renews_on: string | null }, actor: string) {
  const num = await nextInvoiceNum(supabase);
  const { data: pkg } = await supabase.from("packages").select("name").eq("id", sub.package_id ?? "").maybeSingle();
  await supabase.from("invoices").insert({
    num, client_id: sub.client_id, description: `${pkg?.name ?? "Subscription"} — renewal`,
    amount: sub.amount, status: "Unpaid", issued_date: todayISO(), created_by: actor,
  });
  const base = sub.renews_on && sub.renews_on > todayISO() ? sub.renews_on : todayISO();
  await supabase.from("subscriptions").update({ renews_on: addDays(base, sub.interval_days) }).eq("id", sub.id);
}

export async function renewNow(formData: FormData) {
  const p = await getProfile();
  if (!p || !canBill(p.role)) return;
  const id = String(formData.get("id"));
  const supabase = createClient();
  const { data: sub } = await supabase.from("subscriptions").select("id, client_id, package_id, amount, interval_days, renews_on").eq("id", id).maybeSingle();
  if (sub) { await renewOne(supabase, sub, p.name); await logAudit(p, "Subscription renewed (manual)", null, null); }
  revalidatePath("/subscriptions");
}

export async function processDueRenewals() {
  const p = await getProfile();
  if (!p || !canBill(p.role)) return;
  const supabase = createClient();
  const { data: due } = await supabase
    .from("subscriptions").select("id, client_id, package_id, amount, interval_days, renews_on")
    .eq("status", "active").eq("auto_renew", true).lte("renews_on", todayISO());
  for (const sub of (due ?? [])) await renewOne(supabase, sub, p.name);
  await logAudit(p, "Processed due renewals", null, `${(due ?? []).length} renewed`);
  revalidatePath("/subscriptions");
  revalidatePath("/billing");
}

// ---- EMR: problems / allergies / meds / vitals / SOAP ----------------------

const emrText = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim() || null;
const emrNum = (fd: FormData, k: string) => {
  const v = fd.get(k);
  if (v === null || String(v).trim() === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
};
async function emrGuard() {
  const p = await getProfile();
  if (!p || !canEmr(p.role)) return null;
  return p;
}
async function clientName(supabase: ReturnType<typeof createClient>, id: string) {
  const { data } = await supabase.from("clients").select("name").eq("id", id).maybeSingle();
  return data?.name ?? null;
}

export async function addProblem(formData: FormData) {
  const p = await emrGuard(); if (!p) return;
  const client_id = String(formData.get("client_id"));
  const description = emrText(formData, "description");
  if (!client_id || !description) return;
  const supabase = createClient();
  await supabase.from("problems").insert({
    client_id, description, code: emrText(formData, "code"),
    onset_date: emrText(formData, "onset_date"), status: "active", noted_by: p.name,
  });
  await logAudit(p, "Problem added", await clientName(supabase, client_id), description);
  revalidatePath(`/emr/${client_id}`);
}

export async function resolveProblem(formData: FormData) {
  const p = await emrGuard(); if (!p) return;
  const id = String(formData.get("id"));
  const client_id = String(formData.get("client_id"));
  const to = String(formData.get("to") || "resolved");
  const supabase = createClient();
  await supabase.from("problems").update({
    status: to, resolved_date: to === "resolved" ? todayISO() : null,
  }).eq("id", id);
  await logAudit(p, `Problem → ${to}`, null, null);
  revalidatePath(`/emr/${client_id}`);
}

export async function addAllergy(formData: FormData) {
  const p = await emrGuard(); if (!p) return;
  const client_id = String(formData.get("client_id"));
  const substance = emrText(formData, "substance");
  if (!client_id || !substance) return;
  const supabase = createClient();
  await supabase.from("allergies").insert({
    client_id, substance, reaction: emrText(formData, "reaction"),
    severity: String(formData.get("severity") || "moderate"), noted_by: p.name,
  });
  await logAudit(p, "Allergy added", await clientName(supabase, client_id), substance);
  revalidatePath(`/emr/${client_id}`);
}

export async function deleteAllergy(formData: FormData) {
  const p = await emrGuard(); if (!p) return;
  const id = String(formData.get("id"));
  const client_id = String(formData.get("client_id"));
  const supabase = createClient();
  await supabase.from("allergies").delete().eq("id", id);
  await logAudit(p, "Allergy removed (entered in error)", null, null);
  revalidatePath(`/emr/${client_id}`);
}

export async function addMedication(formData: FormData) {
  const p = await emrGuard(); if (!p) return;
  const client_id = String(formData.get("client_id"));
  const name = emrText(formData, "name");
  if (!client_id || !name) return;
  const supabase = createClient();
  await supabase.from("medications").insert({
    client_id, name, dose: emrText(formData, "dose"), frequency: emrText(formData, "frequency"),
    route: String(formData.get("route") || "oral"), start_date: emrText(formData, "start_date") ?? todayISO(),
    status: "active", prescriber: p.name, notes: emrText(formData, "notes"),
  });
  await logAudit(p, "Medication added", await clientName(supabase, client_id), name);
  revalidatePath(`/emr/${client_id}`);
}

export async function stopMedication(formData: FormData) {
  const p = await emrGuard(); if (!p) return;
  const id = String(formData.get("id"));
  const client_id = String(formData.get("client_id"));
  const supabase = createClient();
  await supabase.from("medications").update({ status: "stopped", end_date: todayISO() }).eq("id", id);
  await logAudit(p, "Medication stopped", null, null);
  revalidatePath(`/emr/${client_id}`);
}

export async function addVitals(formData: FormData) {
  const p = await emrGuard(); if (!p) return;
  const client_id = String(formData.get("client_id"));
  if (!client_id) return;
  const supabase = createClient();
  await supabase.from("vitals").insert({
    client_id, date: String(formData.get("date") || todayISO()),
    systolic: emrNum(formData, "systolic"), diastolic: emrNum(formData, "diastolic"),
    pulse: emrNum(formData, "pulse"), temp_c: emrNum(formData, "temp_c"),
    resp_rate: emrNum(formData, "resp_rate"), spo2: emrNum(formData, "spo2"),
    weight: emrNum(formData, "weight"), height: emrNum(formData, "height"),
    notes: emrText(formData, "notes"), recorded_by: p.name,
  });
  await logAudit(p, "Vitals recorded", await clientName(supabase, client_id), null);
  revalidatePath(`/emr/${client_id}`);
}

export async function addEncounter(formData: FormData) {
  const p = await emrGuard(); if (!p) return;
  const client_id = String(formData.get("client_id"));
  if (!client_id) return;
  const supabase = createClient();
  await supabase.from("encounters").insert({
    client_id, date: String(formData.get("date") || todayISO()),
    type: String(formData.get("type") || "Office visit"),
    chief_complaint: emrText(formData, "chief_complaint"),
    subjective: emrText(formData, "subjective"), objective: emrText(formData, "objective"),
    assessment: emrText(formData, "assessment"), plan: emrText(formData, "plan"),
    provider: p.name,
  });
  await logAudit(p, "Encounter documented", await clientName(supabase, client_id), emrText(formData, "chief_complaint"));
  revalidatePath(`/emr/${client_id}`);
}

// ---- access & check-in -----------------------------------------------------

export async function recordCheckin(formData: FormData) {
  const p = await getProfile();
  if (!p || !canWrite(p.role)) return;
  const client_id = String(formData.get("client_id") || "") || null;
  const guest_name = String(formData.get("guest_name") ?? "").trim() || null;
  if (!client_id && !guest_name) return;
  const supabase = createClient();
  await supabase.from("checkins").insert({
    client_id, guest_name,
    method: String(formData.get("method") || "manual"),
    direction: String(formData.get("direction") || "in"),
    note: String(formData.get("note") ?? "").trim() || null,
    by_name: p.name,
  });
  await logAudit(p, `Check-${String(formData.get("direction") || "in") === "out" ? "out" : "in"}`, client_id ? await clientName(supabase, client_id) : guest_name, null);
  revalidatePath("/access");
}

// ---- tablet intake (kiosk lead capture) ------------------------------------

// Full tablet self-registration → a submission the front desk reviews & adds.
export async function submitTabletIntake(formData: FormData) {
  const p = await getProfile();
  if (!p || !canWrite(p.role)) return;
  const first = String(formData.get("first_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  if (!first) return;
  const goals = formData.getAll("goals").map((g) => String(g)).filter(Boolean);
  const supabase = createClient();
  await supabase.from("tablet_submissions").insert({
    first_name: first,
    last_name: String(formData.get("last_name") ?? "").trim() || null,
    phone: phone || null,
    email: String(formData.get("email") ?? "").trim() || null,
    dob: String(formData.get("dob") ?? "").trim() || null,
    gender: String(formData.get("gender") ?? "") || null,
    occupation: String(formData.get("occupation") ?? "").trim() || null,
    emergency: String(formData.get("emergency") ?? "").trim() || null,
    height: Number(formData.get("height")) || null,
    weight: Number(formData.get("weight")) || null,
    conditions: String(formData.get("conditions") ?? "").trim() || null,
    goals,
    street: String(formData.get("street") ?? "").trim() || null,
    city: String(formData.get("city") ?? "").trim() || null,
    state: String(formData.get("state") ?? "").trim() || null,
    postal: String(formData.get("postal") ?? "").trim() || null,
    ref_id: String(formData.get("ref_id") ?? "").trim() || null,
    tnc: String(formData.get("tnc")) === "Agree",
    consent: String(formData.get("consent")) === "Agree",
    status: "pending",
  });
  await logAudit(p, "Tablet intake submitted", `${first} ${String(formData.get("last_name") ?? "")}`.trim(), null);
  await notifyRoles(supabase, ["Administrator", "Manager", "Front Desk"], { title: "New tablet intake", body: first, href: "/clients", icon: "🖊" });
  redirect("/intake?done=1");
}

// ---- HR onboarding ---------------------------------------------------------

const DEFAULT_ONBOARDING_STEPS = ["Documents collected", "Offer letter shared", "System accounts created", "Attendance setup", "Orientation & SOP walkthrough"];

export async function addOnboarding(formData: FormData) {
  const p = await getProfile();
  if (!p || !canHr(p.role)) return;
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const supabase = createClient();
  await supabase.from("onboarding").insert({
    name, role: String(formData.get("role") ?? "").trim() || null,
    joining_date: String(formData.get("joining_date") || "") || null,
    steps: DEFAULT_ONBOARDING_STEPS.map((label) => ({ label, done: false })),
    status: "in_progress", created_by: p.name,
  });
  await logAudit(p, "Onboarding started", name, null);
  revalidatePath("/hr");
}

const DEFAULT_OFFBOARDING_STEPS = ["Handover completed", "Assets returned", "Final settlement inputs", "Exit documents issued"];

export async function addOffboarding(formData: FormData) {
  const p = await getProfile();
  if (!p || !canHr(p.role)) return;
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const supabase = createClient();
  await supabase.from("onboarding").insert({
    name, role: String(formData.get("role") ?? "").trim() || null,
    joining_date: String(formData.get("joining_date") || "") || null, kind: "offboarding",
    steps: DEFAULT_OFFBOARDING_STEPS.map((label) => ({ label, done: false })),
    status: "in_progress", created_by: p.name,
  });
  await logAudit(p, "Offboarding started", name, null);
  revalidatePath("/hr");
}

// ---- HR suite: updates, month-end, payroll, commissions, statutory, hiring ---
export async function addHrUpdate(formData: FormData) {
  const p = await getProfile();
  if (!p || !canHr(p.role)) return;
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;
  const supabase = createClient();
  await supabase.from("hr_updates").insert({ author: p.name, body });
  revalidatePath("/hr");
}

export async function toggleMonthTask(formData: FormData) {
  const p = await getProfile();
  if (!p || !canHr(p.role)) return;
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  const supabase = createClient();
  await supabase.from("hr_month_tasks").update({ status: status === "done" ? "pending" : "done" }).eq("id", id);
  revalidatePath("/hr");
}

export async function generatePayslip(formData: FormData) {
  const p = await getProfile();
  if (!p || !canHr(p.role)) return;
  const staff_id = String(formData.get("staff_id"));
  const month = String(formData.get("month"));
  const base = Number(formData.get("base")) || 0;
  const lop_days = Number(formData.get("lop_days")) || 0;
  const pf = Number(formData.get("pf")) || 1800;
  const perDay = base / 30;
  const net = Math.max(0, base - lop_days * perDay - pf);
  const supabase = createClient();
  await supabase.from("payroll").upsert({ staff_id, month, base, lop_days, pf, net, payslip: true }, { onConflict: "staff_id,month" });
  await logAudit(p, "Payslip generated", null, month);
  revalidatePath("/hr");
}

export async function addCommission(formData: FormData) {
  const p = await getProfile();
  if (!p || !canHr(p.role)) return;
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const supabase = createClient();
  await supabase.from("hr_commissions").insert({
    name, kind: String(formData.get("kind") || "Commission"),
    amount: Number(formData.get("amount")) || 0, tds: Number(formData.get("tds")) || 0,
  });
  revalidatePath("/hr");
}

export async function fileStatutory(formData: FormData) {
  const p = await getProfile();
  if (!p || !canHr(p.role)) return;
  const supabase = createClient();
  await supabase.from("hr_statutory").update({ status: "filed" }).eq("id", String(formData.get("id")));
  await logAudit(p, "Statutory filed", null, null);
  revalidatePath("/hr");
}

const CAND_STAGES = ["Screening", "Interview", "Offer sent", "Hired"];
export async function advanceCandidate(formData: FormData) {
  const p = await getProfile();
  if (!p || !canHr(p.role)) return;
  const id = String(formData.get("id"));
  const stage = String(formData.get("stage"));
  const next = CAND_STAGES[Math.min(CAND_STAGES.length - 1, CAND_STAGES.indexOf(stage) + 1)];
  const supabase = createClient();
  await supabase.from("hr_candidates").update({ stage: next }).eq("id", id);
  revalidatePath("/hr");
}

export async function setPurchaseStatus(formData: FormData) {
  const p = await getProfile();
  if (!p || !canHr(p.role)) return;
  const supabase = createClient();
  await supabase.from("hr_purchases").update({ status: String(formData.get("status")) }).eq("id", String(formData.get("id")));
  revalidatePath("/hr");
}

export async function toggleOnboardingStep(formData: FormData) {
  const p = await getProfile();
  if (!p || !canHr(p.role)) return;
  const id = String(formData.get("id"));
  const idx = Number(formData.get("idx"));
  const supabase = createClient();
  const { data } = await supabase.from("onboarding").select("steps").eq("id", id).maybeSingle();
  const steps = ((data?.steps as { label: string; done: boolean }[] | null) ?? []).map((s, i) => i === idx ? { ...s, done: !s.done } : s);
  const status = steps.length && steps.every((s) => s.done) ? "complete" : "in_progress";
  await supabase.from("onboarding").update({ steps, status }).eq("id", id);
  revalidatePath("/hr");
}

export async function removeOnboarding(formData: FormData) {
  const p = await getProfile();
  if (!p || !canHr(p.role)) return;
  const supabase = createClient();
  await supabase.from("onboarding").delete().eq("id", String(formData.get("id")));
  revalidatePath("/hr");
}

// ---- in-app notifications --------------------------------------------------

export async function markNotificationRead(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("notifications").update({ read: true }).eq("id", String(formData.get("id"))).eq("user_id", user.id);
  revalidatePath("/", "layout");
}

export async function markAllNotificationsRead() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
  revalidatePath("/", "layout");
}

// mark one read, then go to its target
export async function openNotification(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const id = String(formData.get("id"));
  const href = String(formData.get("href") || "");
  if (user) await supabase.from("notifications").update({ read: true }).eq("id", id).eq("user_id", user.id);
  revalidatePath("/", "layout");
  if (href) redirect(href);
}

// ---- HR: attendance / leave / payroll --------------------------------------

export async function markAttendance(formData: FormData) {
  const p = await getProfile();
  if (!p || !canHr(p.role)) return;
  const staff_id = String(formData.get("staff_id"));
  const status = String(formData.get("status"));
  if (!staff_id || !["present", "absent", "leave", "half"].includes(status)) return;
  const supabase = createClient();
  await supabase.from("attendance").upsert(
    { staff_id, date: String(formData.get("date") || todayISO()), status, marked_by: p.name },
    { onConflict: "staff_id,date" }
  );
  revalidatePath("/hr");
}

export async function addLeave(formData: FormData) {
  const p = await getProfile();
  if (!p || !canHr(p.role)) return;
  const staff_id = String(formData.get("staff_id"));
  const from_date = String(formData.get("from_date") || "");
  const to_date = String(formData.get("to_date") || from_date);
  if (!staff_id || !from_date) return;
  const supabase = createClient();
  await supabase.from("leaves").insert({
    staff_id, from_date, to_date,
    type: String(formData.get("type") || "Casual"),
    reason: String(formData.get("reason") ?? "").trim() || null,
    status: "pending",
  });
  await logAudit(p, "Leave requested", null, null);
  await notifyRoles(supabase, ["Administrator", "Manager", "HR"], { title: "New leave request", body: `${from_date}${to_date !== from_date ? ` → ${to_date}` : ""}`, href: "/hr?tab=leave", icon: "🌴" });
  revalidatePath("/hr");
}

export async function setLeaveStatus(formData: FormData) {
  const p = await getProfile();
  if (!p || !canHr(p.role)) return;
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  if (!["pending", "approved", "rejected"].includes(status)) return;
  const supabase = createClient();
  await supabase.from("leaves").update({ status, decided_by: p.name }).eq("id", id);
  await logAudit(p, `Leave ${status}`, null, null);
  revalidatePath("/hr");
}

export async function upsertPayroll(formData: FormData) {
  const p = await getProfile();
  if (!p || !canHr(p.role)) return;
  const staff_id = String(formData.get("staff_id"));
  const month = String(formData.get("month") || todayISO().slice(0, 7));
  const base = Number(formData.get("base")) || 0;
  const lop_days = Number(formData.get("lop_days")) || 0;
  if (!staff_id) return;
  const net = Math.max(0, Math.round(base - (base / 30) * lop_days));
  const supabase = createClient();
  await supabase.from("payroll").upsert(
    { staff_id, month, base, lop_days, net, status: "pending" },
    { onConflict: "staff_id,month" }
  );
  revalidatePath("/hr");
}

export async function payPayroll(formData: FormData) {
  const p = await getProfile();
  if (!p || !canHr(p.role)) return;
  const id = String(formData.get("id"));
  const supabase = createClient();
  await supabase.from("payroll").update({ status: "paid", paid_date: todayISO() }).eq("id", id);
  await logAudit(p, "Payroll paid", null, null);
  revalidatePath("/hr");
}

// ---- team tasks ------------------------------------------------------------

export async function addTask(formData: FormData) {
  const p = await getProfile();
  if (!p || !canManageTasks(p.role)) return; // Admin / Manager / HR
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  const supabase = createClient();
  await supabase.from("tasks").insert({
    title,
    assignee_id: String(formData.get("assignee_id") || "") || null,
    client_id: String(formData.get("client_id") || "") || null,
    type: String(formData.get("type") || "Ops"),
    priority: String(formData.get("priority") || "Medium"),
    due_date: String(formData.get("due_date") || "") || null,
    status: "todo", created_by: p.name,
  });
  await logAudit(p, "Task created", title, null);
  revalidatePath("/tasks");
}

export async function setTaskStatus(formData: FormData) {
  const p = await getProfile();
  if (!p) return;
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  if (!["todo", "doing", "blocked", "done"].includes(status)) return;
  const supabase = createClient();
  await supabase.from("tasks").update({ status }).eq("id", id);
  revalidatePath("/tasks");
}

// Nudge the team about a task (in-app notification to Admin/Manager + audit).
export async function remindTask(formData: FormData) {
  const p = await getProfile();
  if (!p) return;
  const id = String(formData.get("id"));
  const supabase = createClient();
  const { data: t } = await supabase.from("tasks").select("title, staff:assignee_id(name)").eq("id", id).maybeSingle();
  const title = (t as { title?: string } | null)?.title ?? "task";
  const who = (t as { staff?: { name: string } | null } | null)?.staff?.name;
  await notifyRoles(supabase, ["Administrator", "Manager"], { title: "Task reminder", body: `${title}${who ? ` · ${who}` : ""}`, href: "/tasks", icon: "⏰" });
  await logAudit(p, "Task reminder sent", title, null);
  revalidatePath("/tasks");
}

export async function deleteTask(formData: FormData) {
  const p = await getProfile();
  if (!p) return;
  const supabase = createClient();
  await supabase.from("tasks").delete().eq("id", String(formData.get("id")));
  revalidatePath("/tasks");
}

// ---- exercise library ------------------------------------------------------

export async function addExercise(formData: FormData) {
  const p = await getProfile();
  if (!p || !canConsult(p.role)) return;
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const supabase = createClient();
  await supabase.from("exercises").insert({
    name, mode: String(formData.get("mode") || "Offline"), type: String(formData.get("type") || "Strength"),
  });
  await logAudit(p, "Exercise added", name, null);
  revalidatePath("/exlib");
}

export async function toggleExercise(formData: FormData) {
  const p = await getProfile();
  if (!p || !canConsult(p.role)) return;
  const supabase = createClient();
  await supabase.from("exercises").update({ active: String(formData.get("to") || "true") === "true" }).eq("id", String(formData.get("id")));
  revalidatePath("/exlib");
}

export async function assignWorkout(formData: FormData) {
  const p = await getProfile();
  if (!p || !canConsult(p.role)) return;
  const client_id = String(formData.get("client_id"));
  const template_id = String(formData.get("template_id"));
  if (!client_id || !template_id) return;
  const supabase = createClient();
  const { data: tpl } = await supabase.from("workout_templates").select("name, mode, type, items").eq("id", template_id).maybeSingle();
  if (!tpl) return;
  await supabase.from("client_workouts").insert({
    client_id, name: tpl.name, mode: tpl.mode, type: tpl.type, items: tpl.items, assigned_by: p.name,
  });
  await logAudit(p, "Workout assigned", await clientName(supabase, client_id), tpl.name);
  revalidatePath("/exlib");
  revalidatePath(`/clients/${client_id}`);
}

export async function removeWorkout(formData: FormData) {
  const p = await getProfile();
  if (!p || !canConsult(p.role)) return;
  const id = String(formData.get("id"));
  const client_id = String(formData.get("client_id"));
  const supabase = createClient();
  await supabase.from("client_workouts").delete().eq("id", id);
  await logAudit(p, "Workout removed", null, null);
  revalidatePath(`/clients/${client_id}`);
}

export async function addTemplate(formData: FormData) {
  const p = await getProfile();
  if (!p || !canConsult(p.role)) return;
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  let items: { exercise: string; sets?: string; reps?: string; rest?: string }[] = [];
  try { items = JSON.parse(String(formData.get("items") || "[]")); } catch { items = []; }
  items = items.filter((i) => i.exercise && i.exercise.trim());
  const supabase = createClient();
  await supabase.from("workout_templates").insert({
    name, mode: String(formData.get("mode") || "Offline"), type: String(formData.get("type") || "Strength"),
    items, created_by: p.name,
  });
  await logAudit(p, "Workout template created", name, `${items.length} exercises`);
  revalidatePath("/exlib");
}

// ---- finance sheets: payables / estimates / ledger -------------------------

export async function addPayable(formData: FormData) {
  const p = await getProfile();
  if (!p || !canClaims(p.role)) return; // Admin / Manager / Finance
  const vendor = String(formData.get("vendor") ?? "").trim();
  if (!vendor) return;
  const supabase = createClient();
  await supabase.from("payables").insert({
    vendor, item: String(formData.get("item") ?? "").trim() || null,
    amount: Number(formData.get("amount")) || 0,
    due_date: String(formData.get("due_date") || "") || null,
    status: "Unpaid", created_by: p.name,
  });
  await logAudit(p, "Payable added", vendor, null);
  revalidatePath("/finsheets");
}

export async function payPayable(formData: FormData) {
  const p = await getProfile();
  if (!p || !canClaims(p.role)) return;
  const supabase = createClient();
  await supabase.from("payables").update({ status: "Paid" }).eq("id", String(formData.get("id")));
  await logAudit(p, "Payable paid", null, null);
  revalidatePath("/finsheets");
}

export async function addEstimate(formData: FormData) {
  const p = await getProfile();
  if (!p || !canClaims(p.role)) return;
  const lead_name = String(formData.get("lead_name") ?? "").trim();
  if (!lead_name) return;
  const supabase = createClient();
  await supabase.from("estimates").insert({
    lead_name, item: String(formData.get("item") ?? "").trim() || null,
    amount: Number(formData.get("amount")) || 0,
    date: String(formData.get("date") || todayISO()),
    status: String(formData.get("status") || "Sent"), created_by: p.name,
  });
  await logAudit(p, "Estimate created", lead_name, null);
  revalidatePath("/finsheets");
}

export async function setEstimateStatus(formData: FormData) {
  const p = await getProfile();
  if (!p || !canClaims(p.role)) return;
  const status = String(formData.get("status"));
  if (!["Draft", "Sent", "Accepted", "Expired"].includes(status)) return;
  const supabase = createClient();
  await supabase.from("estimates").update({ status }).eq("id", String(formData.get("id")));
  await logAudit(p, `Estimate ${status}`, null, null);
  revalidatePath("/finsheets");
}

export async function addLedgerEntry(formData: FormData) {
  const p = await getProfile();
  if (!p || !canClaims(p.role)) return;
  const account = String(formData.get("account") || "bank");
  const amount = Number(formData.get("amount")) || 0;
  if (!amount) return;
  const supabase = createClient();
  await supabase.from("ledger").insert({
    account, date: String(formData.get("date") || todayISO()),
    ref: String(formData.get("ref") ?? "").trim() || null,
    party: String(formData.get("party") ?? "").trim() || null,
    kind: String(formData.get("kind") ?? "").trim() || (account === "cash" ? "Cash" : "NEFT"),
    direction: String(formData.get("direction") || "in"),
    amount, created_by: p.name,
  });
  await logAudit(p, `${account} entry`, null, `${formData.get("direction")} ₹${amount}`);
  revalidatePath("/finsheets");
}

// ---- operating expenses ----------------------------------------------------

export async function addExpense(formData: FormData) {
  const p = await getProfile();
  if (!p || !canBill(p.role)) return;
  const description = String(formData.get("description") ?? "").trim();
  if (!description) return;
  const supabase = createClient();
  await supabase.from("expenses").insert({
    description,
    category: String(formData.get("category") || "Other"),
    amount: Number(formData.get("amount")) || 0,
    date: String(formData.get("date") || todayISO()),
    created_by: p.name,
  });
  await logAudit(p, "Expense added", description, `₹${Number(formData.get("amount")) || 0}`);
  revalidatePath("/expenses");
}

export async function deleteExpense(formData: FormData) {
  const p = await getProfile();
  if (!p || !canBill(p.role)) return;
  const supabase = createClient();
  await supabase.from("expenses").delete().eq("id", String(formData.get("id")));
  await logAudit(p, "Expense removed", null, null);
  revalidatePath("/expenses");
}

// ---- SOPs / knowledge base -------------------------------------------------

export async function addSop(formData: FormData) {
  const p = await getProfile();
  if (!p || !canManageSops(p.role)) return;
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  const supabase = createClient();
  await supabase.from("sops").insert({
    title, category: String(formData.get("category") || "Operations"),
    content: String(formData.get("content") ?? "").trim() || null,
    updated_by: p.name,
  });
  await logAudit(p, "SOP added", title, null);
  revalidatePath("/kb");
}

export async function deleteSop(formData: FormData) {
  const p = await getProfile();
  if (!p || !canManageSops(p.role)) return;
  const supabase = createClient();
  await supabase.from("sops").delete().eq("id", String(formData.get("id")));
  await logAudit(p, "SOP removed", null, null);
  revalidatePath("/kb");
}

// ---- services catalogue ----------------------------------------------------

export async function addService(formData: FormData) {
  const p = await getProfile();
  if (!p || !canManageServices(p.role)) return;
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const dayRaw = formData.get("day_offset");
  const day_offset = dayRaw && String(dayRaw).trim() !== "" ? Number(dayRaw) : null;
  const supabase = createClient();
  await supabase.from("services").insert({
    name, category: String(formData.get("category") || "General"),
    mode: String(formData.get("mode") || "Offline"),
    slot_based: String(formData.get("slot_based") || "") === "on",
    day_offset: Number.isNaN(day_offset as number) ? null : day_offset,
  });
  await logAudit(p, "Service added", name, null);
  revalidatePath("/services");
}

export async function toggleService(formData: FormData) {
  const p = await getProfile();
  if (!p || !canManageServices(p.role)) return;
  const id = String(formData.get("id"));
  const to = String(formData.get("to") || "true") === "true";
  const supabase = createClient();
  await supabase.from("services").update({ active: to }).eq("id", id);
  await logAudit(p, `Service ${to ? "activated" : "deactivated"}`, null, null);
  revalidatePath("/services");
}

// ---- monthly sales targets -------------------------------------------------

export async function setSalesTarget(formData: FormData) {
  const p = await getProfile();
  if (!p || !canSetTargets(p.role)) return; // Administrator only
  const month = String(formData.get("month") || todayISO().slice(0, 7));
  const supabase = createClient();
  await supabase.from("sales_targets").upsert({
    month,
    revenue_target: Number(formData.get("revenue_target")) || 0,
    new_clients_target: Number(formData.get("new_clients_target")) || 0,
    renewals_target: Number(formData.get("renewals_target")) || 0,
    set_by: p.name, updated_at: new Date().toISOString(),
  }, { onConflict: "month" });
  await logAudit(p, "Sales targets set", month, null);
  revalidatePath("/targets");
}

// ---- front-desk follow-up queue --------------------------------------------

export async function generateFollowups() {
  const p = await getProfile();
  if (!p || !canWrite(p.role)) return;
  const supabase = createClient();
  // Same package scoping as the cron — the onboarding protocol only belongs to
  // Comprehensive clients.
  const [{ data: clients }, { data: subs }, { data: cps }] = await Promise.all([
    supabase.from("clients").select("id, joined"),
    supabase.from("subscriptions").select("client_id, renews_on").eq("status", "active"),
    supabase.from("client_packages").select("client_id, category").eq("status", "active"),
  ]);
  const catOf = new Map(
    ((cps ?? []) as { client_id: string; category: string | null }[]).map((r) => [r.client_id, r.category]),
  );
  const rows = buildFollowupRows(
    ((clients ?? []) as { id: string; joined: string | null }[])
      .map((c) => ({ ...c, category: catOf.get(c.id) ?? null })),
    (subs ?? []) as { client_id: string; renews_on: string | null }[],
    p.name,
  );
  if (rows.length) await supabase.from("followups").upsert(rows, { onConflict: "client_id,label", ignoreDuplicates: true });
  await logAudit(p, "Follow-ups generated", null, `${rows.length} touchpoints`);
  revalidatePath("/followups");
}

export async function completeFollowup(formData: FormData) {
  const p = await getProfile();
  if (!p || !canWrite(p.role)) return;
  const id = String(formData.get("id"));
  const supabase = createClient();
  await supabase.from("followups").update({
    status: "done", note: String(formData.get("note") ?? "").trim() || null,
    done_by: p.name, done_at: new Date().toISOString(),
  }).eq("id", id);
  await logAudit(p, "Follow-up completed", null, null);
  revalidatePath("/followups");
  revalidatePath("/dashboard");
}

export async function skipFollowup(formData: FormData) {
  const p = await getProfile();
  if (!p || !canWrite(p.role)) return;
  const id = String(formData.get("id"));
  const supabase = createClient();
  await supabase.from("followups").update({ status: "skipped", done_by: p.name, done_at: new Date().toISOString() }).eq("id", id);
  await logAudit(p, "Follow-up skipped", null, null);
  revalidatePath("/followups");
}

// ---- follow-up queue pipeline (call → link → review → closed) --------------
async function fuGuard() { const p = await getProfile(); return p && canWrite(p.role) ? p : null; }

export async function fuSendQuestionnaire(formData: FormData) {
  const p = await fuGuard(); if (!p) return;
  const id = String(formData.get("id"));
  const token = "QT-" + Math.random().toString(36).slice(2, 8).toUpperCase();
  const supabase = createClient();
  await supabase.from("followups").update({ stage: "LINK_SENT", token, no_answer: false }).eq("id", id);
  await logAudit(p, "Follow-up questionnaire sent", null, token);
  revalidatePath("/followups");
}

export async function fuSendReminder(formData: FormData) {
  const p = await fuGuard(); if (!p) return;
  const id = String(formData.get("id"));
  const supabase = createClient();
  await supabase.from("followups").update({ reminder_sent: true }).eq("id", id);
  await logAudit(p, "Follow-up reminder sent", null, null);
  revalidatePath("/followups");
}

export async function fuNoAnswer(formData: FormData) {
  const p = await fuGuard(); if (!p) return;
  const id = String(formData.get("id"));
  const supabase = createClient();
  await supabase.from("followups").update({ no_answer: true }).eq("id", id);
  await logAudit(p, "Follow-up — no answer", null, null);
  revalidatePath("/followups");
}

export async function fuBookInPerson(formData: FormData) {
  const p = await fuGuard(); if (!p) return;
  const id = String(formData.get("id"));
  const supabase = createClient();
  await supabase.from("followups").update({ stage: "BOOKED", status: "done", done_by: p.name, done_at: new Date().toISOString() }).eq("id", id);
  await logAudit(p, "Follow-up booked in-person", null, null);
  revalidatePath("/followups");
}

export async function fuNoConsult(formData: FormData) {
  const p = await fuGuard(); if (!p) return;
  const id = String(formData.get("id"));
  const supabase = createClient();
  await supabase.from("followups").update({ stage: "NO_CONSULT", status: "skipped", done_by: p.name, done_at: new Date().toISOString() }).eq("id", id);
  await logAudit(p, "Follow-up — no consultation", null, null);
  revalidatePath("/followups");
}

export async function fuMarkReceived(formData: FormData) {
  const p = await fuGuard(); if (!p) return;
  const id = String(formData.get("id"));
  const supabase = createClient();
  await supabase.from("followups").update({ stage: "PENDING_REVIEW" }).eq("id", id);
  await logAudit(p, "Follow-up answers received", null, null);
  revalidatePath("/followups");
}

export async function fuCompleteReview(formData: FormData) {
  const p = await fuGuard(); if (!p) return;
  const id = String(formData.get("id"));
  const summary = String(formData.get("summary") ?? "").trim();
  if (!summary) return;
  const supabase = createClient();
  await supabase.from("followups").update({ stage: "COMPLETED", status: "done", summary, done_by: p.name, done_at: new Date().toISOString() }).eq("id", id);
  await logAudit(p, "Follow-up review completed", null, null);
  revalidatePath("/followups");
  revalidatePath("/dashboard");
}

export async function addFollowup(formData: FormData) {
  const p = await getProfile();
  if (!p || !canWrite(p.role)) return;
  const client_id = String(formData.get("client_id"));
  const label = String(formData.get("label") ?? "").trim();
  const due_date = String(formData.get("due_date") || todayISO());
  if (!client_id || !label) return;
  const supabase = createClient();
  await supabase.from("followups").upsert(
    { client_id, kind: "custom", label, due_date, priority: String(formData.get("priority") || "normal"), created_by: p.name },
    { onConflict: "client_id,label", ignoreDuplicates: true }
  );
  await logAudit(p, "Follow-up added", await clientName(supabase, client_id), label);
  revalidatePath("/followups");
}

// ---- comms templates & campaigns -------------------------------------------

export async function createTemplate(formData: FormData) {
  const p = await getProfile();
  if (!p || !canCampaigns(p.role)) return;
  const name = String(formData.get("name") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!name || !subject || !body) return;
  const supabase = createClient();
  await supabase.from("message_templates").insert({
    name, subject, body, channel: String(formData.get("channel") || "WhatsApp"),
    category: String(formData.get("category") || "General"), active: true, created_by: p.name,
  });
  await logAudit(p, "Template created", name, null);
  revalidatePath("/campaigns");
  revalidatePath("/messages");
}

export async function archiveTemplate(formData: FormData) {
  const p = await getProfile();
  if (!p || !canCampaigns(p.role)) return;
  const supabase = createClient();
  await supabase.from("message_templates").update({ active: false }).eq("id", String(formData.get("id")));
  await logAudit(p, "Template archived", null, null);
  revalidatePath("/campaigns");
}

export async function createCampaign(formData: FormData) {
  const p = await getProfile();
  if (!p || !canCampaigns(p.role)) return;
  const name = String(formData.get("name") ?? "").trim();
  const template_id = String(formData.get("template_id") || "") || null;
  if (!name || !template_id) return;
  const supabase = createClient();
  await supabase.from("campaigns").insert({
    name, template_id, audience: String(formData.get("audience") || "all"),
    status: "draft", created_by: p.name,
  });
  await logAudit(p, "Campaign created", name, null);
  revalidatePath("/campaigns");
}

// Resolve an audience to recipient clients (id, name, email).
async function resolveAudience(supabase: ReturnType<typeof createClient>, audience: string) {
  const { data: clients } = await supabase.from("clients").select("id, name, email, package_id").not("email", "is", null);
  let list = ((clients ?? []) as { id: string; name: string; email: string | null; package_id: string | null }[]).filter((c) => c.email);

  if (audience === "members") {
    list = list.filter((c) => c.package_id);
  } else if (audience === "subscribers") {
    const { data: subs } = await supabase.from("subscriptions").select("client_id").eq("status", "active");
    const set = new Set(((subs ?? []) as { client_id: string }[]).map((s) => s.client_id));
    list = list.filter((c) => set.has(c.id));
  } else if (audience === "lapsed") {
    const { data: recent } = await supabase.from("sessions").select("client_id, date").gte("date", addDays(todayISO(), -30));
    const active = new Set(((recent ?? []) as { client_id: string }[]).map((s) => s.client_id));
    list = list.filter((c) => !active.has(c.id));
  }
  return list;
}

export async function sendCampaignNow(formData: FormData) {
  const p = await getProfile();
  if (!p || !canCampaigns(p.role)) return;
  const id = String(formData.get("id"));
  const supabase = createClient();
  const { data: camp } = await supabase.from("campaigns").select("id, name, audience, status, template_id").eq("id", id).maybeSingle();
  if (!camp || camp.status === "sent") return;
  const { data: tpl } = await supabase.from("message_templates").select("subject, body").eq("id", camp.template_id ?? "").maybeSingle();
  if (!tpl) return;

  const recipients = await resolveAudience(supabase, camp.audience);
  let count = 0;
  for (const c of recipients) {
    if (!c.email) continue;
    const subject = tpl.subject.replace(/\{\{\s*name\s*\}\}/g, c.name);
    const html = tpl.body.replace(/\{\{\s*name\s*\}\}/g, c.name);
    let result;
    try { result = await sendEmail(c.email, subject, html); }
    catch { result = { status: "failed" as const, error: "Unexpected" }; }
    await supabase.from("email_log").insert({
      to_email: c.email, client_id: c.id, template: `campaign:${camp.name}`, subject,
      status: result.status, provider: "resend",
      provider_id: "providerId" in result ? result.providerId ?? null : null,
      error: "error" in result ? result.error ?? null : null,
      created_by: p.name,
    });
    count++;
  }
  await supabase.from("campaigns").update({ status: "sent", sent_count: count, sent_at: new Date().toISOString() }).eq("id", id);
  await logAudit(p, "Campaign sent", camp.name, `${count} recipients`);
  revalidatePath("/campaigns");
}

// ---- wearables sync --------------------------------------------------------

export async function addWearableReading(formData: FormData) {
  const p = await getProfile();
  if (!p || !canConsult(p.role)) return;
  const client_id = String(formData.get("client_id"));
  if (!client_id) return;
  const n = (k: string) => {
    const v = formData.get(k);
    if (v === null || String(v).trim() === "") return null;
    const x = Number(v);
    return Number.isNaN(x) ? null : Math.round(x);
  };
  const supabase = createClient();
  await supabase.from("wearable_readings").upsert(
    { client_id, date: String(formData.get("date") || todayISO()), source: "manual",
      steps: n("steps"), resting_hr: n("resting_hr"), sleep_min: n("sleep_min"), active_min: n("active_min"), calories: n("calories") },
    { onConflict: "client_id,date,source" }
  );
  await logAudit(p, "Wearable reading added", await clientName(supabase, client_id), null);
  revalidatePath(`/clients/${client_id}`);
}

export async function setWearableConnection(formData: FormData) {
  const p = await getProfile();
  if (!p || !canConsult(p.role)) return;
  const client_id = String(formData.get("client_id"));
  const provider = String(formData.get("provider"));
  const status = String(formData.get("status") || "connected");
  if (!client_id || !provider) return;
  const supabase = createClient();
  await supabase.from("wearable_connections").upsert(
    { client_id, provider, status, connected_at: new Date().toISOString() },
    { onConflict: "client_id,provider" }
  );
  await logAudit(p, `Wearable ${status}`, await clientName(supabase, client_id), provider);
  revalidatePath(`/clients/${client_id}`);
}

// ---- habits & streaks ------------------------------------------------------

export async function createHabit(formData: FormData) {
  const p = await getProfile();
  if (!p || !canConsult(p.role)) return;
  const client_id = String(formData.get("client_id"));
  const name = String(formData.get("name") ?? "").trim();
  if (!client_id || !name) return;
  const supabase = createClient();
  await supabase.from("habits").insert({
    client_id, name,
    cadence: String(formData.get("cadence") || "daily"),
    target_per_week: Number(formData.get("target_per_week")) || 7,
    icon: String(formData.get("icon") || "✅"),
    active: true, created_by: p.name,
  });
  await logAudit(p, "Habit assigned", await clientName(supabase, client_id), name);
  revalidatePath(`/clients/${client_id}`);
}

export async function archiveHabit(formData: FormData) {
  const p = await getProfile();
  if (!p || !canConsult(p.role)) return;
  const id = String(formData.get("id"));
  const client_id = String(formData.get("client_id"));
  const supabase = createClient();
  await supabase.from("habits").update({ active: false }).eq("id", id);
  await logAudit(p, "Habit archived", null, null);
  revalidatePath(`/clients/${client_id}`);
}

// client checks a habit on/off for today (portal)
export async function toggleHabitSelf(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data: prof } = await supabase.from("profiles").select("client_id").eq("id", user.id).maybeSingle();
  if (!prof?.client_id) return;
  const habit_id = String(formData.get("habit_id"));
  const done = String(formData.get("done") || "true") === "true";
  // ensure the habit belongs to this client
  const { data: h } = await supabase.from("habits").select("id, client_id").eq("id", habit_id).maybeSingle();
  if (!h || h.client_id !== prof.client_id) return;
  await supabase.from("habit_logs").upsert(
    { habit_id, client_id: prof.client_id, date: todayISO(), done },
    { onConflict: "habit_id,date" }
  );
  revalidatePath("/portal");
}

// ---- appointments / calendar -----------------------------------------------

export async function createAppointment(formData: FormData) {
  const p = await getProfile();
  if (!p || !canAppointments(p.role)) return;
  const client_id = String(formData.get("client_id"));
  const date = String(formData.get("date") || "");
  if (!client_id || !date) return;
  const supabase = createClient();
  await supabase.from("appointments").insert({
    client_id,
    provider_id: String(formData.get("provider_id") || "") || null,
    type: String(formData.get("type") || "Consultation"),
    title: String(formData.get("title") ?? "").trim() || null,
    date, hour: Number(formData.get("hour")) || 9,
    duration_min: Number(formData.get("duration_min")) || 30,
    location: String(formData.get("location") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
    status: "scheduled", created_by: p.name,
  });
  // An initial booking is what decides the client's doctor / dietitian /
  // psychologist, so re-run the engine here. Existing assignments are kept,
  // meaning only the first booking in each discipline sticks.
  await assignCareTeam(supabase, client_id, {
    slot: { date, hour: Number(formData.get("hour")) || 9 }, actor: p.name,
  });

  await logAudit(p, "Appointment booked", await clientName(supabase, client_id), date);
  revalidatePath("/appointments");
  revalidatePath("/clients");
}

export async function setAppointmentStatus(formData: FormData) {
  const p = await getProfile();
  if (!p || !canAppointments(p.role)) return;
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  if (!["scheduled", "completed", "cancelled", "no_show"].includes(status)) return;
  const supabase = createClient();
  await supabase.from("appointments").update({ status }).eq("id", id);
  await logAudit(p, `Appointment → ${status}`, null, null);
  revalidatePath("/appointments");
}

export async function rescheduleAppointment(formData: FormData) {
  const p = await getProfile();
  if (!p || !canAppointments(p.role)) return;
  const id = String(formData.get("id"));
  const date = String(formData.get("date") || "");
  const hour = Number(formData.get("hour"));
  const patch: Record<string, unknown> = {};
  if (date) patch.date = date;
  if (!Number.isNaN(hour)) patch.hour = hour;
  if (Object.keys(patch).length === 0) return;
  const supabase = createClient();
  await supabase.from("appointments").update(patch).eq("id", id);
  await logAudit(p, "Appointment rescheduled", null, date);
  revalidatePath("/appointments");
}

// ---- email notifications (key-ready scaffold) ------------------------------

// Best-effort notifier: sends via provider when configured, always logs the
// attempt to email_log. Never throws — safe to call from other actions.
async function notifyEmail(opts: {
  supabase: ReturnType<typeof createClient>;
  to: string | null | undefined;
  clientId?: string | null;
  template: string;
  tpl: Template;
  actor?: string | null;
}) {
  const { supabase, to, clientId, template, tpl, actor } = opts;
  if (!to) return;
  let result;
  try { result = await sendEmail(to, tpl.subject, tpl.html); }
  catch { result = { status: "failed" as const, error: "Unexpected" }; }
  try {
    await supabase.from("email_log").insert({
      to_email: to, client_id: clientId ?? null, template, subject: tpl.subject,
      status: result.status, provider: "resend",
      provider_id: "providerId" in result ? result.providerId ?? null : null,
      error: "error" in result ? result.error ?? null : null,
      created_by: actor ?? null,
    });
  } catch { /* logging must never break the caller */ }
}

export async function sendTestEmail(formData: FormData) {
  const p = await getProfile();
  if (!p || !canCompliance(p.role)) return;
  const to = String(formData.get("to") ?? "").trim();
  const template = String(formData.get("template") || "welcome");
  const name = String(formData.get("name") ?? "there").trim() || "there";
  if (!to) return;
  const supabase = createClient();
  await notifyEmail({ supabase, to, template, tpl: renderChoice(template, name), actor: p.name });
  await logAudit(p, "Test email attempted", to, template);
  revalidatePath("/notifications");
}

// ---- online payments (key-ready scaffold) ----------------------------------

// Create a gateway order for an unpaid invoice. Returns {configured:false}
// until payment env vars are set — the UI shows a friendly notice in that case.
export async function startInvoicePayment(formData: FormData) {
  const p = await getProfile();
  if (!p || !canBill(p.role)) return { configured: false as const, error: "Not permitted" };
  const cfg = paymentConfig();
  if (!cfg.configured) return { configured: false as const };

  const id = String(formData.get("id"));
  const supabase = createClient();
  const { data: inv } = await supabase.from("invoices").select("id, num, amount, status, description").eq("id", id).maybeSingle();
  if (!inv || inv.status !== "Unpaid") return { configured: true as const, ok: false, error: "Invoice not payable" };

  try {
    if (cfg.provider === "razorpay") {
      const order = await createRazorpayOrder(Number(inv.amount), `INV-${inv.num ?? id.slice(0, 6)}`, { invoice_id: id });
      await supabase.from("invoices").update({ gateway: "razorpay", gateway_order_id: order.id }).eq("id", id);
      return {
        configured: true as const, ok: true, provider: "razorpay" as const,
        orderId: order.id, amount: order.amount, currency: order.currency,
        keyId: cfg.publicKeyId, invoiceId: id,
        description: inv.description ?? `Invoice INV-${inv.num ?? ""}`,
      };
    }
    return { configured: true as const, ok: false, error: `Provider ${cfg.provider} not wired for checkout yet` };
  } catch (e) {
    return { configured: true as const, ok: false, error: e instanceof Error ? e.message : "Gateway error" };
  }
}

// Confirm a completed checkout (verifies signature server-side) and mark paid.
export async function confirmInvoicePayment(formData: FormData) {
  const p = await getProfile();
  if (!p || !canBill(p.role)) return { ok: false, error: "Not permitted" };
  const id = String(formData.get("id"));
  const orderId = String(formData.get("order_id"));
  const paymentId = String(formData.get("payment_id"));
  const signature = String(formData.get("signature"));
  if (!verifyCheckoutSignature(orderId, paymentId, signature)) {
    return { ok: false, error: "Signature verification failed" };
  }
  const supabase = createClient();
  await supabase.from("invoices").update({
    status: "Paid", paid_date: todayISO(), method: "Online",
    gateway: "razorpay", gateway_order_id: orderId, gateway_payment_id: paymentId,
  }).eq("id", id);
  await logAudit(p, "Invoice paid online", `INV ${id.slice(0, 6)}`, paymentId);
  // best-effort receipt email
  const { data: inv } = await supabase.from("invoices").select("num, amount, client_id, clients(name, email)").eq("id", id).maybeSingle();
  const invc = inv as unknown as { num: number | null; amount: number; client_id: string | null; clients: { name: string | null; email: string | null } | null } | null;
  if (invc?.clients?.email) await notifyEmail({ supabase, to: invc.clients.email, clientId: invc.client_id, template: "payment", tpl: tplPaymentReceived(invc.clients.name ?? "there", `INV-${String(invc.num ?? 0).padStart(3, "0")}`, Number(invc.amount)), actor: p.name });
  revalidatePath("/billing");
  return { ok: true };
}

// ---- dynamic intake / consent forms ----------------------------------------

export async function createForm(formData: FormData) {
  const p = await getProfile();
  if (!p || !canWrite(p.role)) return;
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  let fields: { label: string; kind: string }[] = [];
  try { fields = JSON.parse(String(formData.get("fields") || "[]")); } catch { fields = []; }
  fields = fields.filter((f) => f.label && f.label.trim());
  const supabase = createClient();
  await supabase.from("forms").insert({
    name, type: String(formData.get("type") || "intake"), fields, active: true, created_by: p.name,
  });
  await logAudit(p, "Form created", name, null);
  revalidatePath("/forms");
}

export async function assignForm(formData: FormData) {
  const p = await getProfile();
  if (!p || !canWrite(p.role)) return;
  const form_id = String(formData.get("form_id"));
  const client_id = String(formData.get("client_id"));
  if (!form_id || !client_id) return;
  const supabase = createClient();
  await supabase.from("form_responses").insert({ form_id, client_id, answers: {}, status: "pending" });
  await logAudit(p, "Form assigned", await clientName(supabase, client_id), null);
  revalidatePath("/forms");
}

// staff- or client-submitted answers. answers is a JSON string of {label: value}.
export async function submitFormResponse(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const id = String(formData.get("id"));
  let answers: Record<string, string> = {};
  try { answers = JSON.parse(String(formData.get("answers") || "{}")); } catch { answers = {}; }
  const signed_by = String(formData.get("signed_by") ?? "").trim() || null;
  await supabase.from("form_responses").update({
    answers, status: "completed", signed_by, signed_at: new Date().toISOString(),
  }).eq("id", id);
  revalidatePath("/forms");
  revalidatePath("/portal");
}

// ---- telehealth video sessions ---------------------------------------------

export async function createTelehealthSession(formData: FormData) {
  const p = await getProfile();
  if (!p || !canConsult(p.role)) return;
  const client_id = String(formData.get("client_id") || "") || null;
  const cfg = telehealthConfig();
  const slug = "Cureocity-" + crypto.randomUUID().slice(0, 8);
  const room_url = `${cfg.baseUrl.replace(/\/$/, "")}/${slug}`;
  const supabase = createClient();
  await supabase.from("telehealth_sessions").insert({
    client_id, provider: cfg.provider, room_url, status: "scheduled",
    scheduled_for: String(formData.get("scheduled_for") || "") || null,
    created_by: p.name,
  });
  await logAudit(p, "Telehealth session created", client_id ? await clientName(supabase, client_id) : null, null);
  revalidatePath("/telehealth");
}

export async function setTelehealthStatus(formData: FormData) {
  const p = await getProfile();
  if (!p || !canConsult(p.role)) return;
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  if (!["scheduled", "active", "ended"].includes(status)) return;
  const supabase = createClient();
  const patch: Record<string, unknown> = { status };
  if (status === "active") patch.started_at = new Date().toISOString();
  if (status === "ended") patch.ended_at = new Date().toISOString();
  await supabase.from("telehealth_sessions").update(patch).eq("id", id);
  revalidatePath("/telehealth");
}

// ---- national health identity (ABHA / UHID) --------------------------------

export async function setClientIdentity(formData: FormData) {
  const p = await getProfile();
  if (!p || !canCompliance(p.role)) return;
  const client_id = String(formData.get("client_id"));
  if (!client_id) return;
  const supabase = createClient();
  await supabase.from("clients").update({
    abha_id: String(formData.get("abha_id") ?? "").trim() || null,
    uhid: String(formData.get("uhid") ?? "").trim() || null,
  }).eq("id", client_id);
  await logAudit(p, "Health identity updated", await clientName(supabase, client_id), null);
  revalidatePath("/compliance");
  revalidatePath(`/clients/${client_id}`);
}

// ---- compliance & governance -----------------------------------------------

async function complianceGuard() {
  const p = await getProfile();
  if (!p || !canCompliance(p.role)) return null;
  return p;
}

export async function addConsent(formData: FormData) {
  const p = await complianceGuard(); if (!p) return;
  const client_id = String(formData.get("client_id"));
  const type = String(formData.get("type") ?? "").trim();
  if (!client_id || !type) return;
  const supabase = createClient();
  await supabase.from("consents").insert({
    client_id, type, granted: true,
    method: String(formData.get("method") || "signed"),
    granted_date: String(formData.get("granted_date") || todayISO()),
    expires_date: String(formData.get("expires_date") || "") || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
    recorded_by: p.name,
  });
  await logAudit(p, "Consent recorded", await clientName(supabase, client_id), type);
  revalidatePath("/compliance");
}

export async function revokeConsent(formData: FormData) {
  const p = await complianceGuard(); if (!p) return;
  const id = String(formData.get("id"));
  const supabase = createClient();
  await supabase.from("consents").update({ granted: false, revoked_date: todayISO() }).eq("id", id);
  await logAudit(p, "Consent revoked", null, null);
  revalidatePath("/compliance");
}

export async function addBreach(formData: FormData) {
  const p = await complianceGuard(); if (!p) return;
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  const supabase = createClient();
  await supabase.from("breach_incidents").insert({
    title,
    description: String(formData.get("description") ?? "").trim() || null,
    severity: String(formData.get("severity") || "medium"),
    affected_count: Number(formData.get("affected_count")) || 0,
    discovered_date: String(formData.get("discovered_date") || todayISO()),
    status: "open", created_by: p.name,
  });
  await logAudit(p, "Breach incident logged", title, null);
  revalidatePath("/compliance");
}

export async function setBreachStatus(formData: FormData) {
  const p = await complianceGuard(); if (!p) return;
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  if (!["open", "investigating", "contained", "closed"].includes(status)) return;
  const supabase = createClient();
  const patch: Record<string, unknown> = { status };
  if (String(formData.get("report") || "") === "1") {
    patch.reported_to_authority = true;
    patch.reported_date = todayISO();
  }
  await supabase.from("breach_incidents").update(patch).eq("id", id);
  await logAudit(p, `Breach → ${status}`, null, null);
  revalidatePath("/compliance");
}

export async function addRetentionPolicy(formData: FormData) {
  const p = await complianceGuard(); if (!p) return;
  const data_type = String(formData.get("data_type") ?? "").trim();
  if (!data_type) return;
  const supabase = createClient();
  await supabase.from("retention_policies").insert({
    data_type, retain_years: Number(formData.get("retain_years")) || 7,
    legal_basis: String(formData.get("legal_basis") ?? "").trim() || null,
    action_after: String(formData.get("action_after") || "archive"),
  });
  await logAudit(p, "Retention policy added", data_type, null);
  revalidatePath("/compliance");
}

// ---- insurance & claims ----------------------------------------------------

async function claimsGuard() {
  const p = await getProfile();
  if (!p || !canClaims(p.role)) return null;
  return p;
}

export async function addInsurer(formData: FormData) {
  const p = await claimsGuard(); if (!p) return;
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const supabase = createClient();
  await supabase.from("insurers").insert({
    name, kind: String(formData.get("kind") || "private"),
    contact: String(formData.get("contact") ?? "").trim() || null,
  });
  await logAudit(p, "Insurer added", name, null);
  revalidatePath("/claims");
}

export async function addPolicy(formData: FormData) {
  const p = await claimsGuard(); if (!p) return;
  const client_id = String(formData.get("client_id"));
  const insurer_id = String(formData.get("insurer_id") || "") || null;
  if (!client_id) return;
  const supabase = createClient();
  await supabase.from("insurance_policies").insert({
    client_id, insurer_id,
    policy_number: String(formData.get("policy_number") ?? "").trim() || null,
    plan_name: String(formData.get("plan_name") ?? "").trim() || null,
    coverage_amount: Number(formData.get("coverage_amount")) || 0,
    valid_from: String(formData.get("valid_from") || "") || null,
    valid_to: String(formData.get("valid_to") || "") || null,
    status: "active",
  });
  await logAudit(p, "Insurance policy added", await clientName(supabase, client_id), null);
  revalidatePath("/claims");
}

function nextClaimNumber() {
  const d = new Date();
  return `CLM-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}-${Math.floor(1000 + Math.random() * 9000)}`;
}

export async function createClaim(formData: FormData) {
  const p = await claimsGuard(); if (!p) return;
  const client_id = String(formData.get("client_id"));
  if (!client_id) return;
  const supabase = createClient();
  const policy_id = String(formData.get("policy_id") || "") || null;
  let insurer_id: string | null = null;
  if (policy_id) {
    const { data: pol } = await supabase.from("insurance_policies").select("insurer_id").eq("id", policy_id).maybeSingle();
    insurer_id = (pol?.insurer_id as string | null) ?? null;
  }
  await supabase.from("claims").insert({
    client_id, policy_id, insurer_id,
    claim_number: nextClaimNumber(),
    service_desc: String(formData.get("service_desc") ?? "").trim() || null,
    amount_claimed: Number(formData.get("amount_claimed")) || 0,
    status: "draft", created_by: p.name,
  });
  await logAudit(p, "Claim created", await clientName(supabase, client_id), null);
  revalidatePath("/claims");
}

export async function setClaimStatus(formData: FormData) {
  const p = await claimsGuard(); if (!p) return;
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  if (!["draft", "submitted", "in_review", "approved", "rejected", "paid"].includes(status)) return;
  const supabase = createClient();
  const patch: Record<string, unknown> = { status };
  if (status === "submitted") patch.submitted_date = todayISO();
  if (status === "approved" || status === "rejected") {
    patch.decision_date = todayISO();
    if (status === "approved") {
      const approved = Number(formData.get("amount_approved"));
      if (!Number.isNaN(approved)) patch.amount_approved = approved;
    }
  }
  const note = String(formData.get("notes") ?? "").trim();
  if (note) patch.notes = note;
  await supabase.from("claims").update(patch).eq("id", id);
  await logAudit(p, `Claim → ${status}`, null, null);
  revalidatePath("/claims");
}

// ---- e-prescriptions + lab/imaging orders ----------------------------------

export async function createPrescription(formData: FormData) {
  const p = await emrGuard(); if (!p) return { ok: false, error: "Not permitted" };
  const client_id = String(formData.get("client_id"));
  if (!client_id) return { ok: false, error: "No patient" };
  let items: { drug: string; dose?: string; frequency?: string; route?: string; duration?: string; quantity?: string; instructions?: string }[] = [];
  try { items = JSON.parse(String(formData.get("items") || "[]")); } catch { items = []; }
  items = items.filter((i) => i.drug && i.drug.trim());
  if (items.length === 0) return { ok: false, error: "No drugs added" };

  const supabase = createClient();
  const status = String(formData.get("status") || "signed"); // draft | signed
  const { data: rx } = await supabase.from("prescriptions").insert({
    client_id, status,
    notes: String(formData.get("notes") ?? "").trim() || null,
    flags: String(formData.get("flags") ?? "").trim() || null,
    provider: p.name,
    signed_date: status === "signed" ? todayISO() : null,
  }).select("id").maybeSingle();
  if (!rx) return { ok: false, error: "Could not create" };

  await supabase.from("prescription_items").insert(items.map((i) => ({
    prescription_id: rx.id, drug: i.drug.trim(),
    dose: i.dose?.trim() || null, frequency: i.frequency?.trim() || null,
    route: i.route?.trim() || "oral", duration: i.duration?.trim() || null,
    quantity: i.quantity?.trim() || null, instructions: i.instructions?.trim() || null,
  })));
  await logAudit(p, `Prescription ${status}`, await clientName(supabase, client_id), `${items.length} drug(s)`);
  revalidatePath(`/emr/${client_id}`);
  return { ok: true };
}

export async function setPrescriptionStatus(formData: FormData) {
  const p = await emrGuard(); if (!p) return;
  const id = String(formData.get("id"));
  const client_id = String(formData.get("client_id"));
  const status = String(formData.get("status"));
  if (!["draft", "signed", "dispensed", "cancelled"].includes(status)) return;
  const supabase = createClient();
  const patch: Record<string, unknown> = { status };
  if (status === "signed") patch.signed_date = todayISO();
  await supabase.from("prescriptions").update(patch).eq("id", id);
  await logAudit(p, `Prescription → ${status}`, null, null);
  revalidatePath(`/emr/${client_id}`);
}

export async function createOrder(formData: FormData) {
  const p = await emrGuard(); if (!p) return;
  const client_id = String(formData.get("client_id"));
  const test = String(formData.get("test") ?? "").trim();
  if (!client_id || !test) return;
  const supabase = createClient();
  await supabase.from("orders").insert({
    client_id, test,
    category: String(formData.get("category") || "lab"),
    priority: String(formData.get("priority") || "routine"),
    notes: String(formData.get("notes") ?? "").trim() || null,
    status: "ordered", provider: p.name,
  });
  await logAudit(p, "Order placed", await clientName(supabase, client_id), test);
  revalidatePath(`/emr/${client_id}`);
  revalidatePath("/orders");
}

export async function setOrderStatus(formData: FormData) {
  const p = await emrGuard(); if (!p) return;
  const id = String(formData.get("id"));
  const client_id = String(formData.get("client_id") || "");
  const status = String(formData.get("status"));
  if (!["ordered", "collected", "resulted", "cancelled"].includes(status)) return;
  const supabase = createClient();
  const patch: Record<string, unknown> = { status };
  if (status === "resulted") {
    patch.result = String(formData.get("result") ?? "").trim() || null;
    patch.result_date = todayISO();
  }
  await supabase.from("orders").update(patch).eq("id", id);
  await logAudit(p, `Order → ${status}`, null, null);
  if (client_id) revalidatePath(`/emr/${client_id}`);
  revalidatePath("/orders");
}

// ---- gym passes + retail POS -----------------------------------------------

export async function sellPass(formData: FormData) {
  const p = await getProfile();
  if (!p || !canPos(p.role)) return;
  const pass_type_id = String(formData.get("pass_type_id"));
  if (!pass_type_id) return;
  const supabase = createClient();
  const { data: pt } = await supabase.from("pass_types").select("name, price, valid_days, entries").eq("id", pass_type_id).maybeSingle();
  if (!pt) return;
  const client_id = String(formData.get("client_id") || "") || null;
  const guest_name = String(formData.get("guest_name") ?? "").trim() || null;
  const method = String(formData.get("method") ?? "Cash");
  const validUntil = addDays(todayISO(), Number(pt.valid_days) || 1);
  const { data: pass } = await supabase.from("passes").insert({
    pass_type_id, client_id, guest_name,
    guest_phone: String(formData.get("guest_phone") ?? "").trim() || null,
    name: pt.name, price: pt.price, entries_total: pt.entries, entries_used: 0,
    valid_until: validUntil, status: "active", created_by: p.name,
  }).select("id").maybeSingle();
  // record revenue as a paid invoice
  const num = await nextInvoiceNum(supabase);
  await supabase.from("invoices").insert({
    num, client_id, description: `Pass — ${pt.name}${guest_name ? ` (${guest_name})` : ""}`,
    amount: pt.price, method, status: "Paid", issued_date: todayISO(), paid_date: todayISO(), created_by: p.name,
  });
  await logAudit(p, "Pass sold", pt.name, guest_name ?? "member");
  revalidatePath("/pos");
  revalidatePath("/billing");
  return pass?.id;
}

export async function usePass(formData: FormData) {
  const p = await getProfile();
  if (!p || !canPos(p.role)) return;
  const id = String(formData.get("id"));
  const supabase = createClient();
  const { data: pass } = await supabase.from("passes").select("entries_total, entries_used, status, valid_until, name").eq("id", id).maybeSingle();
  if (!pass || pass.status !== "active") return;
  if (pass.valid_until && pass.valid_until < todayISO()) {
    await supabase.from("passes").update({ status: "expired" }).eq("id", id);
    return;
  }
  const used = Number(pass.entries_used) + 1;
  const status = used >= Number(pass.entries_total) ? "used" : "active";
  await supabase.from("passes").update({ entries_used: used, status }).eq("id", id);
  await logAudit(p, "Pass check-in", pass.name, `${used}/${pass.entries_total}`);
  revalidatePath("/pos");
}

export async function addProduct(formData: FormData) {
  const p = await getProfile();
  if (!p || !canPos(p.role)) return;
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const supabase = createClient();
  await supabase.from("products").insert({
    name,
    sku: String(formData.get("sku") ?? "").trim() || null,
    category: String(formData.get("category") ?? "General").trim() || "General",
    price: Number(formData.get("price")) || 0,
    stock: Number(formData.get("stock")) || 0,
  });
  await logAudit(p, "Product added", name, null);
  revalidatePath("/pos");
}

export async function restockProduct(formData: FormData) {
  const p = await getProfile();
  if (!p || !canPos(p.role)) return;
  const id = String(formData.get("id"));
  const delta = Number(formData.get("delta")) || 0;
  const supabase = createClient();
  const { data: prod } = await supabase.from("products").select("stock, name").eq("id", id).maybeSingle();
  if (!prod) return;
  const next = Math.max(0, Number(prod.stock) + delta);
  await supabase.from("products").update({ stock: next }).eq("id", id);
  await logAudit(p, "Stock adjusted", prod.name, `${delta >= 0 ? "+" : ""}${delta}`);
  revalidatePath("/pos");
}

// POS checkout: cart is a JSON string of [{id, qty}], plus method / client / discount.
export async function recordSale(formData: FormData) {
  const p = await getProfile();
  if (!p || !canPos(p.role)) return { ok: false, error: "Not permitted" };
  let cart: { id: string; qty: number }[] = [];
  try { cart = JSON.parse(String(formData.get("cart") || "[]")); } catch { cart = []; }
  cart = cart.filter((l) => l.id && Number(l.qty) > 0);
  if (cart.length === 0) return { ok: false, error: "Cart is empty" };

  const supabase = createClient();
  const { data: prods } = await supabase.from("products").select("id, name, price, stock").in("id", cart.map((l) => l.id));
  const byId = new Map((prods ?? []).map((pr) => [pr.id, pr]));

  const lines: { product_id: string; name: string; qty: number; unit_price: number; line_total: number }[] = [];
  for (const l of cart) {
    const pr = byId.get(l.id);
    if (!pr) continue;
    const qty = Math.min(Number(l.qty), Number(pr.stock)); // don't oversell
    if (qty <= 0) return { ok: false, error: `${pr.name} is out of stock` };
    lines.push({ product_id: pr.id, name: pr.name, qty, unit_price: Number(pr.price), line_total: Number(pr.price) * qty });
  }
  if (lines.length === 0) return { ok: false, error: "Nothing sellable in cart" };

  const subtotal = lines.reduce((s, l) => s + l.line_total, 0);
  const discount = Math.max(0, Number(formData.get("discount")) || 0);
  const total = Math.max(0, subtotal - discount);
  const method = String(formData.get("method") ?? "Cash");
  const client_id = String(formData.get("client_id") || "") || null;
  const guest_name = String(formData.get("guest_name") ?? "").trim() || null;

  const { data: sale } = await supabase.from("sales").insert({
    client_id, guest_name, subtotal, discount, total, method, created_by: p.name,
  }).select("id").maybeSingle();
  if (!sale) return { ok: false, error: "Could not create sale" };

  await supabase.from("sale_items").insert(lines.map((l) => ({ sale_id: sale.id, ...l })));
  // decrement stock
  for (const l of lines) {
    const pr = byId.get(l.product_id)!;
    await supabase.from("products").update({ stock: Math.max(0, Number(pr.stock) - l.qty) }).eq("id", l.product_id);
  }
  // record revenue as a paid invoice
  const num = await nextInvoiceNum(supabase);
  await supabase.from("invoices").insert({
    num, client_id, description: `Retail sale — ${lines.length} item${lines.length === 1 ? "" : "s"}`,
    amount: total, method, status: "Paid", issued_date: todayISO(), paid_date: todayISO(), created_by: p.name,
  });
  await logAudit(p, "Retail sale", `${lines.length} items`, `₹${total}`);
  revalidatePath("/pos");
  revalidatePath("/billing");
  return { ok: true, total };
}

// ---- retention: NPS + referrals --------------------------------------------

export async function recordNps(formData: FormData) {
  const p = await getProfile();
  if (!p || !canRetention(p.role)) return;
  const client_id = String(formData.get("client_id"));
  const score = Math.max(0, Math.min(10, Number(formData.get("score"))));
  if (!client_id || Number.isNaN(score)) return;
  const supabase = createClient();
  await supabase.from("nps_responses").insert({
    client_id, score,
    comment: String(formData.get("comment") ?? "").trim() || null,
    channel: String(formData.get("channel") ?? "front-desk"),
    created_by: p.name,
  });
  const { data: c } = await supabase.from("clients").select("name").eq("id", client_id).maybeSingle();
  await logAudit(p, `NPS recorded (${score})`, c?.name, null);
  revalidatePath("/retention");
}

// Send a win-back offer to an at-risk client (logs a WhatsApp message).
export async function winbackOffer(formData: FormData) {
  const p = await getProfile();
  if (!p || !canRetention(p.role)) return;
  const client_id = String(formData.get("client_id"));
  if (!client_id) return;
  const supabase = createClient();
  await supabase.from("messages").insert({
    client_id, sender: "staff", sender_name: p.name, channel: "WhatsApp",
    body: "We miss you at Cureocity! Here's 15% off your next package this month — reply to claim. 💚",
  });
  await logAudit(p, "Win-back offer sent", null, null);
  revalidatePath("/retention");
  revalidatePath("/messages");
}

// Send an NPS survey to one client or all active clients (logs messages).
export async function sendNpsSurvey(formData: FormData) {
  const p = await getProfile();
  if (!p || !canRetention(p.role)) return;
  const audience = String(formData.get("audience") || "all");
  const channel = String(formData.get("channel") || "WhatsApp");
  const supabase = createClient();
  let ids: string[] = [];
  if (audience === "all") {
    const { data } = await supabase.from("clients").select("id");
    ids = ((data ?? []) as { id: string }[]).map((c) => c.id);
  } else ids = [audience];
  if (ids.length) {
    await supabase.from("messages").insert(ids.map((client_id) => ({
      client_id, sender: "staff", sender_name: "System", channel,
      body: "How likely are you to recommend Cureocity to a friend? Tap 0–10 to rate us 🙏",
    })));
  }
  await logAudit(p, "NPS survey sent", `${ids.length} client(s)`, null);
  revalidatePath("/retention");
}

export async function awardLoyalty(formData: FormData) {
  const p = await getProfile();
  if (!p || !canRetention(p.role)) return;
  const client_id = String(formData.get("client_id"));
  const pts = Number(formData.get("points")) || 0;
  if (!client_id || !pts) return;
  const supabase = createClient();
  const { data: cur } = await supabase.from("loyalty").select("points").eq("client_id", client_id).maybeSingle();
  const next = Math.max(0, (cur?.points ?? 0) + pts);
  await supabase.from("loyalty").upsert({ client_id, points: next, updated_by: p.name, updated_at: new Date().toISOString() });
  await logAudit(p, `Loyalty ${pts >= 0 ? "+" : ""}${pts} pts`, null, null);
  revalidatePath("/retention");
}

export async function redeemLoyalty(formData: FormData) {
  const p = await getProfile();
  if (!p || !canRetention(p.role)) return;
  const client_id = String(formData.get("client_id"));
  const supabase = createClient();
  const { data: cur } = await supabase.from("loyalty").select("points").eq("client_id", client_id).maybeSingle();
  const have = cur?.points ?? 0;
  if (have < 100) return;
  const credit = Math.floor(have / 100) * 100;
  await supabase.from("loyalty").update({ points: have - credit, updated_by: p.name, updated_at: new Date().toISOString() }).eq("client_id", client_id);
  await supabase.from("messages").insert({ client_id, sender: "staff", sender_name: p.name, channel: "WhatsApp", body: `You redeemed ${credit} points for a ₹${credit.toLocaleString("en-IN")} credit on your account 🎉` });
  await logAudit(p, `Loyalty redeemed ${credit} pts`, null, null);
  revalidatePath("/retention");
}

export async function createReferral(formData: FormData) {
  const p = await getProfile();
  if (!p || !canRetention(p.role)) return;
  const referred_name = String(formData.get("referred_name") ?? "").trim();
  if (!referred_name) return;
  const referrer_id = String(formData.get("referrer_id") || "") || null;
  const supabase = createClient();
  await supabase.from("referrals").insert({
    referrer_id, referred_name,
    referred_phone: String(formData.get("referred_phone") ?? "").trim() || null,
    referred_email: String(formData.get("referred_email") ?? "").trim() || null,
    note: String(formData.get("note") ?? "").trim() || null,
    created_by: p.name,
  });
  await logAudit(p, "Referral added", referred_name, null);
  await notifyRoles(supabase, ["Administrator", "Manager", "Front Desk"], { title: "New referral", body: referred_name, href: "/retention", icon: "🎁" });
  revalidatePath("/retention");
}

export async function setReferralStatus(formData: FormData) {
  const p = await getProfile();
  if (!p || !canRetention(p.role)) return;
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  if (!["invited", "joined", "rewarded"].includes(status)) return;
  const supabase = createClient();
  const patch: Record<string, unknown> = { status };
  if (status === "rewarded") {
    const reward = Number(formData.get("reward_amount"));
    if (!Number.isNaN(reward)) patch.reward_amount = reward;
  }
  await supabase.from("referrals").update(patch).eq("id", id);
  await logAudit(p, `Referral → ${status}`, null, null);
  revalidatePath("/retention");
}

// ---- measurements / InBody -------------------------------------------------

export async function addMeasurement(formData: FormData) {
  const p = await getProfile();
  if (!p || !(canWrite(p.role) || canConsult(p.role))) return;
  const client_id = String(formData.get("client_id"));
  const num = (k: string) => {
    const v = formData.get(k);
    if (v === null || String(v).trim() === "") return null;
    const n = Number(v);
    return Number.isNaN(n) ? null : n;
  };
  const supabase = createClient();
  await supabase.from("measurements").insert({
    client_id,
    date: String(formData.get("date") || todayISO()),
    weight: num("weight"), bmi: num("bmi"), body_fat: num("body_fat"),
    muscle_mass: num("muscle_mass"), visceral_fat: num("visceral_fat"),
    waist: num("waist"), hip: num("hip"), resting_hr: num("resting_hr"),
    notes: String(formData.get("notes") ?? "").trim() || null,
    recorded_by: p.name,
  });
  const { data: c } = await supabase.from("clients").select("name").eq("id", client_id).maybeSingle();
  await logAudit(p, "Measurement recorded", c?.name, null);
  revalidatePath(`/clients/${client_id}`);
}

// ---- meal monitoring -------------------------------------------------------

// client logs a meal / asks a question (portal)
export async function saveMealSelf(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data: prof } = await supabase.from("profiles").select("client_id").eq("id", user.id).maybeSingle();
  if (!prof?.client_id) return;
  const meal = String(formData.get("meal"));
  const description = String(formData.get("description") ?? "").trim() || null;
  const doubt = String(formData.get("doubt") ?? "").trim() || null;
  await supabase.from("meal_logs").upsert(
    { client_id: prof.client_id, date: todayISO(), meal, description, doubt, updated_at: new Date().toISOString() },
    { onConflict: "client_id,date,meal" }
  );
  revalidatePath("/portal");
}

// dietitian: review a logged meal
export async function reviewMeal(formData: FormData) {
  const p = await getProfile();
  if (!p || !canConsult(p.role)) return;
  const client_id = String(formData.get("client_id"));
  const meal = String(formData.get("meal"));
  const review = String(formData.get("review") ?? "").trim() || null;
  const supabase = createClient();
  await supabase.from("meal_logs").upsert(
    { client_id, date: todayISO(), meal, review, updated_at: new Date().toISOString() },
    { onConflict: "client_id,date,meal" }
  );
  revalidatePath("/meals");
}

// dietitian: nudge a missing meal
export async function nudgeMeal(formData: FormData) {
  const p = await getProfile();
  if (!p || !canConsult(p.role)) return;
  const client_id = String(formData.get("client_id"));
  const meal = String(formData.get("meal"));
  const supabase = createClient();
  await supabase.from("meal_logs").upsert(
    { client_id, date: todayISO(), meal, nudged: true, updated_at: new Date().toISOString() },
    { onConflict: "client_id,date,meal" }
  );
  const { data: c } = await supabase.from("clients").select("name").eq("id", client_id).maybeSingle();
  await logAudit(p, "Meal follow-up nudge", c?.name, meal);
  revalidatePath("/meals");
}

// dietitian: answer a client's meal question
export async function answerMealDoubt(formData: FormData) {
  const p = await getProfile();
  if (!p || !canConsult(p.role)) return;
  const client_id = String(formData.get("client_id"));
  const meal = String(formData.get("meal"));
  const answer = String(formData.get("answer") ?? "").trim() || null;
  const supabase = createClient();
  await supabase.from("meal_logs").update({ doubt_answer: answer, updated_at: new Date().toISOString() })
    .eq("client_id", client_id).eq("date", todayISO()).eq("meal", meal);
  revalidatePath("/meals");
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

  // auto-schedule sessions for PT / Comprehensive + create the package invoice
  if (inserted && c.package_id) {
    const { data: pkg } = await supabase
      .from("packages").select("name, price, sessions, is_facility").eq("id", c.package_id).maybeSingle();
    if (pkg && c.joined && !pkg.is_facility && pkg.sessions > 0) {
      await supabase.from("enrollments").insert({ client_id: inserted.id, trainer_id: "t0", hour: 9, session: "PT" });
      await supabase.from("sessions").insert(buildSessions(inserted.id, "t0", 9, c.joined, pkg.sessions));
    }
    if (pkg) {
      const num = await nextInvoiceNum(supabase);
      await supabase.from("invoices").insert({
        num, client_id: inserted.id, description: `${pkg.name} package`, amount: pkg.price ?? 0,
        status: "Unpaid", issued_date: todayISO(), created_by: p.name,
      });
    }
  }
  // mark the tablet submission as added (clears the front-desk banner)
  const subId = String(formData.get("sub_id") || "");
  if (subId) await supabase.from("tablet_submissions").update({ status: "added" }).eq("id", subId);

  await logAudit(p, "Client created", c.name, code);
  revalidatePath("/clients");
  redirect("/clients");
}

export async function setClientOwner(formData: FormData) {
  const p = await getProfile();
  if (!p || !canWrite(p.role)) return;
  const supabase = createClient();
  await supabase.from("clients").update({ owner: String(formData.get("owner") || "") || null }).eq("id", String(formData.get("id")));
  revalidatePath("/clients");
}

export async function updateClientRecord(formData: FormData) {
  const p = await getProfile();
  if (!p || !canWrite(p.role)) return;
  const id = String(formData.get("id"));
  const supabase = createClient();
  const c = parseClientForm(formData);
  await supabase.from("clients").update(c).eq("id", id);
  await logAudit(p, "Client updated", c.name, null);
  revalidatePath("/", "layout");
  redirect(`/clients/${id}`);
}

// ---- workspace: concerns queue + MDT board ---------------------------------

export async function addConcern(formData: FormData) {
  const p = await getProfile();
  if (!p || !canConsult(p.role)) return;
  const client_id = String(formData.get("client_id") || "") || null;
  const role = String(formData.get("role") || "general");
  const category = String(formData.get("category") || "").trim() || null;
  const body = String(formData.get("body") || "").trim();
  if (!body) return;
  const supabase = createClient();
  await supabase.from("concerns").insert({ client_id, role, category, body, raised_by: p.name, status: "Open" });
  await logAudit(p, "Concern raised", category ?? role, null);
  revalidatePath("/workspace");
}

export async function resolveConcern(formData: FormData) {
  const p = await getProfile();
  if (!p || !canConsult(p.role)) return;
  const id = String(formData.get("id"));
  if (!id) return;
  const supabase = createClient();
  await supabase.from("concerns").update({ status: "Resolved", resolved_by: p.name, resolved_at: new Date().toISOString() }).eq("id", id);
  await logAudit(p, "Concern resolved", id, null);
  revalidatePath("/workspace");
}

export async function addMdtNote(formData: FormData) {
  const p = await getProfile();
  if (!p || !canConsult(p.role)) return;
  const client_id = String(formData.get("client_id") || "") || null;
  const body = String(formData.get("body") || "").trim();
  if (!body) return;
  const escalated = String(formData.get("escalated") || "") === "on";
  const to_role = escalated ? (String(formData.get("to_role") || "").trim() || null) : null;
  const supabase = createClient();
  await supabase.from("mdt_notes").insert({
    client_id, author: p.name, body, escalated, to_role, status: escalated ? "Open" : null,
  });
  await logAudit(p, escalated ? "MDT escalation raised" : "MDT update added", to_role ?? null, null);
  revalidatePath("/workspace");
}

export async function acknowledgeMdt(formData: FormData) {
  const p = await getProfile();
  if (!p || !canConsult(p.role)) return;
  const id = String(formData.get("id"));
  if (!id) return;
  const supabase = createClient();
  await supabase.from("mdt_notes").update({ status: "Acknowledged" }).eq("id", id);
  await logAudit(p, "MDT escalation acknowledged", id, null);
  revalidatePath("/workspace");
}

// ---- workspace: resource library -------------------------------------------

export async function uploadResourceFile(_prev: UploadState, formData: FormData): Promise<UploadState> {
  const me = await getProfile();
  if (!me || !canConsult(me.role)) return { error: "Not authorized." };
  const role = String(formData.get("role") || "all");
  const folder = String(formData.get("folder") || "").trim() || "General";
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file to upload." };
  if (file.size > 10 * 1024 * 1024) return { error: "File too large (max 10 MB)." };
  const supabase = createClient();
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${role}/${crypto.randomUUID()}-${safe}`;
  const { error } = await supabase.storage.from("resources").upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (error) return { error: error.message };
  await supabase.from("resource_files").insert({ role, folder, name: file.name, bucket: "resources", path, uploaded_by: me.name });
  await logAudit(me, "Resource uploaded", `${role} · ${folder}`, file.name);
  revalidatePath("/workspace");
  return { ok: "Uploaded." };
}

export async function deleteResourceFile(formData: FormData) {
  const p = await getProfile();
  if (!p || !canConsult(p.role)) return;
  const id = String(formData.get("id"));
  if (!id) return;
  const supabase = createClient();
  const { data: f } = await supabase.from("resource_files").select("path, name").eq("id", id).maybeSingle();
  if (f?.path) await supabase.storage.from("resources").remove([f.path]);
  await supabase.from("resource_files").delete().eq("id", id);
  await logAudit(p, "Resource deleted", f?.name ?? id, null);
  revalidatePath("/workspace");
}

// ---- workspace: diet charts + recipes --------------------------------------

export async function addDietChart(formData: FormData) {
  const p = await getProfile();
  if (!p || !canConsult(p.role) || !canWriteNutrition(p.role)) return; // dietitian-owned
  const client_id = String(formData.get("client_id") || "") || null;
  if (!client_id) return;
  const labels = formData.getAll("meal_label").map((v) => String(v).trim());
  const details = formData.getAll("meal_detail").map((v) => String(v).trim());
  const meals = labels.map((l, i) => [l, details[i] ?? ""]).filter(([l, d]) => l && d);
  if (meals.length === 0) return;
  const supabase = createClient();
  const { count } = await supabase.from("diet_charts").select("id", { count: "exact", head: true }).eq("client_id", client_id);
  const { data: c } = await supabase.from("clients").select("name").eq("id", client_id).maybeSingle();
  await supabase.from("diet_charts").insert({
    client_id, version: (count ?? 0) + 1, status: "Draft",
    calories: Number(formData.get("calories")) || null,
    protein: String(formData.get("protein") || "").trim() || null,
    notes: String(formData.get("notes") || "").trim() || null,
    meals, by_name: p.name,
  });
  await logAudit(p, "Diet chart drafted", c?.name, `v${(count ?? 0) + 1}`);
  revalidatePath("/workspace");
}

export async function publishDietChart(formData: FormData) {
  const p = await getProfile();
  if (!p || !canConsult(p.role) || !canWriteNutrition(p.role)) return; // dietitian-owned
  const id = String(formData.get("id"));
  if (!id) return;
  const supabase = createClient();
  await supabase.from("diet_charts").update({ status: "Published" }).eq("id", id);
  await logAudit(p, "Diet chart published", id, null);
  revalidatePath("/workspace");
}

export async function deleteDietChart(formData: FormData) {
  const p = await getProfile();
  if (!p || !canConsult(p.role) || !canWriteNutrition(p.role)) return; // dietitian-owned
  const id = String(formData.get("id"));
  if (!id) return;
  const supabase = createClient();
  await supabase.from("diet_charts").delete().eq("id", id);
  await logAudit(p, "Diet chart deleted", id, null);
  revalidatePath("/workspace");
}

export async function addRecipe(formData: FormData) {
  const p = await getProfile();
  if (!p || !canConsult(p.role) || !canWriteNutrition(p.role)) return; // dietitian-owned
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  const supabase = createClient();
  await supabase.from("recipes").insert({
    week: String(formData.get("week") || "").trim() || null,
    name,
    tags: String(formData.get("tags") || "").trim() || null,
    kcal: Number(formData.get("kcal")) || null,
    published: String(formData.get("published") || "") === "on",
  });
  await logAudit(p, "Recipe added", name, null);
  revalidatePath("/workspace");
}

export async function toggleRecipe(formData: FormData) {
  const p = await getProfile();
  if (!p || !canConsult(p.role) || !canWriteNutrition(p.role)) return; // dietitian-owned
  const id = String(formData.get("id"));
  const published = String(formData.get("published") || "") === "true";
  if (!id) return;
  const supabase = createClient();
  await supabase.from("recipes").update({ published: !published }).eq("id", id);
  await logAudit(p, published ? "Recipe unpublished" : "Recipe published", id, null);
  revalidatePath("/workspace");
}

export async function deleteRecipe(formData: FormData) {
  const p = await getProfile();
  if (!p || !canConsult(p.role) || !canWriteNutrition(p.role)) return; // dietitian-owned
  const id = String(formData.get("id"));
  if (!id) return;
  const supabase = createClient();
  await supabase.from("recipes").delete().eq("id", id);
  await logAudit(p, "Recipe deleted", id, null);
  revalidatePath("/workspace");
}

// ---- whiteboard: the daily multi-disciplinary meeting ----------------------

/** Open (or reuse) today's board for a branch. */
export async function openWhiteboard(formData: FormData) {
  const p = await getProfile();
  if (!p || !canConsult(p.role)) return;
  const branch = String(formData.get("branch") ?? "") || p.branch || "Kochi";
  const date = String(formData.get("date") ?? "") || todayISO();
  const supabase = createClient();

  const { data: existing } = await supabase.from("whiteboard_sessions")
    .select("id").eq("date", date).eq("branch", branch).maybeSingle();
  if (!existing) {
    await supabase.from("whiteboard_sessions").insert({ date, branch, facilitator: p.name, status: "open" });
    await logAudit(p, "Whiteboard opened", date, branch);
  }
  revalidatePath("/whiteboard");
}

export async function closeWhiteboard(formData: FormData) {
  const p = await getProfile();
  if (!p || !canConsult(p.role)) return;
  const id = String(formData.get("session_id"));
  const supabase = createClient();
  await supabase.from("whiteboard_sessions")
    .update({ status: "closed", closed_at: new Date().toISOString() }).eq("id", id);
  await logAudit(p, "Whiteboard closed", id, null);
  revalidatePath("/whiteboard");
}

/** Put a client on today's board. */
export async function addWhiteboardCard(formData: FormData) {
  const p = await getProfile();
  if (!p || !canConsult(p.role)) return;
  const session_id = String(formData.get("session_id"));
  const client_id = String(formData.get("client_id"));
  if (!session_id || !client_id) return;
  const supabase = createClient();

  const { data: dupe } = await supabase.from("whiteboard_cards")
    .select("id").eq("session_id", session_id).eq("client_id", client_id).maybeSingle();
  if (dupe) return; // already on the board today

  const { count } = await supabase.from("whiteboard_cards")
    .select("id", { count: "exact", head: true }).eq("session_id", session_id);
  await supabase.from("whiteboard_cards").insert({
    session_id, client_id,
    reason: String(formData.get("reason") ?? "") || null,
    origin: String(formData.get("origin") ?? "manual") === "flagged" ? "flagged" : "manual",
    position: count ?? 0, added_by: p.name,
  });
  revalidatePath("/whiteboard");
}

export async function removeWhiteboardCard(formData: FormData) {
  const p = await getProfile();
  if (!p || !canConsult(p.role)) return;
  const supabase = createClient();
  await supabase.from("whiteboard_cards").delete().eq("id", String(formData.get("id")));
  revalidatePath("/whiteboard");
}

/** Mark a card discussed/deferred and record the meeting's takeaway. */
export async function setWhiteboardCardStatus(formData: FormData) {
  const p = await getProfile();
  if (!p || !canConsult(p.role)) return;
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  if (!["pending", "discussed", "deferred"].includes(status)) return;
  const headline = String(formData.get("headline") ?? "").trim();
  const supabase = createClient();
  await supabase.from("whiteboard_cards")
    .update({ status, ...(headline ? { headline } : {}) }).eq("id", id);
  revalidatePath("/whiteboard");
}

/**
 * Adjust the team's working view of a BluePrint score. This never touches the
 * signed-off `blueprints` row — the baseline stays as agreed, and the tweak is
 * layered on top for this meeting.
 */
export async function tweakWhiteboardScore(formData: FormData) {
  const p = await getProfile();
  if (!p || !canConsult(p.role)) return;
  const id = String(formData.get("id"));
  const key = String(formData.get("key"));
  if (!id || !BP_SCORES.some((s) => s.key === key)) return;

  const raw = String(formData.get("score") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const supabase = createClient();

  const { data: card } = await supabase.from("whiteboard_cards")
    .select("score_tweaks").eq("id", id).maybeSingle();
  const tweaks = { ...((card?.score_tweaks ?? {}) as Record<string, unknown>) };

  if (!raw && !note) {
    delete tweaks[key]; // clearing both fields removes the adjustment
  } else {
    const n = Number(raw);
    tweaks[key] = {
      ...(raw !== "" && Number.isFinite(n) ? { score: Math.max(0, Math.min(100, n)) } : {}),
      ...(note ? { note } : {}),
    };
  }

  await supabase.from("whiteboard_cards").update({ score_tweaks: tweaks }).eq("id", id);
  revalidatePath("/whiteboard");
}

/** Capture an insight, action or concern against a card. */
export async function addWhiteboardNote(formData: FormData) {
  const p = await getProfile();
  if (!p || !canConsult(p.role)) return;
  const card_id = String(formData.get("card_id"));
  const body = String(formData.get("body") ?? "").trim();
  if (!card_id || !body) return;
  const kind = String(formData.get("kind") ?? "insight");
  const supabase = createClient();

  await supabase.from("whiteboard_notes").insert({
    card_id, body,
    kind: ["insight", "action", "concern"].includes(kind) ? kind : "insight",
    discipline: wsKeyForRole(p.role) ?? null,
    owner_id: String(formData.get("owner_id") ?? "") || null,
    due_date: String(formData.get("due_date") ?? "") || null,
    author: p.name,
  });

  // a concern raised in the meeting becomes a real concern on the client's file
  if (kind === "concern") {
    const { data: card } = await supabase.from("whiteboard_cards").select("client_id").eq("id", card_id).maybeSingle();
    if (card?.client_id) {
      await supabase.from("concerns").insert({
        client_id: card.client_id, role: wsKeyForRole(p.role) ?? "general",
        category: "Whiteboard", body, raised_by: p.name, status: "Open",
      });
    }
  }

  revalidatePath("/whiteboard");
}

export async function toggleWhiteboardNote(formData: FormData) {
  const p = await getProfile();
  if (!p || !canConsult(p.role)) return;
  const id = String(formData.get("id"));
  const done = String(formData.get("done")) === "true";
  const supabase = createClient();
  await supabase.from("whiteboard_notes").update({ done: !done }).eq("id", id);
  revalidatePath("/whiteboard");
}

// ---- quick drawer ----------------------------------------------------------

/**
 * Everything the Clients-list Quick drawer needs for one client, in a single
 * round trip. The list itself only carries summary columns, so the drawer
 * fetches the rest when it opens rather than bloating every row.
 */
export async function getClientQuickView(clientId: string) {
  const p = await getProfile();
  if (!p || !canSee(p.role, "/clients")) return null;

  const supabase = createClient();
  const today = todayISO();

  const [
    { data: client }, { data: pkgs }, { data: enrol }, { data: sessions },
    { data: invoices }, { data: appts }, { data: bp }, { data: blood },
    { data: consults },
    { data: assessments }, { data: files }, { data: measures }, { data: assigns },
    { data: cpacks },
  ] = await Promise.all([
    supabase.from("clients").select("*").eq("id", clientId).maybeSingle(),
    supabase.from("packages").select("id, name, sessions, validity, price, is_facility"),
    supabase.from("enrollments").select("trainer_id, hour, session, staff(name)").eq("client_id", clientId).maybeSingle(),
    supabase.from("sessions").select("id, seq, date, hour, status, staff(name)").eq("client_id", clientId).order("date"),
    supabase.from("invoices").select("id, num, description, amount, status, issued_date").eq("client_id", clientId).order("num", { ascending: false }),
    supabase.from("appointments").select("id, type, title, date, hour, status, staff(name)").eq("client_id", clientId).order("date", { ascending: false }).limit(8),
    supabase.from("blueprints").select("scores, generated, status").eq("client_id", clientId).maybeSingle(),
    // `requested_on` never existed — the column is `requested_at` (0005_care).
    // PostgREST errored on the select, so `blood` came back null and the first
    // two BluePrint gates in the quick drawer silently read as not-started.
    supabase.from("blood_requests").select("submitted, requested_at, panel").eq("client_id", clientId).order("requested_at"),
    supabase.from("consultations").select("kind, approved, status").eq("client_id", clientId),
    supabase.from("assessments").select("id, kind, due_date, scheduled_date, status, staff(name)").eq("client_id", clientId).order("due_date", { ascending: false }).limit(6),
    supabase.from("files").select("id, name, kind, created_at").eq("client_id", clientId).order("created_at", { ascending: false }).limit(8),
    supabase.from("measurements").select("weight, bmi, body_fat, date").eq("client_id", clientId).order("date", { ascending: false }).limit(1),
    supabase.from("client_assignments").select("discipline, staff_id, method, staff:staff_id(name, role)").eq("client_id", clientId),
    supabase.from("client_packages").select("package_name, category, start_date, end_date, price, status").eq("client_id", clientId).order("start_date", { ascending: false }),
  ]);

  if (!client) return null;

  const pkg = (pkgs ?? []).find((x: { id: string }) => x.id === client.package_id) ?? null;
  const done = (sessions ?? []).filter((s: { status: string }) => s.status === "completed");
  const upcoming = (sessions ?? []).filter((s: { status: string; date: string }) => s.status === "scheduled" && s.date >= today);

  const approved = (kind: string) =>
    (consults ?? []).some((x: { kind: string; approved: boolean }) => x.kind === kind && x.approved);

  return {
    client,
    pkg,
    signoff: { doctor: approved("Doctor"), diet: approved("Diet"), trainer: approved("Trainer") },
    enrolment: enrol ?? null,
    sessions: { total: (sessions ?? []).length, done: done.length, next: upcoming[0] ?? null },
    invoices: invoices ?? [],
    appointments: appts ?? [],
    blueprint: bp ?? null,
    // Multi-panel since 0078: the drawer wants whichever panel is still
    // outstanding, falling back to the latest so a finished client still shows
    // a status rather than a blank gate.
    blood: (() => {
      const rows = (blood ?? []) as { submitted: boolean; requested_at: string | null; panel: string }[];
      return rows.find((b) => !b.submitted) ?? rows[rows.length - 1] ?? null;
    })(),
    assessments: assessments ?? [],
    files: files ?? [],
    measurement: (measures ?? [])[0] ?? null,
    assignments: assigns ?? [],
    clientPackages: cpacks ?? [],
    canWrite: canWrite(p.role),
    canBill: canManageInvoices(p.role),
  };
}
export type ClientQuickView = NonNullable<Awaited<ReturnType<typeof getClientQuickView>>>;

/**
 * Pause or resume a client's package.
 *
 * Pausing stamps `frozen` with today. Resuming banks the elapsed days into
 * `freeze_days` and clears `frozen`, so validity is extended by exactly the
 * time the client was on hold — see lib/package-window.ts for the arithmetic.
 */
export async function togglePackageFreeze(formData: FormData) {
  const p = await getProfile();
  if (!p || !canWrite(p.role)) return;
  const id = String(formData.get("client_id"));
  if (!id) return;

  const supabase = createClient();
  const { data: c } = await supabase
    .from("clients").select("name, frozen, freeze_days").eq("id", id).maybeSingle();
  if (!c) return;

  const today = todayISO();
  if (c.frozen) {
    const banked = Number(c.freeze_days ?? 0)
      + Math.max(0, Math.round((Date.parse(today) - Date.parse(c.frozen)) / 86400000));
    await supabase.from("clients").update({ frozen: null, freeze_days: banked }).eq("id", id);
    await logAudit(p, "Package resumed", c.name, `${banked} day${banked === 1 ? "" : "s"} banked`);
  } else {
    await supabase.from("clients").update({ frozen: today }).eq("id", id);
    await logAudit(p, "Package paused", c.name, `from ${today}`);
  }

  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
}
