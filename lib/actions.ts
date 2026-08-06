"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
const BP_PANEL = "blueprint";
import { getProfile } from "@/lib/auth";
import { HOW_TO_USE, DEFAULT_MEALS, planProblems } from "@/lib/diet-plan";
import { pdfProvider, pdfReadiness, renderUrl, storagePath, fileName, DOC_KINDS, DOC_LABEL, type DocKind } from "@/lib/pdf";
import { sendDocument, watiReadiness, templateFor, normalisePhone } from "@/lib/wati";
import { draftAssessment } from "@/lib/diet-assessment";
import { canSee, canWrite, canWorkFollowups, canManageSessions, canManagePackages, canVoidPackage, canApproveLeaveType, canReviewDietChart, canManageServices, canSetTargets, canManageSops, canManageTasks, canConsult, canManageBlueprint, canBill, canManageInvoices, canRecordPayment, canMessage, canClasses, canRetention, canPos, canEmr, canFinanceOps, canCompliance, canAppointments, canEditAppointments, canCampaigns, canHr, canReimburseSubmit, canReimburseApprove, LEAD_OWNER_ROLES } from "@/lib/roles";
import { BP_SCORES } from "@/lib/blueprint";
import { todayISO } from "@/lib/today";
import { packageCategory, requiresMembership, hasActiveMembership, addDaysISO, MEMBERSHIP_RULE_MSG } from "@/lib/packages";
import { getPersona } from "@/lib/personas";
import { canWriteNutrition, canWriteFitness, ownsConsultKind, wsKeyForRole } from "@/lib/discipline";
import { buildFollowupRows } from "@/lib/followups";
import { directoryDefaults, needsDirectoryRow, staffIdFor, namesMatch } from "@/lib/staff-directory";
import { assignCareTeam } from "@/lib/care-team";
import { isInitialApptType, loadCatOf, normalizeApptTypes } from "@/lib/appt-match";
import { resolveNotificationTarget, nudgeLink } from "@/lib/notification-target";
import { openaiComplete, type AiState } from "@/lib/ai";
import { notifyRoles, notifyStaff, notifyClient } from "@/lib/notify";
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
import {
  PT_CATEGORY,
  INITIAL_BOOKINGS as PT_INITIAL_BOOKINGS,
  PT_BOOKING_LABEL as PT_SESSIONS_LABEL,
  BOOKING_DUE_DAYS as PT_BOOKING_DUE_DAYS,
} from "@/lib/pt";
import { paymentConfig } from "@/lib/payments/config";
import { telehealthConfig } from "@/lib/telehealth/config";
import { ivrConfig } from "@/lib/ivr/config";
import crypto from "crypto";
import { createRazorpayOrder, verifyCheckoutSignature } from "@/lib/payments/razorpay";
import { sendEmail } from "@/lib/email/send";
import { renderChoice, tplInvoiceCreated, tplPaymentReceived, tplLeadEnquiry, type Template } from "@/lib/email/templates";


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
  return { ok: `Created ${email} as ${role}${staffId ? " and linked them to a staff record" : ""}. Share the temporary password with them.` };
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
  // Rescheduling also revives the session to "scheduled" — so a missed session
  // (recorded as cancelled) that the client asks to make up becomes a live
  // upcoming session again at the new slot, rather than staying lost.
  await supabase
    .from("sessions")
    .update({ date, hour, trainer_id, rescheduled: true, status: "scheduled" })
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

const LEAD_FIELDS = ["name", "phone", "email", "source", "campaign", "interest", "urgency", "history", "goals", "location", "budget", "profession", "fde", "objection", "notes"];

export async function createLead(formData: FormData) {
  const p = await getProfile();
  if (!p || !canWrite(p.role)) return;
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const supabase = createClient();

  // Double-submit guard. A walk-in form submitted twice (impatient double-click,
  // or a retried request) produced two identical leads ~1s apart — the front
  // desk then had to spot and clean up the copy. If the same phone was captured
  // in the last 2 minutes, treat this as the same submission and stop.
  const dupPhone = String(formData.get("phone") ?? "").trim();
  if (dupPhone) {
    const since = new Date(Date.now() - 2 * 60_000).toISOString();
    const { data: recent } = await supabase.from("leads")
      .select("id").eq("phone", dupPhone).gte("created_at", since).limit(1);
    if ((recent ?? []).length) return;
  }

  const { data: last } = await supabase.from("leads").select("num").order("num", { ascending: false }).limit(1).maybeSingle();
  const num = ((last?.num as number | null) ?? 0) + 1;
  const row: Record<string, unknown> = { num };
  for (const f of LEAD_FIELDS) row[f] = String(formData.get(f) ?? "").trim() || null;
  row.name = name;
  row.stage = String(formData.get("stage") || "").trim() || "1-New Lead";

  // Ownership. A chosen owner wins; otherwise the lead belongs to whoever
  // created it. Leaving it blank is what produced leads nobody was accountable
  // for — and no alert can target a null.
  const chosenOwner = String(formData.get("owner_id") ?? "").trim();
  row.owner_id = chosenOwner || p.staffId || null;
  if (row.owner_id) {
    row.owner_method = chosenOwner ? "manual" : "creator";
    row.owner_assigned_at = new Date().toISOString();
  }

  // Score at creation so a new lead is immediately filterable by tier.
  const fresh = leadScore(row as Parameters<typeof leadScore>[0]);
  row.score = fresh.total;
  row.tier = fresh.tier;
  row.scored_at = new Date().toISOString();
  const { data: created } = await supabase.from("leads").insert(row).select("id").maybeSingle();
  const leadId = (created as { id: string } | null)?.id ?? null;

  // ---- first response ------------------------------------------------------
  // Speed to first contact is the strongest lever on conversion, and nothing in
  // the app used to prompt it: a new lead sat inert until somebody happened to
  // look at the list. Two things now happen immediately.
  if (leadId) {
    // 1. A task for the owner. Always — every lead has a phone number, and this
    //    works whether or not an email was given.
    const owner = (row.owner_id as string | null) ?? null;
    if (owner) {
      await supabase.from("tasks").insert({
        title: `Call ${name} — new lead`,
        assignee_id: owner,
        lead_id: leadId,
        type: "Follow-up",
        priority: "High",
        status: "todo",
        due_date: todayISO(),
        created_by: "auto",
      });
    }

    // 2. An acknowledgement to the lead, when we have somewhere to send it.
    //    tplLeadEnquiry, not tplWelcome — the latter opens "Your membership is
    //    active", which is untrue for someone who has just enquired.
    const email = (row.email as string | null) ?? null;
    if (email) {
      await notifyEmail({
        supabase, to: email, leadId, template: "lead_enquiry",
        tpl: tplLeadEnquiry(name), actor: p.name,
      });
    }
  }

  // Alert the front desk / management that a new lead has landed.
  await notifyRoles(supabase, LEAD_OWNER_ROLES, {
    title: "New lead",
    body: `${name}${row.source ? ` · ${row.source}` : ""}${row.phone ? ` · ${row.phone}` : ""}`,
    href: "/leads?view=open",
    icon: "✦",
  });

  await logAudit(p, "Lead added", name, null);
  revalidatePath("/leads");
}

// Walk-in capture lives on its own page (/leads/walk-in). It reuses createLead
// (owner, first-response task, score, new-lead notification) then returns the
// front desk to the leads list so they see the lead they just added.
export async function createWalkInLead(formData: FormData) {
  await createLead(formData);
  redirect("/leads?view=open");
}

export async function updateLead(formData: FormData) {
  const p = await getProfile();
  if (!p || !canWrite(p.role)) return;
  const id = String(formData.get("id"));
  if (!id) return;
  const supabase = createClient();
  const patch: Record<string, unknown> = {};
  for (const f of LEAD_FIELDS) patch[f] = String(formData.get(f) ?? "").trim() || null;
  // Reassignment is explicit: only touch ownership when the form actually
  // carried the field, so other edit paths can't silently clear it.
  if (formData.has("owner_id")) {
    const owner = String(formData.get("owner_id") ?? "").trim() || null;
    patch.owner_id = owner;
    patch.owner_method = owner ? "manual" : null;
    patch.owner_assigned_at = owner ? new Date().toISOString() : null;
  }
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
// NOTE: the package-carrying quick-convert (convertLeadWithPackage) was removed.
// It duplicated convertLeadVerified but skipped care-team assignment, journey
// start and the membership-prerequisite rule, and only IT carried the trial
// history across — so it produced half-built clients. Conversion now has a
// single entry point: sendLeadOtp → convertLeadVerified (below).

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

  const code = await nextClientCode(supabase);
  // pro_id is left null here — the assignment engine fills it in below, once
  // it knows the client's booking and the current rotation state.
  const { data: inserted } = await supabase.from("clients").insert({
    code, name: lead.name, phone: lead.phone ?? null, joined,
    package_id, used: 0, verified: true, consent_tnc: true, consent_waiver: true, converted_from: id,
  }).select("id").single();
  // Guard the insert explicitly. Previously a failed insert fell through to the
  // `{ ok: true }` at the end and reported a success that never happened.
  if (!inserted) return { ok: false, error: "Could not create the client — please try again." };

  // Move the lead's trial assessment — its appointment / session and the
  // consultation + summary that sold the package — onto the new client, so the
  // visit that closed the sale becomes part of their record. (The retired
  // quick-convert did this; the live path must too, or the history is orphaned.)
  await carryExperienceToClient(supabase, id, inserted.id);

  if (package_id) {
    const { data: pkg } = await supabase.from("packages").select("name, price, sessions, is_facility, validity").eq("id", package_id).maybeSingle();
    const cat0 = packageCategory(package_id, pkg?.is_facility ?? false);

    // Assign the care team: doctor/dietitian/psychologist follow whoever the
    // client was booked with; health coach and trainer come off the rotation.
    // A PT package is a fitness-only track — scope it to trainer + coach.
    const slotHour = Number(formData.get("slot_hour")) || 9;
    const team = await assignCareTeam(supabase, inserted.id, {
      slot: { date: joined, hour: slotHour }, actor: p.name,
      ...(cat0 === PT_CATEGORY ? { disciplines: ["trainer", "coach"] } : {}),
    });
    const trainerId = team.find((t) => t.discipline === "trainer")?.staff_id ?? null;

    // PT and Comprehensive sessions are booked by front desk (prompted), not
    // auto-scheduled — their journeys queue a "Book 12 strength sessions" task.
    // BluePrint is diagnostic (blood panel + consultations + report) and has no
    // strength workout, so it's excluded too. Everything else with session
    // credits still auto-builds.
    const autoBuildSessions = cat0 !== PT_CATEGORY && cat0 !== COMPREHENSIVE_CATEGORY && cat0 !== "blueprint";
    if (pkg && !pkg.is_facility && pkg.sessions > 0 && trainerId && autoBuildSessions) {
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
      if (cat0 === "blueprint") {
        await startBlueprintJourney(supabase, inserted.id, lead.name, p.name);
      } else if (cat0 === COMPREHENSIVE_CATEGORY) {
        await startComprehensiveJourney(supabase, inserted.id, lead.name, joined, p.name);
      } else if (cat0 === PT_CATEGORY) {
        await startPTJourney(supabase, inserted.id, lead.name, joined, p.name);
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
    // A membership can live in either place: the client_packages table, or the
    // legacy single `package_id` on the client record (a facility package).
    // Honour both — exactly as the client page does — so a client whose only
    // membership is the legacy facility package isn't wrongly blocked.
    const [{ data: existing }, { data: cli }] = await Promise.all([
      supabase.from("client_packages")
        .select("category, start_date, end_date").eq("client_id", client_id).eq("status", "active"),
      supabase.from("clients").select("package_id").eq("id", client_id).maybeSingle(),
    ]);
    let legacyFacility = false;
    const legacyPkgId = (cli as { package_id: string | null } | null)?.package_id ?? null;
    if (legacyPkgId) {
      const { data: lp } = await supabase.from("packages").select("is_facility").eq("id", legacyPkgId).maybeSingle();
      legacyFacility = Boolean((lp as { is_facility: boolean } | null)?.is_facility);
    }
    const ok = legacyFacility
      || hasActiveMembership((existing ?? []) as { category: string; start_date: string | null; end_date: string | null }[], start);
    if (!ok) return { ok: false, error: MEMBERSHIP_RULE_MSG };
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
  // PT and Comprehensive sessions are booked by front desk (their journeys
  // queue the prompt); everything else with credits still auto-builds.
  if (!pkg.is_facility && pkg.sessions > 0 && cat !== PT_CATEGORY && cat !== COMPREHENSIVE_CATEGORY) {
    await supabase.from("enrollments").insert({ client_id, trainer_id: "t0", hour: 9, session: "PT" });
    await supabase.from("sessions").insert(buildSessions(client_id, "t0", 9, start, pkg.sessions));
  }
  if (cat === "blueprint" || cat === COMPREHENSIVE_CATEGORY || cat === PT_CATEGORY) {
    const { data: cli } = await supabase.from("clients").select("name").eq("id", client_id).maybeSingle();
    const who = cli?.name ?? "Client";
    if (cat === "blueprint") await startBlueprintJourney(supabase, client_id, who, p.name);
    else if (cat === COMPREHENSIVE_CATEGORY) await startComprehensiveJourney(supabase, client_id, who, start, p.name);
    else await startPTJourney(supabase, client_id, who, start, p.name);
  }
  await logAudit(p, "Package purchased", pkg.name, client_id);
  const { data: pcli } = await supabase.from("clients").select("name").eq("id", client_id).maybeSingle();
  await notifyRoles(supabase, ["Administrator", "Manager", "Front Desk", "Super Admin"], {
    title: "Package purchased",
    body: `${pcli?.name ?? "Client"} · ${pkg.name} · ₹${amount.toLocaleString("en-IN")}${discount > 0 ? ` (−₹${discount.toLocaleString("en-IN")})` : ""}`,
    href: `/clients/${client_id}`, icon: "🛒",
  });
  revalidatePath(`/clients/${client_id}`);
  return { ok: true };
}

/**
 * Void a package that was added to a client by mistake. A soft-cancel — the row
 * stays for the audit trail with status "void" (so it's excluded from every
 * obligation, membership check and control) rather than being deleted. Admin /
 * Manager only. Any still-*unpaid* invoice for the package is voided too so it
 * doesn't leave a phantom due; paid invoices are left alone (those need a
 * refund, not a void).
 */
export async function voidClientPackage(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const p = await getProfile();
  if (!p || !canVoidPackage(p.role)) return { ok: false, error: "Not permitted" };
  const rowId = String(formData.get("package_row_id") || "");
  const client_id = String(formData.get("client_id") || "");
  if (!rowId) return { ok: false, error: "Missing package" };

  const supabase = createClient();
  const { data: row } = await supabase.from("client_packages")
    .select("package_name, category, package_id, status").eq("id", rowId).maybeSingle();
  if (!row) return { ok: false, error: "Package not found" };
  const r = row as { package_name: string | null; category: string; package_id: string | null; status: string };
  if (r.status === "void") return { ok: true };

  // Soft-cancel the package line (kept, struck-through, for the audit trail).
  await supabase.from("client_packages").update({ status: "void" }).eq("id", rowId);

  // 1. Remove any not-yet-paid invoice for this package entirely — a removed
  //    package must not leave an invoice sitting there to be marked paid. Paid
  //    invoices are left alone (money received → that needs a refund, not this).
  if (r.package_name && client_id) {
    await supabase.from("invoices").delete()
      .eq("client_id", client_id).neq("status", "Paid").ilike("description", `${r.package_name}%`);
  }

  // 2. If this membership is also the legacy clients.package_id, clear that
  //    field too — otherwise the "Active membership" badge stays lit.
  if (r.category === "membership" && client_id && r.package_id) {
    const { data: cli } = await supabase.from("clients").select("package_id").eq("id", client_id).maybeSingle();
    if ((cli as { package_id: string | null } | null)?.package_id === r.package_id) {
      await supabase.from("clients").update({ package_id: null }).eq("id", client_id);
    }
  }

  // 3. Care-journey cascade. A journey package (Comprehensive / PT / BluePrint)
  //    kicks off a protocol, bookings, sessions, follow-ups and a blood request;
  //    removing the package must clear those so nothing is left "open now" or
  //    "upcoming". Shared, package-untagged artifacts (sessions/tasks/follow-ups/
  //    blood/care-team) are only cleared when the client has NO other active
  //    journey package, so we never strip a second journey's work by mistake.
  if (["comprehensive", "training", "blueprint"].includes(r.category) && client_id) {
    const { data: allCps } = await supabase.from("client_packages")
      .select("id, category, status").eq("client_id", client_id);
    const otherJourney = ((allCps ?? []) as { id: string; category: string; status: string }[])
      .some((x) => x.id !== rowId && x.status === "active" && ["comprehensive", "training", "blueprint"].includes(x.category));

    // Protocol + its SLA markers are tied to this exact category, so always safe.
    if (r.category === "comprehensive" || r.category === "training") {
      await supabase.from("care_protocols").update({ status: "cancelled" })
        .eq("client_id", client_id).eq("protocol", r.category).eq("status", "active");
      await supabase.from("blueprint_sla_events").delete()
        .eq("client_id", client_id).eq("protocol", r.category);
    }

    if (!otherJourney) {
      // Scheduled / missed strength sessions (completed ones kept as history).
      await supabase.from("sessions").delete().eq("client_id", client_id).neq("status", "completed");
      // Auto-generated booking/journey tasks still open.
      await supabase.from("tasks").delete().eq("client_id", client_id).eq("created_by", "auto").neq("status", "done");
      // Journey follow-ups (diet-chart explanation, meal monitoring, etc.).
      await supabase.from("followups").delete().eq("client_id", client_id);
      // The blood panel this journey requested.
      const panel = r.category === "comprehensive" ? "comprehensive" : r.category === "blueprint" ? "blueprint" : null;
      if (panel) await supabase.from("blood_requests").delete().eq("client_id", client_id).eq("panel", panel);
      // Care-team assignments + the denormalised primary pro.
      await supabase.from("client_assignments").delete().eq("client_id", client_id);
      await supabase.from("clients").update({ pro_id: null }).eq("id", client_id);
    }
  }

  await logAudit(p, "Package removed", r.package_name ?? "package", client_id);
  revalidatePath(`/clients/${client_id}`);
  return { ok: true };
}

/**
 * The single renewal entry point. Renew any renewable package a client holds —
 * membership, PT (training) or Comprehensive — with the same package or a
 * different duration. The new term continues from the latest active package of
 * that same category so no paid days are lost; if it has lapsed it starts today.
 * Raises an unpaid invoice. BluePrint is a one-time report — use Add package.
 */
export async function renewPackage(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const p = await getProfile();
  if (!p || !canBill(p.role)) return { ok: false, error: "Not permitted" };
  const client_id = String(formData.get("client_id") || "");
  const package_id = String(formData.get("package_id") || "");
  if (!client_id || !package_id) return { ok: false, error: "Missing client or package" };

  const supabase = createClient();
  const { data: pkg } = await supabase.from("packages")
    .select("name, price, validity, is_facility").eq("id", package_id).maybeSingle();
  if (!pkg) return { ok: false, error: "Package not found" };
  const category = packageCategory(package_id, pkg.is_facility);
  if (category === "blueprint") return { ok: false, error: "BluePrint is a one-time report — add it as a new package instead of renewing." };

  // Continue from the latest active term of the SAME category, else start today.
  const { data: cur } = await supabase.from("client_packages")
    .select("end_date").eq("client_id", client_id).eq("category", category).eq("status", "active");
  const ends = ((cur ?? []) as { end_date: string | null }[]).map((r) => r.end_date).filter(Boolean) as string[];
  const latestEnd = ends.sort().at(-1) ?? null;
  const today = todayISO();
  const start = latestEnd && latestEnd >= today ? addDaysISO(latestEnd, 1) : today;
  const end = pkg.validity ? addDaysISO(start, pkg.validity) : null;
  const amount = Math.max(0, Number(pkg.price ?? 0));

  await supabase.from("client_packages").insert({
    client_id, package_id, package_name: pkg.name, category,
    start_date: start, end_date: end, price: amount, status: "active", created_by: p.name,
  });
  const num = await nextInvoiceNum(supabase);
  await supabase.from("invoices").insert({
    num, client_id, description: `${pkg.name} — renewal`,
    amount, status: "Unpaid", issued_date: today, created_by: p.name,
  });
  await logAudit(p, "Package renewed", pkg.name, `${category} · ${start} → ${end ?? "—"}`);
  const { data: rcli } = await supabase.from("clients").select("name").eq("id", client_id).maybeSingle();
  await notifyRoles(supabase, ["Administrator", "Manager", "Front Desk", "Super Admin"], {
    title: "Package renewed",
    body: `${rcli?.name ?? "Client"} · ${pkg.name} · ₹${amount.toLocaleString("en-IN")} → ${end ?? "—"}`,
    href: `/clients/${client_id}`, icon: "↻",
  });
  revalidatePath(`/clients/${client_id}`);
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Book the strength-session block for a PT / Comprehensive client. The package
 * prompts "Book 12 strength sessions" but never seeds them (front desk picks the
 * trainer & cadence) — this is that booking. Writes real dated rows to the
 * `sessions` table (every 2 days), closes the prompt, and flips the onboarding
 * "sessions scheduled" step + the SLA session count.
 */
export async function scheduleStrengthSessions(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const p = await getProfile();
  if (!p || !canWrite(p.role)) return { ok: false, error: "Not permitted" };
  const client_id = String(formData.get("client_id") || "");
  const trainer_id = String(formData.get("trainer_id") || "");
  const start = String(formData.get("start_date") || todayISO());
  const hour = Number(formData.get("hour")) || 9;
  const count = Math.min(24, Math.max(1, Number(formData.get("count")) || 12));
  if (!client_id || !trainer_id) return { ok: false, error: "Pick a trainer" };

  const supabase = createClient();
  const { data: existing } = await supabase.from("sessions").select("id").eq("client_id", client_id).eq("status", "scheduled").limit(1);
  if (existing && existing.length) return { ok: false, error: "This client already has scheduled sessions. Reschedule the existing ones instead." };

  await supabase.from("sessions").insert(buildSessions(client_id, trainer_id, hour, start, count));

  // Close the "Book … strength sessions" prompt so it drops off the board.
  const { data: tks } = await supabase.from("tasks").select("id").eq("client_id", client_id).neq("status", "done").ilike("title", "Book %session%");
  const ids = ((tks ?? []) as { id: string }[]).map((t) => t.id);
  if (ids.length) await supabase.from("tasks").update({ status: "done" }).in("id", ids);

  await logAudit(p, "Strength sessions scheduled", await clientName(supabase, client_id), `${count} sessions`);
  revalidatePath(`/clients/${client_id}`);
  revalidatePath("/onboarding");
  revalidatePath("/sessions");
  return { ok: true };
}

/**
 * Approve a Comprehensive client's consolidated summary — the doctor's sign-off
 * once all three initial consults (doctor, diet, trainer) are complete. Writes
 * care_protocols.consolidated_at + approved_at, which stops the 48h consolidated
 * clock (it otherwise has no writer and perpetually breaches).
 */
export async function approveComprehensive(formData: FormData) {
  const p = await getProfile();
  if (!p || !canConsult(p.role)) return;
  const client_id = String(formData.get("client_id") || "");
  if (!client_id) return;
  const supabase = createClient();
  const { data: cons } = await supabase.from("consultations").select("kind, status").eq("client_id", client_id);
  const done = new Set(((cons ?? []) as { kind: string; status: string }[]).filter((c) => c.status === "completed").map((c) => c.kind));
  if (!(done.has("Doctor") && done.has("Diet") && done.has("Trainer"))) return; // not ready
  const now = new Date().toISOString();
  await supabase.from("care_protocols")
    .update({ consolidated_at: now, approved: true, approved_at: now, approved_by: p.name })
    .eq("client_id", client_id).eq("protocol", "comprehensive").eq("status", "active");
  await logAudit(p, "Comprehensive consolidated summary approved", await clientName(supabase, client_id), null);
  revalidatePath(`/clients/${client_id}`);
  revalidatePath("/", "layout");
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

// Which consultation kind a staff role conducts.
const ROLE_TO_KIND: Record<string, string> = {
  Doctor: "Doctor", Dietitian: "Diet", "Fitness Trainer": "Trainer",
  "Health Coach": "Coach", Psychologist: "Psychologist",
};
// Keywords that mark a "Book …" task as belonging to a discipline — used to
// close the right prompt when a slot is booked directly.
const DISC_KEYWORDS: Record<string, string[]> = {
  Doctor: ["doctor"], Diet: ["diet", "nutrition"],
  Trainer: ["fitness", "reassess", "training", "trainer"], Coach: ["coach"],
  Psychologist: ["psych", "counsel"],
};

/**
 * Start (or resume) the consultation for a booked appointment and jump into the
 * console. Only the assigned clinician — or an admin/manager supervising — may
 * open it. Idempotent: reuses the consult already linked to this appointment.
 */
export async function startConsultFromAppointment(formData: FormData) {
  const p = await getProfile();
  if (!p || !canConsult(p.role)) return;
  const appointment_id = String(formData.get("appointment_id") || "");
  if (!appointment_id) return;
  const supabase = createClient();

  const { data: appt } = await supabase.from("appointments")
    .select("id, client_id, lead_id, provider_id, status").eq("id", appointment_id).maybeSingle();
  // Either a client booking or a pre-sale trial booked against a lead.
  if (!appt || (!appt.client_id && !appt.lead_id)) return;

  const adminish = ["Super Admin", "Administrator", "Manager"].includes(p.role);
  // A real clinician may only open their own booking; admins/managers may open any.
  if (!adminish && p.staffId && appt.provider_id && p.staffId !== appt.provider_id) return;

  let kind = "Doctor";
  if (appt.provider_id) {
    const { data: st } = await supabase.from("staff").select("role").eq("id", appt.provider_id).maybeSingle();
    kind = ROLE_TO_KIND[(st as { role?: string } | null)?.role ?? ""] ?? "Doctor";
  }

  const { data: existing } = await supabase.from("consultations")
    .select("id").eq("appointment_id", appointment_id).maybeSingle();
  let consultId = (existing as { id: string } | null)?.id ?? null;
  if (!consultId) {
    const { data: row } = await supabase.from("consultations").insert({
      client_id: appt.client_id, lead_id: appt.lead_id, kind, status: "scheduled",
      by_name: p.name, by_role: p.role, started_at: new Date().toISOString(),
      appointment_id,
    }).select("id").maybeSingle();
    consultId = (row as { id: string } | null)?.id ?? null;
  }
  const subjName = appt.client_id
    ? (await supabase.from("clients").select("name").eq("id", appt.client_id).maybeSingle()).data?.name
    : (await supabase.from("leads").select("name").eq("id", appt.lead_id).maybeSingle()).data?.name;
  await logAudit(p, "Consultation started", subjName, kind);
  if (consultId) redirect(`/console/${consultId}`);
  redirect("/pro");
}

/**
 * One-click "Mark done" for a booked appointment — closes the consult out without
 * opening the console. For the assigned clinician (or an admin/manager). Idempotent:
 * completes the consult already linked to the appointment, or creates a completed
 * one if none exists, then syncs the appointment to "completed" so it stops
 * showing as due / overdue. This is a quick close-out: it does NOT capture a
 * summary or start the Doctor prescription clock — use Start (the console) when a
 * clinical write-up is needed.
 */
export async function markConsultDone(formData: FormData) {
  const p = await getProfile();
  if (!p || !canConsult(p.role)) return;
  const appointment_id = String(formData.get("appointment_id") || "");
  if (!appointment_id) return;
  const supabase = createClient();

  const { data: appt } = await supabase.from("appointments")
    .select("id, client_id, lead_id, provider_id, status").eq("id", appointment_id).maybeSingle();
  if (!appt) return;

  const adminish = ["Super Admin", "Administrator", "Manager"].includes(p.role);
  // A real clinician may only close their own booking; admins/managers may close any.
  if (!adminish && p.staffId && appt.provider_id && p.staffId !== appt.provider_id) return;

  let kind = "Doctor";
  if (appt.provider_id) {
    const { data: st } = await supabase.from("staff").select("role").eq("id", appt.provider_id).maybeSingle();
    kind = ROLE_TO_KIND[(st as { role?: string } | null)?.role ?? ""] ?? "Doctor";
  }

  const now = new Date().toISOString();
  const { data: existing } = await supabase.from("consultations")
    .select("id").eq("appointment_id", appointment_id).maybeSingle();
  const existingId = (existing as { id: string } | null)?.id ?? null;
  if (existingId) {
    await supabase.from("consultations").update({ status: "completed", completed_at: now }).eq("id", existingId);
  } else {
    await supabase.from("consultations").insert({
      client_id: appt.client_id, lead_id: appt.lead_id, kind, status: "completed",
      by_name: p.name, by_role: p.role, started_at: now, completed_at: now, appointment_id,
    });
  }
  await supabase.from("appointments").update({ status: "completed" }).eq("id", appointment_id);

  const subjName = appt.client_id
    ? (await supabase.from("clients").select("name").eq("id", appt.client_id).maybeSingle()).data?.name
    : (await supabase.from("leads").select("name").eq("id", appt.lead_id).maybeSingle()).data?.name;
  await logAudit(p, "Consultation completed", subjName, kind);
  revalidatePath("/workspace");
  revalidatePath("/appointments");
  revalidatePath("/", "layout");
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
  // Resolve the SAME question list the console rendered — including the
  // sex-specific filtering — so `a_<index>` lines up. Reading the client's
  // gender here is what keeps the two in step; consultQ alone would shift the
  // indices for any client whose questions were filtered.
  const { consultQFor } = await import("@/lib/consult-questions");
  const supabaseQ = createClient();
  const { data: qc } = await supabaseQ.from("consultations").select("client_id, flags").eq("id", id).maybeSingle();
  const qClientId = (qc as { client_id: string | null } | null)?.client_id ?? null;
  // What the team has already been alerted about. Captured BEFORE the update so
  // re-saving a consult can't re-fire an alert on a flag they've already seen.
  const priorFlags = new Set(
    (((qc as { flags: { text: string; severity: string }[] | null } | null)?.flags ?? [])
      .filter((f) => f.severity === "critical").map((f) => f.text)),
  );
  let qGender: string | null = null;
  if (qClientId) {
    const { data: cg } = await supabaseQ.from("clients").select("gender").eq("id", qClientId).maybeSingle();
    qGender = (cg as { gender: string | null } | null)?.gender ?? null;
  }
  const derived = consultQFor(kind, qGender).questions;
  // Prefer the question text the form posted alongside each answer. Re-deriving
  // the list here and zipping by index only works while both lists agree, and
  // when they didn't — a male client's three female-specific questions dropped
  // on the server but not in the browser — every answer was filed under a
  // question three places away. Falls back to the derived list for a page that
  // was rendered before this change.
  // Count what the form actually posted — the browser's list can be longer than
  // the derived one, and truncating to `derived.length` would silently drop the
  // trailing answers.
  let posted = 0;
  while (formData.has("a_" + posted) || formData.has("q_" + posted)) posted++;
  const answers: [string, string][] = [];
  for (let i = 0; i < Math.max(posted, derived.length); i++) {
    const q = String(formData.get("q_" + i) ?? derived[i] ?? "").trim();
    const a = String(formData.get("a_" + i) ?? "").trim();
    if (q && a) answers.push([q, a]);
  }
  const summary = String(formData.get("summary") ?? "").trim() || null;
  const duration = Number(formData.get("duration_min")) || null;
  // Medical flags raised in-session (clinician-added; AI copilot may add later).
  let flags: { text: string; severity: string }[] = [];
  try {
    flags = (JSON.parse(String(formData.get("flags") || "[]")) as { text?: string; severity?: string }[])
      .filter((f) => f && f.text && f.text.trim())
      .map((f) => ({ text: String(f.text).trim(), severity: String(f.severity || "info") }));
  } catch { flags = []; }
  const supabase = createClient();
  await supabase.from("consultations").update({
    answers, summary, flags, ...(complete ? { status: "completed", completed_at: new Date().toISOString() } : {}), ...(duration ? { duration_min: duration } : {}),
  }).eq("id", id);

  // A critical flag used to be inert: it sat on the consultation and printed on
  // the summary, and nobody was told. Someone recording "BP 184/112 — needs
  // same-day review" reasonably expects that to reach the team. So a NEW
  // critical flag now notifies the client's care team and management, and raises
  // a High task — a notification can be scrolled past, a task can't.
  //
  // Only newly-added criticals fire (see priorFlags), and autosave never reaches
  // this action, so typing a flag can't spam anyone.
  const fresh = flags.filter((f) => f.severity === "critical" && !priorFlags.has(f.text));
  if (fresh.length && qClientId) {
    const { notifyRoles, notifyStaff } = await import("@/lib/notify");
    const { data: cr } = await supabase.from("clients").select("name, code").eq("id", qClientId).maybeSingle();
    const who = cr as { name: string; code: string | null } | null;
    const label = `${who?.name ?? "Client"}${who?.code ? ` (${who.code})` : ""}`;
    const title = `Critical finding — ${label}`;
    const body = `${fresh.map((f) => f.text).join(" · ")} — raised by ${p.name}`;
    const href = `/clients/${qClientId}`;

    // The people actually responsible for this client come first; then the
    // people who can act if the care team is off that day.
    const { data: team } = await supabase.from("client_assignments").select("staff_id, discipline").eq("client_id", qClientId);
    const rows = ((team ?? []) as { staff_id: string | null; discipline: string }[]);
    const seen = new Set<string>();
    for (const a of rows) {
      if (!a.staff_id || seen.has(a.staff_id) || a.staff_id === p.staffId) continue;
      seen.add(a.staff_id);
      await notifyStaff(supabase, a.staff_id, { title, body, href, icon: "\u{1F534}", link: { kind: "client", ref: qClientId } });
    }
    await notifyRoles(supabase, ["Super Admin", "Administrator", "Manager"], { title, body, href, icon: "\u{1F534}", link: { kind: "client", ref: qClientId } });

    // Owned by the client's doctor where there is one — a critical finding is a
    // medical call. Otherwise it stays unassigned and shows on the open board.
    const doctor = rows.find((a) => a.discipline === "doctor" && a.staff_id)?.staff_id ?? null;
    await supabase.from("tasks").insert({
      title: `${title}: ${fresh.map((f) => f.text).join("; ")}`.slice(0, 300),
      assignee_id: doctor, client_id: qClientId,
      type: "Ops", priority: "High", status: "todo",
      due_date: todayISO(), created_by: p.name,
    });
    await logAudit(p, "Critical finding flagged", who?.name ?? null, fresh.map((f) => f.text).join("; ").slice(0, 160));
    revalidatePath("/tasks");
  }

  // Vitals travel with the consultation (mirrored into this form as v_*), so one
  // Save records the questionnaire AND the vitals. Previously they were a
  // separate form: saving the questionnaire re-rendered the page and silently
  // discarded whatever was typed into the vitals boxes.
  const V_KEYS = ["systolic", "diastolic", "pulse", "spo2", "temp_c", "weight"] as const;
  const vNum = (k: string) => {
    const raw = String(formData.get(`v_${k}`) ?? "").trim();
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };
  const vitalVals = Object.fromEntries(V_KEYS.map((k) => [k, vNum(k)]));
  if (Object.values(vitalVals).some((v) => v !== null)) {
    const { data: vrow } = await supabase.from("consultations").select("client_id").eq("id", id).maybeSingle();
    const vClient = (vrow as { client_id: string | null } | null)?.client_id ?? null;
    if (vClient) {
      const today = todayISO();
      // One vitals reading per client per day from the console: re-saving a
      // consult updates today's reading instead of stacking near-identical rows.
      const { data: existing } = await supabase.from("vitals")
        .select("id").eq("client_id", vClient).eq("date", today).limit(1).maybeSingle();
      const eid = (existing as { id: string } | null)?.id;
      if (eid) await supabase.from("vitals").update({ ...vitalVals, recorded_by: p.name }).eq("id", eid);
      else await supabase.from("vitals").insert({ client_id: vClient, date: today, ...vitalVals, recorded_by: p.name });
      // The vitals have become a real record, so drop them from the scratch
      // copy — but keep everything still in flight: a half-typed order or
      // prescription, and the scribe transcript. Saving the questionnaire has
      // nothing to do with any of them, and silently discarding twenty minutes
      // of dictation because someone pressed Save would be unforgivable.
      const { data: dRow } = await supabase.from("consultations").select("draft").eq("id", id).maybeSingle();
      const d = ((dRow as { draft: Record<string, unknown> | null } | null)?.draft ?? {}) as Record<string, unknown>;
      const rest = { order: d.order, rx: d.rx, transcript: d.transcript };
      await supabase.from("consultations").update({
        draft: rest.order || rest.rx || rest.transcript ? rest : null,
      }).eq("id", id);
    }
  }
  if (complete) {
    const { data: link } = await supabase.from("consultations").select("appointment_id").eq("id", id).maybeSingle();
    const apptId = (link as { appointment_id?: string | null } | null)?.appointment_id ?? null;
    if (apptId) await supabase.from("appointments").update({ status: "completed" }).eq("id", apptId);
  }
  await logAudit(p, complete ? "Consultation completed" : "Consultation session saved", kind, null);
  revalidatePath("/workspace");
  revalidatePath("/appointments");
  if (complete) redirect("/workspace?tab=summaries");
  revalidatePath(`/console/${id}`);
}

/**
 * Background autosave for the consultation console.
 *
 * A doctor's intake is 85+ answers typed over a long session — a closed tab or a
 * stray back-button used to lose all of it, because nothing persisted until
 * someone pressed Save draft. The console now calls this a few seconds after
 * typing stops.
 *
 * Deliberately minimal: it writes only the working fields and does NOT
 * revalidate any path. Revalidating on every keystroke-pause would re-render the
 * console mid-typing and fight the clinician's cursor. It also never touches
 * `status` — autosave keeps a consult a draft; only an explicit Complete closes
 * it.
 */
export async function autosaveConsult(
  id: string,
  kind: string,
  answersByIndex: string[],
  flags: { text: string; severity: string }[],
  summary: string,
  vitals?: Record<string, string>,
  questionsFromClient?: string[],
  /** Typed but not yet placed / signed — recoverable, never a record.
   *  `transcript` is the ambient scribe's working note, kept for the same
   *  reason: losing twenty minutes of dictation to a reload is unforgivable. */
  pending?: { order?: Record<string, string>; rx?: Record<string, string>; transcript?: string },
): Promise<{ ok?: boolean; at?: string; error?: string }> {
  const p = await getProfile();
  if (!p || !canConsult(p.role)) return { error: "Not authorized." };
  if (!id) return { error: "Missing consultation." };
  if (!ownsConsultKind(p.role, kind)) return { error: "Not your discipline." };
  const supabase = createClient();

  // Don't reopen or overwrite a finished consultation.
  const { data: row } = await supabase.from("consultations").select("status, client_id").eq("id", id).maybeSingle();
  const cur = row as { status: string | null; client_id: string | null } | null;
  if (!cur) return { error: "Consultation not found." };
  if (cur.status === "completed") return { error: "Already completed." };

  // The console sends the question text with each answer, so a pair is always
  // question → its own answer. Re-deriving the list here and zipping by index
  // is what let a male client's answers land three questions away when the
  // server dropped the female-specific items and the browser had not.
  let pairs: [string, string][];
  if (questionsFromClient?.length) {
    pairs = questionsFromClient
      .map((q, i) => [String(q ?? "").trim(), String(answersByIndex[i] ?? "").trim()] as [string, string])
      .filter(([q, a]) => q && a);
  } else {
    // A page rendered before this change posts answers only.
    const { consultQFor } = await import("@/lib/consult-questions");
    let gender: string | null = null;
    if (cur.client_id) {
      const { data: cg } = await supabase.from("clients").select("gender").eq("id", cur.client_id).maybeSingle();
      gender = (cg as { gender: string | null } | null)?.gender ?? null;
    }
    pairs = consultQFor(kind, gender).questions
      .map((q, i) => [q, String(answersByIndex[i] ?? "").trim()] as [string, string])
      .filter(([, a]) => a);
  }

  // Vitals are a scratch draft until the clinician saves — parked on `draft`
  // rather than written to the vitals table, so autosave can't spray a row every
  // few seconds. saveConsultSession is what turns them into a real record.
  const vDraft = Object.fromEntries(
    Object.entries(vitals ?? {}).filter(([, v]) => String(v ?? "").trim()),
  );
  // Half-typed lab orders and prescriptions ride along in the same scratch
  // draft. They are explicitly NOT records: an order exists when it is placed
  // and a prescription when it is signed. This only stops a stray reload from
  // eating what someone was in the middle of typing.
  const clean = (o?: Record<string, string>) => {
    const e = Object.entries(o ?? {}).filter(([, v]) => String(v ?? "").trim());
    return e.length ? Object.fromEntries(e) : undefined;
  };
  const transcript = String(pending?.transcript ?? "").trim() || undefined;
  const pendingDraft = { order: clean(pending?.order), rx: clean(pending?.rx), transcript };
  const { error } = await supabase.from("consultations").update({
    answers: pairs,
    flags: (flags ?? []).filter((f) => f?.text?.trim()),
    summary: summary.trim() || null,
    draft: (Object.keys(vDraft).length || pendingDraft.order || pendingDraft.rx || pendingDraft.transcript)
      ? { vitals: vDraft, ...pendingDraft }
      : null,
  }).eq("id", id);
  if (error) return { error: error.message };
  return { ok: true, at: new Date().toISOString() };
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
  const { data: row } = await supabase.from("consultations").select("kind, appointment_id").eq("id", id).maybeSingle();
  if (!row || !ownsConsultKind(p.role, row.kind)) return; // only the owning discipline
  // Starts this clinician's 24h sign-off clock, and — once all three
  // disciplines are complete — the 48h delivery clock. See lib/blueprint-sla.
  await supabase.from("consultations")
    .update({
      status: "completed", summary, completed_at: new Date().toISOString(),
      ...(row.kind === "Doctor" && rxNeeded !== null ? { prescription_needed: rxNeeded } : {}),
    })
    .eq("id", id);
  // Keep the booked appointment's "done" state in step with the consultation.
  const apptId = (row as { appointment_id?: string | null }).appointment_id ?? null;
  if (apptId) await supabase.from("appointments").update({ status: "completed" }).eq("id", apptId);
  revalidatePath("/pro");
  revalidatePath("/appointments");
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
  notify = true,
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

  // Assign the care team, exactly as the Comprehensive and PT journeys do —
  // BluePrint pulls the full clinical team. Coach and trainer land immediately
  // by rotation; doctor / dietitian firm up when their consults are booked.
  // Without this a freshly-sold BluePrint client sat with no care team at all,
  // so every owner-resolved nudge fell back to chasing a whole role.
  await assignCareTeam(supabase, clientId, { actor });

  const titles = BP_BOOKING_TASKS.map((t) => `${t.label} — ${clientName}`);
  // Dedupe against tasks in ANY status (not just open) so a re-run never clones
  // a prompt whose original was completed…
  const { data: existing } = await supabase.from("tasks")
    .select("title").eq("client_id", clientId).in("title", titles);
  const taken = new Set(((existing ?? []) as { title: string }[]).map((r) => r.title));
  // …and skip any discipline that's already booked (a non-cancelled appointment
  // exists), so a repair after consults are booked doesn't re-queue them.
  const { data: bpAppts } = await supabase.from("appointments")
    .select("staff(role)").eq("client_id", clientId).neq("status", "cancelled");
  const bookedKinds = new Set(((bpAppts ?? []) as unknown as { staff: { role: string } | null }[])
    .map((a) => ROLE_TO_KIND[a.staff?.role ?? ""]).filter(Boolean));

  const rows = BP_BOOKING_TASKS
    .map((t, i) => ({ t, title: titles[i] }))
    .filter(({ t, title }) => !taken.has(title) && !bookedKinds.has(t.kind))
    .map(({ t, title }) => ({
      title, client_id: clientId, type: "Ops", priority: "High",
      status: "todo", due_date: addDaysISO(todayISO(), BP_BOOKING_DUE_DAYS),
      created_by: actor,
    }));
  if (rows.length) await supabase.from("tasks").insert(rows);

  if (notify) await notifyRoles(supabase, ["Administrator", "Manager", "Super Admin"], {
    title: "BluePrint started",
    body: `${clientName} — blood report requested, ${rows.length} appointment${rows.length === 1 ? "" : "s"} to book.`,
    href: "/onboarding",
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
  notify = true,
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

  const consultItems = INITIAL_BOOKINGS.map((b) => ({ title: `${b.label} — ${clientName}`, kind: b.consultKind as string }));
  const sessTitle = `${PT_BOOKING_LABEL} — ${clientName}`;
  const wanted = [...consultItems.map((b) => b.title), sessTitle];
  // Dedupe against tasks in ANY status, and skip consult bookings whose
  // discipline is already booked — so a re-run never re-queues handled work.
  const { data: existing } = await supabase.from("tasks")
    .select("title").eq("client_id", clientId).in("title", wanted);
  const taken = new Set(((existing ?? []) as { title: string }[]).map((r) => r.title));
  const { data: coAppts } = await supabase.from("appointments")
    .select("staff(role)").eq("client_id", clientId).neq("status", "cancelled");
  const bookedKinds = new Set(((coAppts ?? []) as unknown as { staff: { role: string } | null }[])
    .map((a) => ROLE_TO_KIND[a.staff?.role ?? ""]).filter(Boolean));

  const mk = (title: string) => ({ title, client_id: clientId, type: "Ops", priority: "High", status: "todo", due_date: addDaysISO(todayISO(), BOOKING_DUE_DAYS), created_by: actor });
  const rows = [
    ...consultItems.filter((b) => !taken.has(b.title) && !bookedKinds.has(b.kind)).map((b) => mk(b.title)),
    ...(!taken.has(sessTitle) ? [mk(sessTitle)] : []),
  ];
  if (rows.length) await supabase.from("tasks").insert(rows);

  if (notify) await notifyRoles(supabase, ["Administrator", "Manager", "Super Admin"], {
    title: "Comprehensive started",
    body: `${clientName} — blood panel requested, care team assigned, ${rows.length} booking${rows.length === 1 ? "" : "s"} to make.`,
    href: "/onboarding",
    icon: "\u{1FA7A}",
  });
}

/**
 * Everything that must happen the moment a client buys a PT package. The
 * trainer-only counterpart of startComprehensiveJourney — no blood panel, no
 * doctor/dietitian, no consolidated report.
 *
 * Day 0:
 *   1. assign the care team, scoped to trainer + health coach only;
 *   2. open the `training` protocol row that anchors the reassessment milestone
 *      and holds the client-side pause;
 *   3. queue two front-desk bookings: the initial fitness assessment and the 12
 *      strength sessions (prompted, never auto-scheduled).
 *
 * Idempotent: the protocol row is unique per (client, protocol, start) and
 * tasks are skipped when an open one with the same title already exists.
 */
async function startPTJourney(
  supabase: ReturnType<typeof createClient>,
  clientId: string,
  clientName: string,
  startDate: string,
  actor: string,
  notify = true,
) {
  await assignCareTeam(supabase, clientId, { actor, disciplines: ["trainer", "coach"] });

  await supabase.from("care_protocols").upsert(
    { client_id: clientId, protocol: PT_CATEGORY, start_date: startDate, status: "active", created_by: actor },
    { onConflict: "client_id,protocol,start_date", ignoreDuplicates: true },
  );

  const consultItems = PT_INITIAL_BOOKINGS.map((b) => ({ title: `${b.label} — ${clientName}`, kind: b.consultKind as string }));
  const sessTitle = `${PT_SESSIONS_LABEL} — ${clientName}`;
  const wanted = [...consultItems.map((b) => b.title), sessTitle];
  // Dedupe against ANY status + skip disciplines already booked (see comprehensive).
  const { data: existing } = await supabase.from("tasks")
    .select("title").eq("client_id", clientId).in("title", wanted);
  const taken = new Set(((existing ?? []) as { title: string }[]).map((r) => r.title));
  const { data: ptAppts } = await supabase.from("appointments")
    .select("staff(role)").eq("client_id", clientId).neq("status", "cancelled");
  const bookedKinds = new Set(((ptAppts ?? []) as unknown as { staff: { role: string } | null }[])
    .map((a) => ROLE_TO_KIND[a.staff?.role ?? ""]).filter(Boolean));

  const mk = (title: string) => ({ title, client_id: clientId, type: "Ops", priority: "High", status: "todo", due_date: addDaysISO(todayISO(), PT_BOOKING_DUE_DAYS), created_by: actor });
  const rows = [
    ...consultItems.filter((b) => !taken.has(b.title) && !bookedKinds.has(b.kind)).map((b) => mk(b.title)),
    ...(!taken.has(sessTitle) ? [mk(sessTitle)] : []),
  ];
  if (rows.length) await supabase.from("tasks").insert(rows);

  if (notify) await notifyRoles(supabase, ["Administrator", "Manager", "Super Admin"], {
    title: "PT started",
    body: `${clientName} — trainer & coach assigned, ${rows.length} booking${rows.length === 1 ? "" : "s"} to make.`,
    href: "/onboarding",
    icon: "\u{1F3CB}",
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
    appointments: normalizeApptTypes((appts ?? []) as { type: string | null; date: string | null; status: string }[], await loadCatOf(supabase)),
    hold: { holdSince: proto.hold_since as string | null, holdMs: Number(proto.hold_ms ?? 0) },
    holdNote: (proto.hold_note as string | null) ?? null,
  };
}


/**
 * The PT protocol picture for one client — the trainer-track counterpart of
 * getComprehensiveView. Null for any client not on an active PT package.
 */
export async function getPTView(clientId: string) {
  const p = await getProfile();
  if (!p || !canSee(p.role, "/clients")) return null;
  const supabase = createClient();

  const { data: proto } = await supabase.from("care_protocols")
    .select("start_date, hold_since, hold_ms, hold_note")
    .eq("client_id", clientId).eq("protocol", PT_CATEGORY).eq("status", "active")
    .maybeSingle();
  if (!proto) return null;

  const [{ data: consults }, { data: workouts }, { data: sessions }, { data: appts }, { data: cp }] = await Promise.all([
    supabase.from("consultations").select("kind, completed_at, approved_at").eq("client_id", clientId).eq("kind", "Trainer"),
    supabase.from("client_workouts").select("created_at, plan_weeks").eq("client_id", clientId).order("created_at").limit(5),
    supabase.from("sessions").select("status").eq("client_id", clientId).eq("status", "completed"),
    supabase.from("appointments").select("type, date, status").eq("client_id", clientId),
    supabase.from("client_packages").select("package_id").eq("client_id", clientId).eq("category", PT_CATEGORY).eq("status", "active").maybeSingle(),
  ]);

  const fit = ((consults ?? []) as { completed_at: string | null; approved_at: string | null }[])
    .filter((c) => c.completed_at)
    .sort((a, b) => String(b.completed_at).localeCompare(String(a.completed_at)))[0] ?? null;
  const plan = ((workouts ?? []) as { created_at: string; plan_weeks: number | null }[]).find((w) => (w.plan_weeks ?? 1) >= 1);

  return {
    startDate: proto.start_date as string,
    validityDays: (cp?.package_id === "pt12" ? 84 : 28),
    fitnessCompletedAt: fit?.completed_at ?? null,
    fitnessApprovedAt: fit?.approved_at ?? null,
    workoutPlannedAt: plan?.created_at ?? null,
    sessionsCompleted: (sessions ?? []).length,
    appointments: normalizeApptTypes((appts ?? []) as { type: string | null; date: string | null; status: string }[], await loadCatOf(supabase)),
    hold: { holdSince: proto.hold_since as string | null, holdMs: Number(proto.hold_ms ?? 0) },
    holdNote: (proto.hold_note as string | null) ?? null,
  };
}

/** Pause or resume the PT clocks for one client. Mirrors toggleComprehensiveHold. */
export async function togglePTHold(formData: FormData) {
  const p = await getProfile();
  if (!p || !canWrite(p.role)) return;
  const client_id = String(formData.get("client_id"));
  const note = String(formData.get("note") ?? "").trim() || null;
  const supabase = createClient();

  const { data: row } = await supabase.from("care_protocols")
    .select("id, hold_since, hold_ms")
    .eq("client_id", client_id).eq("protocol", PT_CATEGORY).eq("status", "active")
    .maybeSingle();
  if (!row) return;

  const now = Date.now();
  const open = row.hold_since ? new Date(row.hold_since).getTime() : null;
  const patch = open
    ? { hold_since: null, hold_ms: Math.max(0, Number(row.hold_ms ?? 0)) + Math.max(0, now - open), hold_note: null }
    : { hold_since: new Date(now).toISOString(), hold_note: note };

  await supabase.from("care_protocols").update(patch).eq("id", row.id);
  const { data: c } = await supabase.from("clients").select("name").eq("id", client_id).maybeSingle();
  await logAudit(p, open ? "PT SLA resumed" : "PT SLA held", c?.name, note);
  revalidatePath(`/clients/${client_id}`);
}

/**
 * (Re)start the care journey for a client who holds a BluePrint / PT /
 * Comprehensive package but never had it kicked off — typically a client
 * seeded or imported straight into the database with the package attached,
 * bypassing the sale flow that normally queues the booking tasks, blood
 * request and care-team assignment.
 *
 * Runs the same journey a real sale would, for each journey-eligible package
 * the client holds. Every journey is idempotent (blood request upserts, tasks
 * skip when an open one with the same title exists, protocol rows upsert), so
 * this is safe on a client who is already partway through.
 */
export async function repairClientJourney(formData: FormData) {
  const p = await getProfile();
  if (!p || !canWrite(p.role)) return;
  const client_id = String(formData.get("client_id") || "");
  if (!client_id) return;
  const supabase = createClient();

  const { data: c } = await supabase.from("clients").select("id, name, package_id, joined").eq("id", client_id).maybeSingle();
  if (!c) return;

  const JOURNEY = ["blueprint", "training", "comprehensive"];
  const jobs: { category: string; start: string }[] = [];

  const { data: cps } = await supabase.from("client_packages")
    .select("category, start_date").eq("client_id", client_id).eq("status", "active");
  for (const r of (cps ?? []) as { category: string; start_date: string | null }[]) {
    if (JOURNEY.includes(r.category)) jobs.push({ category: r.category, start: r.start_date ?? c.joined ?? todayISO() });
  }
  // Legacy fallback: a client with only the old package_id and no client_packages row.
  if (!jobs.length && c.package_id) {
    const { data: pkg } = await supabase.from("packages").select("is_facility").eq("id", c.package_id).maybeSingle();
    const cat = packageCategory(c.package_id, pkg?.is_facility ?? false);
    if (JOURNEY.includes(cat)) jobs.push({ category: cat, start: c.joined ?? todayISO() });
  }
  if (!jobs.length) return;

  for (const j of jobs) {
    // Repair re-seeds silently: no "… started" notification on a re-run, so the
    // bell doesn't fill with duplicates every time someone clicks Repair.
    if (j.category === "blueprint") await startBlueprintJourney(supabase, client_id, c.name, p.name, false);
    else if (j.category === "comprehensive") await startComprehensiveJourney(supabase, client_id, c.name, j.start, p.name, false);
    else if (j.category === "training") await startPTJourney(supabase, client_id, c.name, j.start, p.name, false);
  }
  await logAudit(p, "Care journey repaired", c.name, jobs.map((j) => j.category).join(", "));
  revalidatePath(`/clients/${client_id}`);
  revalidatePath("/onboarding");
  revalidatePath("/appointments");
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
 * Mark a trial's outcome from the *assigned clinician's* workspace.
 *
 * A narrow carve-out from `setExperienceStatus` (which is front-desk-only): the
 * provider actually rostered to run the assessment/training can record whether
 * it happened, without any wider lead/CRM access. Ownership is verified against
 * the booking's own provider/trainer id — you can only act on your own trial.
 */
export async function markExperienceOutcome(formData: FormData): Promise<void> {
  const p = await getProfile();
  if (!p) return;

  const kind = String(formData.get("kind") || "");        // assessment | training
  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "");    // completed | no_show
  if (!id || !["completed", "no_show"].includes(status)) return;
  if (kind !== "assessment" && kind !== "training") return;

  const supabase = createClient();
  const table = kind === "training" ? "sessions" : "appointments";
  const ownerCol = kind === "training" ? "trainer_id" : "provider_id";

  // Ownership: front desk / admin may always act; a clinician only on their own.
  const { data: row } = await supabase.from(table).select(`id, ${ownerCol}, lead_id, is_experience`).eq("id", id).maybeSingle();
  const r = row as { [k: string]: unknown; lead_id?: string | null; is_experience?: boolean | null } | null;
  if (!r || !r.is_experience) return;
  const owns = p.staffId && r[ownerCol] === p.staffId;
  if (!canWrite(p.role) && !owns) return;

  // `sessions` has no no_show state — record it as cancelled there.
  const value = table === "sessions" && status === "no_show" ? "cancelled" : status;
  await supabase.from(table).update({ status: value }).eq("id", id);

  await logAudit(p, "Trial outcome recorded", kind, status);
  revalidatePath("/workspace");
  if (r.lead_id) revalidatePath(`/leads/${r.lead_id}`);
  revalidatePath("/leads");
  revalidatePath("/appointments");
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
  // The trial assessment's consultation + summary move too, so the assessment
  // that sold them the package becomes part of their client record.
  await supabase.from("consultations")
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
  // Panel from the form so front desk can request either report set; defaults
  // to the BluePrint panel.
  const panel = String(formData.get("panel") ?? BP_PANEL);
  await supabase.from("blood_requests").upsert(
    { client_id, panel, requested_at: todayISO(), submitted: false },
    { onConflict: "client_id,panel" },
  );
  const { data: c } = await supabase.from("clients").select("name").eq("id", client_id).maybeSingle();
  await logAudit(p, "Blood report requested", c?.name, panel);
  revalidatePath("/blueprint");
  revalidatePath(`/clients/${client_id}`);
}

/** Ops roles (front desk / manager / admin) nudge the clinician who owes a
 *  deliverable (diet chart, workout plan, consolidated summary) instead of being
 *  sent to a workspace they can't act in. Drops a notification in that
 *  clinician's bell. */
export async function nudgeClinician(formData: FormData) {
  const p = await getProfile();
  if (!p || !canWrite(p.role)) return;
  const client_id = String(formData.get("client_id") || "");
  const staff_id = String(formData.get("staff_id") || "");
  const label = String(formData.get("label") || "a deliverable").trim();
  if (!staff_id) return;
  const supabase = createClient();
  const { data: c } = await supabase.from("clients").select("name").eq("id", client_id).maybeSingle();
  // Deep-link straight into the drafting screen for the deliverable, pre-focused
  // on this client, so the clinician lands where they actually do the work.
  const l = label.toLowerCase();
  let href = client_id ? `/clients/${client_id}` : "/workspace";
  if (client_id) {
    if (/diet chart/.test(l)) href = `/workspace?role=diet&tab=charts&client=${client_id}`;
    else if (/workout/.test(l)) href = `/workspace?role=trainer&tab=planner&client=${client_id}`;
    else if (/consolidated/.test(l)) href = `/workspace?role=doctor&tab=summaries&client=${client_id}`;
  }
  await notifyStaff(supabase, staff_id, {
    title: `Reminder — ${label}`,
    body: `${c?.name ?? "A client"} · nudged by ${p.name}`,
    href, icon: "⏰",
    // Store the intent so the link is resolved fresh at click-time and never
    // goes stale, even if the drafting screen moves.
    link: client_id ? nudgeLink(label, client_id) : undefined,
  });
  await logAudit(p, "Clinician nudged", c?.name, label);
  revalidatePath(`/clients/${client_id}`);
}

// Chase a whole role/team for an attention-queue item that no single person is
// assigned to (billing, onboarding, bookings, renewals). Sends the notification
// to every listed role, deep-linking to where they act.
export async function nudgeRole(formData: FormData) {
  const p = await getProfile();
  if (!p || !canWrite(p.role)) return;
  const roles = String(formData.get("roles") || "").split(",").map((s) => s.trim()).filter(Boolean);
  const label = String(formData.get("label") || "a task").trim();
  const href = String(formData.get("href") || "").trim() || undefined;
  const client_id = String(formData.get("client_id") || "").trim() || undefined;
  if (!roles.length) return;
  const supabase = createClient();
  let who = "";
  if (client_id) {
    const { data: c } = await supabase.from("clients").select("name").eq("id", client_id).maybeSingle();
    who = (c as { name: string } | null)?.name ?? "";
  }
  await notifyRoles(supabase, roles, {
    title: `Chase — ${label}`,
    body: `${who ? `${who} · ` : ""}flagged by ${p.name}`,
    href: href ?? "/dashboard", icon: "⏰",
    link: client_id ? { kind: "client", ref: client_id } : undefined,
  });
  await logAudit(p, "Team chased", label, client_id ?? null);
  if (client_id) revalidatePath(`/clients/${client_id}`);
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
  await logAudit(p, "Blood report received", c?.name, panel);
  revalidatePath("/blueprint");
  revalidatePath(`/clients/${client_id}`);
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
  if (kind === "blood_report") {
    // The same rule the portal already applied: a report received is a panel
    // satisfied. Without this, front desk filing a report the client brought in
    // left the Blood report card saying "awaiting" indefinitely, contradicting
    // the report sitting in the timeline one tab away.
    await markEarliestPanelReceived(supabase, clientId);
  }
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

// discipline (client_assignments) ↔ consultation kind.
const BP_DISC_TO_KIND: Record<string, string> = { doctor: "Doctor", dietitian: "Diet", trainer: "Trainer", coach: "Coach", psychologist: "Psychologist" };
const BP_ROLE_TO_DISC: Record<string, string> = { Doctor: "doctor", Dietitian: "dietitian", "Fitness Trainer": "trainer", "Health Coach": "coach", Psychologist: "psychologist" };

/**
 * Author / edit the CONSOLIDATED summary for a BluePrint client (does NOT
 * generate). Assigned clinicians and admins can write it; each clinician then
 * signs off separately via signoffConsolidated.
 */
export async function saveConsolidatedSummary(formData: FormData) {
  const p = await getProfile();
  if (!p || !canConsult(p.role)) return; // clinicians + admins
  const client_id = String(formData.get("client_id"));
  const consolidated = String(formData.get("consolidated") ?? "").trim() || null;
  if (!client_id) return;
  const supabase = createClient();
  await supabase.from("blueprints").upsert({ client_id, consolidated, updated_at: new Date().toISOString() });
  await logAudit(p, "Consolidated summary saved", await clientName(supabase, client_id), null);
  revalidatePath("/workspace");
  revalidatePath("/blueprint");
}

/**
 * One clinician signs off the consolidated summary. When EVERY discipline
 * assigned to the client (from client_assignments) has signed, the Blueprint
 * auto-generates. Replaces the old single-click generate — no one clinician can
 * finish it alone.
 */
export async function signoffConsolidated(formData: FormData) {
  const p = await getProfile();
  if (!p) return;
  const client_id = String(formData.get("client_id"));
  if (!client_id) return;
  const adminish = ["Super Admin", "Administrator", "Manager"].includes(p.role);
  // A clinician signs off their own discipline; an admin/persona may pass one.
  const disc = adminish ? String(formData.get("discipline") || "") : (BP_ROLE_TO_DISC[p.role] ?? "");
  if (!disc || !BP_DISC_TO_KIND[disc]) return;

  const supabase = createClient();
  // Must be on this client's care team (admins may sign any).
  const { data: asg } = await supabase.from("client_assignments").select("discipline").eq("client_id", client_id);
  const assigned = new Set(((asg ?? []) as { discipline: string }[]).map((a) => a.discipline).filter((d) => BP_DISC_TO_KIND[d]));
  if (!assigned.has(disc) && !adminish) return;

  // The consolidated summary must exist and not be generated yet.
  const { data: bp } = await supabase.from("blueprints").select("consolidated, generated").eq("client_id", client_id).maybeSingle();
  const bpRow = bp as { consolidated: string | null; generated: boolean } | null;
  if (!bpRow?.consolidated || bpRow.generated) return;

  // Gate 1: if this discipline has a consultation, its own summary must be
  // approved before signing the consolidated.
  const kind = BP_DISC_TO_KIND[disc];
  const { data: cons } = await supabase.from("consultations").select("approved").eq("client_id", client_id).eq("kind", kind);
  const consRows = (cons ?? []) as { approved: boolean }[];
  if (consRows.length > 0 && !consRows.some((c) => c.approved) && !adminish) return;

  await supabase.from("blueprint_signoffs").upsert({ client_id, discipline: disc, by_name: p.name, by_role: p.role, signed_at: new Date().toISOString() });
  await logAudit(p, "Consolidated summary signed off", await clientName(supabase, client_id), disc);

  // All assigned disciplines signed? → generate.
  const required = [...assigned];
  const { data: signs } = await supabase.from("blueprint_signoffs").select("discipline").eq("client_id", client_id);
  const signed = new Set(((signs ?? []) as { discipline: string }[]).map((s) => s.discipline));
  if (required.length > 0 && required.every((d) => signed.has(d))) {
    const now = new Date().toISOString();
    await supabase.from("blueprints").update({
      status: "generated", generated: true, generated_date: todayISO(),
      consolidated_at: now, approved: true, approved_at: now, approved_by: p.name, updated_at: now,
    }).eq("client_id", client_id);
    // The BluePrint package is a one-time deliverable — its job is done the
    // moment the report generates. Close it so it stops reading as "active".
    await supabase.from("client_packages").update({ status: "completed" })
      .eq("client_id", client_id).eq("category", "blueprint").eq("status", "active");
    await logAudit(p, "Blueprint generated (all sign-offs complete)", await clientName(supabase, client_id), null);
    await notifyRoles(supabase, ["Administrator", "Manager", "Super Admin"], {
      title: "BluePrint generated", body: `${await clientName(supabase, client_id)} — all clinicians signed off.`, href: "/blueprint", icon: "🧬",
    });
  }

  revalidatePath("/workspace");
  revalidatePath("/blueprint");
  revalidatePath(`/clients/${client_id}`);
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
  // Race-safe: a Postgres sequence (next_invoice_num) hands out each number
  // exactly once, so two concurrent conversions can't collide. Falls back to
  // max()+1 when the DB function isn't present yet (i.e. before the migration
  // is run), so a deploy is safe regardless of ordering.
  const { data, error } = await supabase.rpc("next_invoice_num");
  if (!error && typeof data === "number") return data;
  const { data: row } = await supabase.from("invoices").select("num").order("num", { ascending: false }).limit(1).maybeSingle();
  return ((row?.num as number | null) ?? 0) + 1;
}

async function nextClientCode(supabase: ReturnType<typeof createClient>) {
  // Same idea for the CUR-### code — a sequence avoids collisions and the reuse
  // that count()+1 caused when a client was deleted. Falls back pre-migration.
  const { data, error } = await supabase.rpc("next_client_code");
  if (!error && typeof data === "string" && data) return data;
  const { count } = await supabase.from("clients").select("id", { count: "exact", head: true });
  return "CUR-" + String((count ?? 0) + 1).padStart(3, "0");
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

/**
 * One-click "Raise invoice" from the dashboard exception queue: bill a client's
 * package that has no invoice against it. Reads the price off the package so the
 * amount can't be fudged from the client, and refuses to double-invoice — if any
 * invoice already exists for the client it no-ops (the flag would already be
 * gone), so a double-click can't create two.
 */
export async function raiseInvoiceForClient(formData: FormData) {
  const p = await getProfile();
  if (!p || !canManageInvoices(p.role)) return;
  const client_id = String(formData.get("client_id") || "");
  if (!client_id) return;
  const supabase = createClient();

  const { data: c } = await supabase.from("clients").select("id, name, email, package_id").eq("id", client_id).maybeSingle();
  if (!c?.package_id) return;

  const { data: existing } = await supabase.from("invoices").select("id").eq("client_id", client_id).limit(1);
  if (existing && existing.length) { revalidatePath("/dashboard"); return; }

  const { data: pkg } = await supabase.from("packages").select("name, price").eq("id", c.package_id).maybeSingle();
  if (!pkg) return;

  const amount = Number(pkg.price ?? 0);
  const description = `${pkg.name} package`;
  const num = await nextInvoiceNum(supabase);
  await supabase.from("invoices").insert({
    num, client_id, description, amount, status: "Unpaid", issued_date: todayISO(), created_by: p.name,
  });
  await logAudit(p, "Invoice raised", description, `₹${amount}`);
  if (c.email) {
    await notifyEmail({ supabase, to: c.email, clientId: client_id, template: "invoice", tpl: tplInvoiceCreated(c.name ?? "there", `INV-${String(num).padStart(3, "0")}`, amount, description), actor: p.name });
  }
  revalidatePath("/dashboard");
  revalidatePath("/billing");
  revalidatePath(`/clients/${client_id}`);
}

export async function markInvoicePaid(formData: FormData) {
  const p = await getProfile();
  if (!p || !canRecordPayment(p.role)) return;
  const id = String(formData.get("id"));
  const method = String(formData.get("method") ?? "").trim() || "Cash";
  const supabase = createClient();
  // Read first so we can (a) avoid double-posting a receipt if it was already
  // Paid and (b) build the matching cash-book entry from the invoice details.
  const { data: inv } = await supabase.from("invoices")
    .select("num, amount, status, client_id").eq("id", id).maybeSingle();
  const row = inv as { num: number | null; amount: number; status: string; client_id: string | null } | null;
  const alreadyPaid = row?.status === "Paid";

  await supabase.from("invoices").update({ status: "Paid", paid_date: todayISO(), method }).eq("id", id);
  await logAudit(p, "Invoice marked paid", null, method);

  // Auto-post the received money into the cash book, so confirming a payment
  // records it once — not twice. Cash → the cash account (auto-vouchered);
  // card / UPI / bank / online → the bank account. Skipped when it was already
  // Paid, so re-confirming can't create a duplicate receipt.
  if (row && !alreadyPaid && Number(row.amount) > 0) {
    const account = method.trim().toLowerCase() === "cash" ? "cash" : "bank";
    await supabase.from("ledger").insert({
      account, date: todayISO(),
      ref: `INV-${String(row.num ?? 0).padStart(3, "0")}`,
      party: row.client_id ? await clientName(supabase, row.client_id) : null,
      kind: method, direction: "in",
      amount: Number(row.amount) || 0, created_by: p.name,
    });
  }

  revalidatePath("/billing");
  revalidatePath("/finsheets");
  revalidatePath("/", "layout");
}

export async function refundInvoice(formData: FormData) {
  const p = await getProfile();
  if (!p || !canManageInvoices(p.role)) return;
  const id = String(formData.get("id"));
  const supabase = createClient();
  const { data: inv } = await supabase.from("invoices")
    .select("num, amount, status, method, client_id").eq("id", id).maybeSingle();
  const row = inv as { num: number | null; amount: number; status: string; method: string | null; client_id: string | null } | null;
  // Only a genuinely Paid invoice can be refunded — refunding an Unpaid one
  // would flip the status for money that was never collected (and, below, post a
  // phantom outflow into the cash book).
  if (!row || row.status !== "Paid") return;

  await supabase.from("invoices").update({ status: "Refunded" }).eq("id", id);

  // Reverse the original receipt in the cash book, mirroring the "in" entry
  // markInvoicePaid posted, so balances aren't left overstated after a refund.
  if (Number(row.amount) > 0) {
    const method = row.method ?? "Cash";
    const account = method.trim().toLowerCase() === "cash" ? "cash" : "bank";
    await supabase.from("ledger").insert({
      account, date: todayISO(),
      ref: `INV-${String(row.num ?? 0).padStart(3, "0")} refund`,
      party: row.client_id ? await clientName(supabase, row.client_id) : null,
      kind: method, direction: "out",
      amount: Number(row.amount) || 0, created_by: p.name,
    });
  }
  await logAudit(p, "Invoice refunded", null, `₹${row.amount}`);
  revalidatePath("/billing");
  revalidatePath("/finsheets");
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
  const date = String(formData.get("date") || todayISO());
  const vals = {
    systolic: emrNum(formData, "systolic"), diastolic: emrNum(formData, "diastolic"),
    pulse: emrNum(formData, "pulse"), temp_c: emrNum(formData, "temp_c"),
    resp_rate: emrNum(formData, "resp_rate"), spo2: emrNum(formData, "spo2"),
    weight: emrNum(formData, "weight"), height: emrNum(formData, "height"),
    notes: emrText(formData, "notes"), recorded_by: p.name,
  };
  // The console is one encounter, so pressing Save vitals twice should correct
  // today's reading, not stack a third near-identical row. In the EMR the same
  // action stays an append — a pre/post reading on the same day is legitimate
  // there, and the form lets you pick the date.
  const oncePerDay = String(formData.get("once_per_day") || "") === "true";
  const existingId = oncePerDay
    ? ((await supabase.from("vitals").select("id").eq("client_id", client_id).eq("date", date).limit(1).maybeSingle()).data as { id: string } | null)?.id ?? null
    : null;
  if (existingId) await supabase.from("vitals").update(vals).eq("id", existingId);
  else await supabase.from("vitals").insert({ client_id, date, ...vals });
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
  const pf = Number(formData.get("pf")) || 0;
  // Total statutory deductions from the salary breakup (PF + ESI + PT + TDS),
  // so net matches the employee's Salary breakup, not just PF.
  const deductions = Number(formData.get("deductions")) || pf;
  const perDay = base / 30;
  const net = Math.max(0, base - lop_days * perDay - deductions);
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
  const me = await getProfile();
  const id = String(formData.get("id"));
  const fallbackHref = String(formData.get("href") || "");
  // Resolve the destination fresh from the stored intent (link_kind/link_ref) so
  // a reminder always opens the current screen, even if that screen has since
  // moved. Falls back to the frozen href for notifications without an intent.
  let target = fallbackHref;
  if (me) {
    const { data: n } = await supabase.from("notifications").select("href, link_kind, link_ref").eq("id", id).eq("user_id", me.id).maybeSingle();
    const row = n as { href: string | null; link_kind: string | null; link_ref: string | null } | null;
    target = resolveNotificationTarget(row?.link_kind ?? null, row?.link_ref ?? null) ?? row?.href ?? fallbackHref;
    await supabase.from("notifications").update({ read: true }).eq("id", id).eq("user_id", me.id);
  }
  revalidatePath("/", "layout");
  if (target) redirect(target);
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

// ---- HR expansion: leave types, holidays, employee docs, salary breakup -----

// Change a leave type's yearly entitlement. Manager/Admin apply it immediately;
// HR can only *propose* a change (parked in pending_days) that a Manager/Admin
// must approve. Names/active flags follow the same gate.
export async function saveLeaveType(formData: FormData) {
  const p = await getProfile();
  if (!p || !canHr(p.role)) return;
  const code = String(formData.get("code") || "").trim().toUpperCase();
  if (!code) return;
  const days = Math.max(0, Number(formData.get("annual_days")) || 0);
  const supabase = createClient();
  if (canApproveLeaveType(p.role)) {
    // Approver → applies directly and clears any pending proposal.
    await supabase.from("leave_types").update({ annual_days: days, pending_days: null, pending_by: null, pending_at: null }).eq("code", code);
    await logAudit(p, "Leave type entitlement set", code, `${days} days`);
  } else {
    // HR → records a proposal awaiting approval; entitlement itself unchanged.
    await supabase.from("leave_types").update({ pending_days: days, pending_by: p.name, pending_at: new Date().toISOString() }).eq("code", code);
    await logAudit(p, "Leave type change proposed", code, `${days} days`);
    await notifyRoles(supabase, ["Administrator", "Manager", "Super Admin"], {
      title: "Leave entitlement change requested",
      body: `${code} → ${days} days · proposed by ${p.name}`,
      href: "/hr?tab=leave", icon: "📝",
    });
  }
  revalidatePath("/hr");
}

// Manager/Admin approves or rejects a proposed leave-type entitlement change.
export async function decideLeaveType(formData: FormData) {
  const p = await getProfile();
  if (!p || !canApproveLeaveType(p.role)) return;
  const code = String(formData.get("code") || "").trim().toUpperCase();
  const decision = String(formData.get("decision") || "");
  if (!code || !["approve", "reject"].includes(decision)) return;
  const supabase = createClient();
  const { data: lt } = await supabase.from("leave_types").select("pending_days, pending_by").eq("code", code).maybeSingle();
  const row = lt as { pending_days: number | null; pending_by: string | null } | null;
  if (!row || row.pending_days === null) return;
  if (decision === "approve") {
    await supabase.from("leave_types").update({ annual_days: row.pending_days, pending_days: null, pending_by: null, pending_at: null }).eq("code", code);
  } else {
    await supabase.from("leave_types").update({ pending_days: null, pending_by: null, pending_at: null }).eq("code", code);
  }
  await logAudit(p, decision === "approve" ? "Leave type change approved" : "Leave type change rejected", code, `${row.pending_days} days`);
  await notifyRoles(supabase, ["HR"], {
    title: `Leave entitlement change ${decision === "approve" ? "approved" : "rejected"}`,
    body: `${code} → ${row.pending_days} days · by ${p.name}`,
    href: "/hr?tab=leave", icon: decision === "approve" ? "✅" : "🚫",
  });
  revalidatePath("/hr");
}

export async function addHoliday(formData: FormData) {
  const p = await getProfile();
  if (!p || !canHr(p.role)) return;
  const date = String(formData.get("date") || "");
  const name = String(formData.get("name") || "").trim();
  if (!date || !name) return;
  const supabase = createClient();
  await supabase.from("holidays").upsert(
    { date, name, kind: String(formData.get("kind") || "Public"), created_by: p.name },
    { onConflict: "date,name", ignoreDuplicates: true },
  );
  await logAudit(p, "Holiday added", name, date);
  revalidatePath("/hr");
}

export async function deleteHoliday(formData: FormData) {
  const p = await getProfile();
  if (!p || !canHr(p.role)) return;
  const id = String(formData.get("id") || "");
  if (!id) return;
  const supabase = createClient();
  await supabase.from("holidays").delete().eq("id", id);
  revalidatePath("/hr");
}

export async function updateStaffEmployment(formData: FormData) {
  const p = await getProfile();
  if (!p || !canHr(p.role)) return;
  const id = String(formData.get("staff_id") || "");
  if (!id) return;
  const supabase = createClient();
  await supabase.from("staff").update({
    date_of_joining: String(formData.get("date_of_joining") || "") || null,
    gender: String(formData.get("gender") || "") || null,
    emp_code: String(formData.get("emp_code") || "").trim() || null,
    work_location: String(formData.get("work_location") || "").trim() || null,
    bank_name: String(formData.get("bank_name") || "").trim() || null,
    bank_account: String(formData.get("bank_account") || "").trim() || null,
    ifsc: String(formData.get("ifsc") || "").trim().toUpperCase() || null,
  }).eq("id", id);
  await logAudit(p, "Employment details updated", id, null);
  revalidatePath("/hr");
}

// Templates & Branding — save the editable settings blob. Admins / Super Admins
// only. `payload` is the full AppSettings JSON from the editor.
export async function saveAppSettings(payload: string): Promise<{ ok?: boolean; error?: string }> {
  const p = await getProfile();
  if (!p || !["Administrator", "Super Admin"].includes(p.role)) return { error: "Not authorized." };
  let data: unknown;
  try { data = JSON.parse(payload); } catch { return { error: "Invalid data." }; }
  const supabase = createClient();
  const { error } = await supabase.from("app_settings").upsert({ id: 1, data, updated_by: p.name, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) return { error: error.message };
  await logAudit(p, "Templates & branding updated", null, null);
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Upload a printable sheet design (prescription / lab requisition) to the
 * public `branding` bucket and return its URL for app_settings.
 *
 * Stored as a file rather than inlined into the settings JSON: an A4 artwork
 * base64-encoded into a row that every page reads would cost megabytes per
 * request. Public read is deliberate — this is clinic stationery, not patient
 * data, and it lets the print pages render without signing a URL.
 */
export async function uploadDocTemplate(formData: FormData): Promise<{ url?: string; error?: string }> {
  const p = await getProfile();
  if (!p || !["Administrator", "Super Admin"].includes(p.role)) return { error: "Not authorized." };
  const kind = String(formData.get("kind") || "");
  if (!["rx", "lab", "plan", "summary", "assess"].includes(kind)) return { error: "Unknown document type." };
  // "frame" repeats on every page; "cover" is page one of a flowing document.
  const slot = String(formData.get("slot") || "frame");
  if (!["frame", "cover"].includes(slot)) return { error: "Unknown template slot." };
  const file = formData.get("file");
  if (!(file instanceof File) || !file.size) return { error: "Choose a file first." };
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return { error: "Use a PNG, JPG or WebP image of the full A4 sheet." };
  if (file.size > 5_000_000) return { error: "Design too large — keep it under 5 MB." };

  const supabase = createClient();
  // Cache-busting name: replacing a design must not leave the old artwork in a
  // CDN cache on a public bucket.
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `sheets/${kind}-${slot}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("branding").upload(path, file, { contentType: file.type, upsert: true });
  if (error) return { error: error.message };
  const { data } = supabase.storage.from("branding").getPublicUrl(path);
  await logAudit(p, "Sheet design uploaded", null, `${kind} ${slot} · ${file.name}`);
  return { url: data.publicUrl };
}

// ---- health-coach marker assessments ---------------------------------------

/** Record a coach marker score (stress/sleep/activity/nutrition/substance/anxiety).
 *  Bands are derived from the SOP; a "bad" band raises a concern on the client. */
export async function saveCoachAssessment(formData: FormData) {
  const p = await getProfile();
  if (!p || !["Administrator", "Super Admin", "Manager", "Health Coach"].includes(p.role)) return;
  const client_id = String(formData.get("client_id") || "");
  const marker = String(formData.get("marker") || "");
  const { MARKER_BY_KEY, bandFor } = await import("@/lib/coach-markers");
  const m = (MARKER_BY_KEY as Record<string, { label: string }>)[marker];
  if (!client_id || !m) return;
  const score = Number(formData.get("score"));
  if (!Number.isFinite(score)) return;
  const b = bandFor(marker as never, score);
  const note = String(formData.get("note") || "").trim() || null;
  // The instrument may override the band (e.g. DAST-10 ≥3 makes substance use
  // "positive" even when AUDIT-C alone is low).
  const forceBad = String(formData.get("force_bad") || "") === "1";
  const tone = forceBad ? "bad" : (b?.tone ?? null);
  const band = forceBad ? "Positive" : (b?.label ?? null);
  let detail: unknown = null;
  try { const d = String(formData.get("detail") || ""); if (d) detail = JSON.parse(d); } catch { detail = null; }
  const supabase = createClient();
  await supabase.from("coach_assessments").insert({
    client_id, marker, score, band, tone, note, detail, assessed_by: p.name,
  });
  // A "bad" band is an SOP action/referral trigger — surface it as a concern.
  if (tone === "bad") {
    await supabase.from("concerns").insert({
      client_id, role: "coach", category: "Health Coaching",
      body: `${m.label}: ${band ?? "flagged"} (score ${score}) — SOP action/referral trigger.`,
      raised_by: p.name, status: "Open",
    });
  }
  await logAudit(p, "Coach assessment recorded", `${marker}=${score}`, client_id);
  revalidatePath("/workspace");
}

// ---- attendance kiosk ------------------------------------------------------

type PunchResult = { ok?: boolean; name?: string; action?: "in" | "out" | "already"; at?: string; hours?: number; error?: string };

// Toggle today's in/out for a staff member. First punch = check-in (present);
// second = check-out + work hours; third is ignored.
async function doPunch(staffId: string, staffName: string, mode: string): Promise<PunchResult> {
  const supabase = createClient();
  const today = todayISO();
  const now = new Date().toISOString();
  const { data: row } = await supabase.from("attendance")
    .select("id, check_in, check_out").eq("staff_id", staffId).eq("date", today).maybeSingle();
  const r = row as { id: string; check_in: string | null; check_out: string | null } | null;

  if (!r || !r.check_in) {
    await supabase.from("attendance").upsert(
      { staff_id: staffId, date: today, status: "present", check_in: now, mode, marked_by: "kiosk" },
      { onConflict: "staff_id,date" });
    revalidatePath("/hr");
    return { ok: true, name: staffName, action: "in", at: now };
  }
  if (!r.check_out) {
    const hrs = Math.round(((Date.now() - Date.parse(r.check_in)) / 3600000) * 100) / 100;
    await supabase.from("attendance").update({ check_out: now, work_hours: hrs }).eq("id", r.id);
    revalidatePath("/hr");
    return { ok: true, name: staffName, action: "out", at: now, hours: hrs };
  }
  return { ok: true, name: staffName, action: "already" };
}

/** Kiosk: punch by scanned badge code. */
export async function punchByBadge(code: string): Promise<PunchResult> {
  const p = await getProfile();
  if (!p) return { error: "Kiosk not signed in." };
  const c = (code || "").trim();
  if (!c) return { error: "No badge scanned." };
  const supabase = createClient();
  const { data: s } = await supabase.from("staff").select("id, name").eq("badge_code", c).maybeSingle();
  const st = s as { id: string; name: string } | null;
  if (!st) return { error: "Badge not recognised." };
  return doPunch(st.id, st.name, "kiosk");
}

/** Kiosk: punch by name + PIN (manual identify). */
export async function punchByPin(staffId: string, pin: string): Promise<PunchResult> {
  const p = await getProfile();
  if (!p) return { error: "Kiosk not signed in." };
  const supabase = createClient();
  const { data: s } = await supabase.from("staff").select("id, name, pin").eq("id", staffId).maybeSingle();
  const st = s as { id: string; name: string; pin: string | null } | null;
  if (!st) return { error: "Staff not found." };
  if (!st.pin || st.pin !== (pin || "").trim()) return { error: "Wrong PIN." };
  return doPunch(st.id, st.name, "manual");
}

/** HR: assign / regenerate a staff member's badge code and PIN. */
export async function setStaffBadge(formData: FormData): Promise<{ ok?: boolean; badge?: string; pin?: string; error?: string }> {
  const p = await getProfile();
  if (!p || !canHr(p.role)) return { error: "Not authorized." };
  const staff_id = String(formData.get("staff_id") || "");
  if (!staff_id) return { error: "Missing staff." };
  const supabase = createClient();
  const badge = "CURB" + Math.random().toString(36).slice(2, 10).toUpperCase();
  const pin = String(Math.floor(1000 + Math.random() * 9000));
  const { error } = await supabase.from("staff").update({ badge_code: badge, pin }).eq("id", staff_id);
  if (error) return { error: error.message };
  await logAudit(p, "Attendance badge issued", staff_id, null);
  revalidatePath("/hr");
  return { ok: true, badge, pin };
}

export async function saveSalaryStructure(formData: FormData) {
  const p = await getProfile();
  if (!p || !canHr(p.role)) return;
  const staff_id = String(formData.get("staff_id") || "");
  if (!staff_id) return;
  const num = (k: string) => Math.max(0, Number(formData.get(k)) || 0);
  const supabase = createClient();
  await supabase.from("salary_structures").upsert({
    staff_id, basic: num("basic"), hra: num("hra"), allowances: num("allowances"), gst: num("gst"),
    pf: num("pf"), esi: num("esi"), pt: num("pt"), tds: num("tds"),
    effective_from: String(formData.get("effective_from") || "") || null,
    updated_by: p.name, updated_at: new Date().toISOString(),
  }, { onConflict: "staff_id" });
  await logAudit(p, "Salary structure saved", staff_id, null);
  revalidatePath("/hr");
}

export async function uploadEmployeeDoc(_prev: UploadState, formData: FormData): Promise<UploadState> {
  const me = await getProfile();
  if (!me || !canHr(me.role)) return { error: "Not authorized." };
  const staff_id = String(formData.get("staff_id") || "");
  const title = String(formData.get("title") || "").trim();
  const kind = String(formData.get("kind") || "Document");
  const file = formData.get("file");
  if (!staff_id) return { error: "Pick an employee." };
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file." };
  if (file.size > 10 * 1024 * 1024) return { error: "File too large (max 10 MB)." };
  const supabase = createClient();
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${staff_id}/${crypto.randomUUID()}-${safe}`;
  const { error } = await supabase.storage.from("hr-files").upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (error) return { error: error.message };
  await supabase.from("employee_documents").insert({ staff_id, title: title || file.name, kind, bucket: "hr-files", path, name: file.name, uploaded_by: me.name });
  await logAudit(me, "Employee document uploaded", staff_id, `${kind}: ${file.name}`);
  revalidatePath("/hr");
  return { ok: "Uploaded." };
}

export async function deleteEmployeeDoc(formData: FormData) {
  const p = await getProfile();
  if (!p || !canHr(p.role)) return;
  const id = String(formData.get("id") || "");
  if (!id) return;
  const supabase = createClient();
  const { data: d } = await supabase.from("employee_documents").select("path").eq("id", id).maybeSingle();
  if ((d as { path: string } | null)?.path) await supabase.storage.from("hr-files").remove([(d as { path: string }).path]);
  await supabase.from("employee_documents").delete().eq("id", id);
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

// ---- compensatory leave -----------------------------------------------------
// A restricted holiday can only be granted to some of the team; whoever works
// it is owed the day back. That was being tracked in someone's memory.

export async function grantCompOff(formData: FormData) {
  const p = await getProfile();
  if (!p || !canHr(p.role)) return { error: "Not permitted" };
  const staff_id = String(formData.get("staff_id") || "");
  const earned_on = String(formData.get("earned_on") || "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!staff_id || !earned_on || !reason) return { error: "Staff, date and reason are all needed." };

  const { compOffExpiry } = await import("@/lib/roster");
  const supabase = createClient();
  const { error } = await supabase.from("comp_offs").insert({
    staff_id, earned_on, reason,
    // Stored, not computed on read: changing the policy later must not
    // retroactively expire credits already promised to someone.
    expires_on: compOffExpiry(earned_on),
    granted_by: p.name,
  });
  if (error) return { error: error.message };

  await logAudit(p, "Comp-off granted", null, `${earned_on} · ${reason}`);
  await notifyStaff(supabase, staff_id, {
    title: "Compensatory off granted",
    body: `${reason} · use it by ${compOffExpiry(earned_on)}`,
    href: "/hr?tab=leave", icon: "🕐",
  });
  revalidatePath("/hr");
  return { ok: true };
}

/** Cancel a credit granted in error. Never deletes — the ledger is the answer
 *  to "why do I have three?", so a cancelled row stays visible with its note. */
export async function cancelCompOff(formData: FormData) {
  const p = await getProfile();
  if (!p || !canHr(p.role)) return;
  const id = String(formData.get("id") || "");
  if (!id) return;
  const supabase = createClient();
  await supabase.from("comp_offs")
    .update({ status: "cancelled", note: String(formData.get("note") ?? "").trim() || null })
    .eq("id", id).eq("status", "available");
  await logAudit(p, "Comp-off cancelled", null, null);
  revalidatePath("/hr");
}

/**
 * Spend a comp-off credit on a day off.
 *
 * Creates the leave AND consumes the oldest available credit in one step, so a
 * balance can never drift from the leaves it paid for. Oldest-first because
 * credits expire — spending a newer one would let an older one lapse.
 */
export async function takeCompOff(formData: FormData) {
  const p = await getProfile();
  if (!p || !canHr(p.role)) return { error: "Not permitted" };
  const staff_id = String(formData.get("staff_id") || "");
  const date = String(formData.get("date") || "");
  if (!staff_id || !date) return { error: "Staff and date are needed." };
  const supabase = createClient();

  const today = todayISO();
  const { data: credits } = await supabase.from("comp_offs")
    .select("id, expires_on").eq("staff_id", staff_id).eq("status", "available")
    .gte("expires_on", today).order("expires_on", { ascending: true }).limit(1);
  const credit = ((credits ?? []) as { id: string; expires_on: string }[])[0];
  if (!credit) return { error: "No comp-off credit available for this staff member." };

  const { data: lv } = await supabase.from("leaves").insert({
    staff_id, from_date: date, to_date: date, type: "COMP",
    reason: String(formData.get("reason") ?? "").trim() || "Compensatory off",
    status: "approved", decided_by: p.name,
  }).select("id").maybeSingle();

  await supabase.from("comp_offs").update({
    status: "used", used_leave: (lv as { id: string } | null)?.id ?? null, used_on: date,
  }).eq("id", credit.id);

  await logAudit(p, "Comp-off taken", null, date);
  revalidatePath("/hr");
  return { ok: true };
}

// ---- roster -----------------------------------------------------------------

/** Assign (or clear) one person's shift on one day. */
export async function setRosterShift(formData: FormData) {
  const p = await getProfile();
  if (!p || !canHr(p.role)) return;
  const staff_id = String(formData.get("staff_id") || "");
  const date = String(formData.get("date") || "");
  const shift = String(formData.get("shift") || "");
  if (!staff_id || !date) return;
  const supabase = createClient();

  if (!shift) {
    await supabase.from("roster").delete().eq("staff_id", staff_id).eq("date", date);
  } else {
    await supabase.from("roster").upsert({
      staff_id, date, shift,
      start_time: String(formData.get("start_time") ?? "") || null,
      end_time: String(formData.get("end_time") ?? "") || null,
      start_time2: String(formData.get("start_time2") ?? "") || null,
      end_time2: String(formData.get("end_time2") ?? "") || null,
      note: String(formData.get("note") ?? "").trim() || null,
      created_by: p.name, updated_at: new Date().toISOString(),
    }, { onConflict: "staff_id,date" });
  }
  revalidatePath("/hr");
}

/**
 * Copy a whole week forward. Rosters repeat far more often than they change,
 * and filling 20 staff × 7 days by hand is how a roster stops being kept.
 * Existing entries in the target week are left alone — copying must never
 * silently overwrite a shift someone has already adjusted.
 */
export async function copyRosterWeek(formData: FormData) {
  const p = await getProfile();
  if (!p || !canHr(p.role)) return { error: "Not permitted" };
  const from = String(formData.get("from_week") || "");
  const to = String(formData.get("to_week") || "");
  if (!from || !to) return { error: "Both weeks are needed." };
  const supabase = createClient();

  const { weekDates, addDays } = await import("@/lib/roster");
  const src = weekDates(from), dst = weekDates(to);
  const { data: rows } = await supabase.from("roster")
    .select("staff_id, date, shift, start_time, end_time, start_time2, end_time2, note").in("date", src);
  const source = (rows ?? []) as { staff_id: string; date: string; shift: string; start_time: string | null; end_time: string | null; start_time2: string | null; end_time2: string | null; note: string | null }[];
  if (!source.length) return { error: "That week is empty — nothing to copy." };

  const { data: existing } = await supabase.from("roster").select("staff_id, date").in("date", dst);
  const taken = new Set(((existing ?? []) as { staff_id: string; date: string }[]).map((r) => `${r.staff_id}|${r.date}`));

  const shifted = source
    .map((r) => ({ ...r, date: addDays(r.date, 7 * Math.round((Date.parse(`${dst[0]}T00:00:00Z`) - Date.parse(`${src[0]}T00:00:00Z`)) / 604_800_000)), created_by: p.name }))
    .filter((r) => !taken.has(`${r.staff_id}|${r.date}`));
  if (!shifted.length) return { error: "That week is already filled in." };

  const { error } = await supabase.from("roster").insert(shifted);
  if (error) return { error: error.message };
  await logAudit(p, "Roster week copied", null, `${src[0]} → ${dst[0]} · ${shifted.length} shifts`);
  revalidatePath("/hr");
  return { ok: true, copied: shifted.length };
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

// ---- Workout Planner (per-client builder, mirrors the diet chart maker) -----
// The trainer composes a plan exercise-by-exercise, saves it as a Draft, then
// Publishes it to the client's portal — exactly like addDietChart/publishDietChart.
export async function addWorkoutPlan(formData: FormData) {
  const p = await getProfile();
  if (!p || !canConsult(p.role) || !canWriteFitness(p.role)) return; // trainer-owned
  const client_id = String(formData.get("client_id") || "") || null;
  if (!client_id) return;
  const name = String(formData.get("name") || "").trim() || "Workout plan";
  const type = String(formData.get("type") || "Strength").trim() || "Strength";
  const mode = String(formData.get("mode") || "Offline").trim() || "Offline";
  const exercises = formData.getAll("ex_name").map((v) => String(v).trim());
  const sets = formData.getAll("ex_sets").map((v) => String(v).trim());
  const reps = formData.getAll("ex_reps").map((v) => String(v).trim());
  const rest = formData.getAll("ex_rest").map((v) => String(v).trim());
  const items = exercises
    .map((exercise, i) => ({ exercise, sets: sets[i] ?? "", reps: reps[i] ?? "", rest: rest[i] ?? "" }))
    .filter((it) => it.exercise);
  if (items.length === 0) return;
  const supabase = createClient();
  const { count } = await supabase.from("client_workouts").select("id", { count: "exact", head: true }).eq("client_id", client_id);
  await supabase.from("client_workouts").insert({
    client_id, name, mode, type, items, status: "Draft",
    version: (count ?? 0) + 1,
    notes: String(formData.get("notes") || "").trim() || null,
    by_name: p.name, assigned_by: p.name,
  });
  await logAudit(p, "Workout plan drafted", await clientName(supabase, client_id), `v${(count ?? 0) + 1}`);
  revalidatePath("/workspace");
  revalidatePath(`/clients/${client_id}`);
}

export async function publishWorkoutPlan(formData: FormData) {
  const p = await getProfile();
  if (!p || !canConsult(p.role) || !canWriteFitness(p.role)) return; // trainer-owned
  const id = String(formData.get("id"));
  if (!id) return;
  const supabase = createClient();
  await supabase.from("client_workouts").update({ status: "Published" }).eq("id", id);
  await logAudit(p, "Workout plan published", id, null);
  revalidatePath("/workspace");
}

export async function deleteWorkoutPlan(formData: FormData) {
  const p = await getProfile();
  if (!p || !canConsult(p.role) || !canWriteFitness(p.role)) return; // trainer-owned
  const id = String(formData.get("id"));
  if (!id) return;
  const supabase = createClient();
  await supabase.from("client_workouts").delete().eq("id", id);
  await logAudit(p, "Workout plan deleted", id, null);
  revalidatePath("/workspace");
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
  if (!p || !canFinanceOps(p.role)) return; // Admin / Manager / Finance
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
  if (!p || !canFinanceOps(p.role)) return;
  const supabase = createClient();
  await supabase.from("payables").update({ status: "Paid" }).eq("id", String(formData.get("id")));
  await logAudit(p, "Payable paid", null, null);
  revalidatePath("/finsheets");
}

export async function addEstimate(formData: FormData) {
  const p = await getProfile();
  if (!p || !canFinanceOps(p.role)) return;
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
  if (!p || !canFinanceOps(p.role)) return;
  const status = String(formData.get("status"));
  if (!["Draft", "Sent", "Accepted", "Expired"].includes(status)) return;
  const supabase = createClient();
  await supabase.from("estimates").update({ status }).eq("id", String(formData.get("id")));
  await logAudit(p, `Estimate ${status}`, null, null);
  revalidatePath("/finsheets");
}

export async function addLedgerEntry(formData: FormData) {
  const p = await getProfile();
  if (!p || !canFinanceOps(p.role)) return;
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

// ---- staff reimbursements --------------------------------------------------

export async function submitReimbursement(formData: FormData) {
  const p = await getProfile();
  if (!p || !canReimburseSubmit(p.role)) return;
  const description = String(formData.get("description") ?? "").trim();
  const payee_name = String(formData.get("payee_name") ?? "").trim();
  if (!description || !payee_name) return;
  const supabase = createClient();

  // Optional receipt image → private finance bucket. A failed upload must not
  // sink the claim; the receipt is evidence, not the record.
  let receipt_bucket: string | null = null;
  let receipt_path: string | null = null;
  const file = formData.get("receipt");
  if (file instanceof File && file.size > 0 && file.size <= 10 * 1024 * 1024) {
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `reimbursements/${crypto.randomUUID()}-${safe}`;
    const { error } = await supabase.storage.from("finance").upload(path, file, { contentType: file.type || undefined, upsert: false });
    if (!error) { receipt_bucket = "finance"; receipt_path = path; }
  }

  const payee_staff = String(formData.get("payee_staff") ?? "").trim() || null;
  await supabase.from("reimbursements").insert({
    payee_staff, payee_name, description,
    category: String(formData.get("category") || "Other"),
    amount: Number(formData.get("amount")) || 0,
    incurred_date: String(formData.get("incurred_date") || todayISO()),
    status: "Submitted", receipt_bucket, receipt_path, submitted_by: p.name,
  });
  await logAudit(p, "Reimbursement submitted", payee_name, `₹${Number(formData.get("amount")) || 0}`);
  revalidatePath("/finsheets");
}

export async function approveReimbursement(formData: FormData) {
  const p = await getProfile();
  if (!p || !canReimburseApprove(p.role)) return;
  const supabase = createClient();
  const id = String(formData.get("id"));
  // Only a Submitted claim can be approved.
  await supabase.from("reimbursements")
    .update({ status: "Approved", approved_by: p.name, approved_at: new Date().toISOString() })
    .eq("id", id).eq("status", "Submitted");
  await logAudit(p, "Reimbursement approved", null, null);
  revalidatePath("/finsheets");
}

export async function rejectReimbursement(formData: FormData) {
  const p = await getProfile();
  if (!p || !canReimburseApprove(p.role)) return;
  const supabase = createClient();
  const id = String(formData.get("id"));
  await supabase.from("reimbursements")
    .update({ status: "Rejected", reject_reason: String(formData.get("reason") ?? "").trim() || null, approved_by: p.name, approved_at: new Date().toISOString() })
    .eq("id", id).eq("status", "Submitted");
  await logAudit(p, "Reimbursement rejected", null, null);
  revalidatePath("/finsheets");
}

export async function payReimbursement(formData: FormData) {
  const p = await getProfile();
  if (!p || !canReimburseApprove(p.role)) return;
  const supabase = createClient();
  const id = String(formData.get("id"));
  const account = String(formData.get("account") || "bank") === "cash" ? "cash" : "bank";

  // Load the claim and refuse to pay twice (idempotent by status + expense_id).
  const { data: r } = await supabase.from("reimbursements")
    .select("id, payee_name, description, category, amount, incurred_date, status, expense_id")
    .eq("id", id).maybeSingle();
  if (!r || r.status !== "Approved" || r.expense_id) return;

  // Book the cost (P&L) — feeds "Spend this month".
  const { data: exp } = await supabase.from("expenses").insert({
    description: `Reimbursement — ${r.payee_name}: ${r.description}`,
    category: "Reimbursement",
    amount: Number(r.amount) || 0,
    date: todayISO(),
    created_by: p.name,
  }).select("id").single();

  // Book the cash leaving (bank/cash statement) — moves the balance.
  const { data: led } = await supabase.from("ledger").insert({
    account, date: todayISO(), ref: "REIMB", party: r.payee_name,
    kind: account === "cash" ? "Cash" : "NEFT", direction: "out",
    amount: Number(r.amount) || 0, created_by: p.name,
  }).select("id").single();

  await supabase.from("reimbursements").update({
    status: "Paid", pay_account: account,
    expense_id: exp?.id ?? null, ledger_id: led?.id ?? null,
    paid_by: p.name, paid_at: new Date().toISOString(),
  }).eq("id", id).eq("status", "Approved");

  await logAudit(p, "Reimbursement paid", r.payee_name, `${account} · ₹${Number(r.amount) || 0}`);
  revalidatePath("/finsheets");
  revalidatePath("/expenses");
}

// ---- petty cash imprest float ----------------------------------------------

export async function setPettyFloat(formData: FormData) {
  const p = await getProfile();
  if (!p || !canFinanceOps(p.role)) return;   // Admin / Manager / Finance
  const float_amount = Math.max(0, Number(formData.get("float_amount")) || 0);
  const low_threshold = Math.max(0, Number(formData.get("low_threshold")) || 0);
  const supabase = createClient();
  await supabase.from("petty_cash_config")
    .update({ float_amount, low_threshold, updated_by: p.name, updated_at: new Date().toISOString() })
    .eq("id", true);
  await logAudit(p, "Petty cash float set", null, `float ₹${float_amount} · low ₹${low_threshold}`);
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
  // The milestone anchor is the package start, not the join date — see
  // lib/followups.ts. Length comes along so a multi-cycle plan repeats.
  const [{ data: clients }, { data: subs }, { data: cps }] = await Promise.all([
    supabase.from("clients").select("id, joined"),
    supabase.from("subscriptions").select("client_id, renews_on").eq("status", "active"),
    supabase.from("client_packages").select("client_id, category, start_date, end_date").eq("status", "active"),
  ]);
  const packOf = new Map(
    ((cps ?? []) as { client_id: string; category: string | null; start_date: string | null; end_date: string | null }[])
      .map((r) => [r.client_id, r]),
  );
  const dayspan = (a: string | null, b: string | null) =>
    a && b ? Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000) : null;
  const rows = buildFollowupRows(
    ((clients ?? []) as { id: string; joined: string | null }[]).map((c) => {
      const pk = packOf.get(c.id);
      return {
        ...c,
        category: pk?.category ?? null,
        start: pk?.start_date ?? null,
        days: dayspan(pk?.start_date ?? null, pk?.end_date ?? null),
      };
    }),
    (subs ?? []) as { client_id: string; renews_on: string | null }[],
    p.name,
  );
  if (rows.length) {
    await supabase.from("followups").upsert(rows, { onConflict: "client_id,milestone_key", ignoreDuplicates: true });
  }
  await logAudit(p, "Follow-ups generated", null, `${rows.length} touchpoints`);
  revalidatePath("/followups");
}

export async function completeFollowup(formData: FormData) {
  const p = await getProfile();
  if (!p || !canWorkFollowups(p.role)) return;
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
  if (!p || !canWorkFollowups(p.role)) return;
  const id = String(formData.get("id"));
  const supabase = createClient();
  await supabase.from("followups").update({ status: "skipped", done_by: p.name, done_at: new Date().toISOString() }).eq("id", id);
  await logAudit(p, "Follow-up skipped", null, null);
  revalidatePath("/followups");
}

// ---- follow-up queue pipeline (call → link → review → closed) --------------
async function fuGuard() { const p = await getProfile(); return p && canWorkFollowups(p.role) ? p : null; }

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
  const { data: fu } = await supabase.from("followups").select("client_id, category, label").eq("id", id).maybeSingle();
  await supabase.from("followups").update({ stage: "BOOKED", status: "done", done_by: p.name, done_at: new Date().toISOString() }).eq("id", id);
  await logAudit(p, "Follow-up booked in-person", null, null);
  revalidatePath("/followups");
  // Hand the front desk straight to the Appointment Calendar, pre-filled with
  // this client and the owning discipline, so they book the real slot in the
  // same step rather than just flipping a status.
  const cid = (fu as { client_id: string | null } | null)?.client_id;
  if (cid) {
    const label = (fu as { label: string | null } | null)?.label ?? "";
    const hay = `${(fu as { category: string | null } | null)?.category ?? ""} ${label}`;
    const disc = /doctor/i.test(hay) ? "Doctor" : /diet/i.test(hay) ? "Dietitian" : /fitness|trainer/i.test(hay) ? "Fitness Trainer" : /coach/i.test(hay) ? "Health Coach" : /psych/i.test(hay) ? "Psychologist" : "";
    // Book the owning discipline's real service. "Follow-up" is not a catalogue
    // service, so a milestone could never match it — the queue row closed while
    // the milestone, its task and the client-card "overdue" line all stayed open.
    const { apptTypeForFollowup } = await import("@/lib/followups");
    const type = apptTypeForFollowup({ label, category: (fu as { category: string | null } | null)?.category ?? null });
    redirect(`/appointments?client=${cid}${disc ? `&disc=${encodeURIComponent(disc)}` : ""}&type=${encodeURIComponent(type)}`);
  }
  redirect("/followups");
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

export async function createAppointment(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const p = await getProfile();
  if (!p || !canEditAppointments(p.role)) return { ok: false, error: "Not permitted" };
  const client_id = String(formData.get("client_id"));
  const date = String(formData.get("date") || "");
  if (!client_id || !date) return { ok: false, error: "Missing client or date" };
  const supabase = createClient();
  const provider_id = String(formData.get("provider_id") || "") || null;

  // The discipline this booking is for (from the provider's role) — used both to
  // guard duplicates and to close the matching "Book …" prompt afterwards.
  let newDisc: string | null = null;
  if (provider_id) {
    const { data: np } = await supabase.from("staff").select("role").eq("id", provider_id).maybeSingle();
    newDisc = ROLE_TO_KIND[(np as { role?: string } | null)?.role ?? ""] ?? null;
  }

  // Guard: one INITIAL consultation per discipline per package. A package
  // includes a single doctor / dietitian / trainer consult, so refuse a second
  // "Consultation"/"Assessment" of the same discipline while any non-cancelled
  // one exists (scheduled OR completed). Follow-ups use a different type and are
  // not limited here.
  const newType = String(formData.get("type") || "Consultation");
  if (newDisc && isInitialApptType(newType)) {
    const { data: existing } = await supabase.from("appointments")
      .select("type, staff(role)").eq("client_id", client_id).neq("status", "cancelled");
    const dup = ((existing ?? []) as unknown as { type: string | null; staff: { role: string } | null }[])
      .some((a) => ROLE_TO_KIND[a.staff?.role ?? ""] === newDisc && isInitialApptType(a.type));
    if (dup) {
      const label = newDisc === "Diet" ? "dietitian" : newDisc === "Trainer" ? "fitness" : newDisc.toLowerCase();
      return { ok: false, error: `This client already has a ${label} consultation for this package. Cancel it first, or book a follow-up instead.` };
    }
  }

  const hour = Number(formData.get("hour")) || 9;

  // Slot clash: the same provider (or the same client) can't be booked twice at
  // the same date & time.
  const { data: sameSlot } = await supabase.from("appointments")
    .select("provider_id, client_id").eq("date", date).eq("hour", hour).eq("status", "scheduled");
  const slotRows = (sameSlot ?? []) as { provider_id: string | null; client_id: string | null }[];
  if (provider_id && slotRows.some((r) => r.provider_id === provider_id)) {
    return { ok: false, error: "That time is already booked for this provider. Pick another slot." };
  }
  if (slotRows.some((r) => r.client_id === client_id)) {
    return { ok: false, error: "This client already has an appointment at that time." };
  }

  await supabase.from("appointments").insert({
    client_id,
    provider_id,
    type: String(formData.get("type") || "Consultation"),
    title: String(formData.get("title") ?? "").trim() || null,
    date, hour,
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

  // Tell the assigned clinician they have a new appointment (skip if they booked
  // it themselves). Milestone follow-ups are booked with the owning clinician as
  // provider, so this is how the dietitian / trainer / doctor learns of the
  // Day-10 follow-up, fitness reassessment, Day-28 review, etc.
  if (provider_id && provider_id !== p.staffId) {
    const hr12 = (hour % 12) || 12;
    const when = `${hr12}:00 ${hour < 12 ? "AM" : "PM"}`;
    await notifyStaff(supabase, provider_id, {
      title: `New appointment — ${await clientName(supabase, client_id)}`,
      body: `${newType} · ${date} · ${when}`,
      icon: "🗓",
      // Opens the clinician's own Appointments tab in their workspace.
      link: { kind: "appointment", ref: client_id },
    });
  }

  // Booked from the "To book" list? Close the prompting task so it drops off.
  const taskId = String(formData.get("task_id") || "");
  if (taskId) await supabase.from("tasks").update({ status: "done" }).eq("id", taskId);

  // Also close any OTHER open "Book …" prompt for this client in the same
  // discipline — so booking a slot directly (not via the prompt) still clears
  // the to-book list instead of leaving a stale, un-bookable item.
  if (newDisc) {
    const kw = DISC_KEYWORDS[newDisc] ?? [];
    const { data: openTasks } = await supabase.from("tasks")
      .select("id, title").eq("client_id", client_id).neq("status", "done").ilike("title", "Book %");
    const toClose = ((openTasks ?? []) as { id: string; title: string }[])
      .filter((t) => kw.some((k) => t.title.toLowerCase().includes(k)))
      .map((t) => t.id);
    if (toClose.length) await supabase.from("tasks").update({ status: "done" }).in("id", toClose);
  }

  // Booking closes the follow-up that was chasing the same visit — whichever
  // door it was booked from. Only the Day-2 explanation used to be handled, so
  // a Day-10 or Day-28 row stayed "to call" forever after front desk put the
  // appointment in the diary: it inflated every overdue counter and raised a
  // whiteboard alert demanding an explanation for work already done.
  {
    const { followupMatchesAppointment } = await import("@/lib/followups");
    const { data: openFu } = await supabase.from("followups")
      .select("id, label, category").eq("client_id", client_id).neq("status", "done").neq("status", "skipped");
    const closing = ((openFu ?? []) as { id: string; label: string | null; category: string | null }[])
      .filter((f) => followupMatchesAppointment(f, newType))
      .map((f) => f.id);
    if (closing.length) {
      await supabase.from("followups")
        .update({ stage: "BOOKED", status: "done", done_by: p.name, done_at: new Date().toISOString() })
        .in("id", closing);
      revalidatePath("/followups");
    }
  }

  await logAudit(p, "Appointment booked", await clientName(supabase, client_id), date);
  revalidatePath("/appointments");
  revalidatePath("/clients");
  revalidatePath("/onboarding");
  return { ok: true };
}

export async function setAppointmentStatus(formData: FormData) {
  const p = await getProfile();
  if (!p || !canEditAppointments(p.role)) return;
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  if (!["scheduled", "completed", "cancelled", "no_show"].includes(status)) return;
  const supabase = createClient();
  await supabase.from("appointments").update({ status }).eq("id", id);
  await logAudit(p, `Appointment → ${status}`, null, null);
  revalidatePath("/appointments");
}

// Cancel a booking made in error. Marks the appointment cancelled, which the
// Onboarding board reads as "no longer booked" — so the step reverts to Book
// and the slot/clinician can be picked again. The care-team assignment is kept.
export async function cancelBooking(formData: FormData) {
  const p = await getProfile();
  if (!p || !canEditAppointments(p.role)) return;
  const id = String(formData.get("appt_id") || "");
  if (!id) return;
  const supabase = createClient();
  const { data: appt } = await supabase.from("appointments").select("client_id").eq("id", id).maybeSingle();
  await supabase.from("appointments").update({ status: "cancelled" }).eq("id", id);
  const cid = (appt as { client_id: string | null } | null)?.client_id ?? null;
  if (cid) await logAudit(p, "Booking cancelled", await clientName(supabase, cid), null);
  revalidatePath("/onboarding");
  revalidatePath("/appointments");
  revalidatePath("/clients");
}

export async function rescheduleAppointment(formData: FormData) {
  const p = await getProfile();
  if (!p || !canEditAppointments(p.role)) return;
  const id = String(formData.get("id"));
  const date = String(formData.get("date") || "");
  const hour = Number(formData.get("hour"));
  const patch: Record<string, unknown> = {};
  if (date) patch.date = date;
  if (!Number.isNaN(hour)) patch.hour = hour;
  if (Object.keys(patch).length === 0) return { ok: false, error: "Nothing to change" };
  const supabase = createClient();

  // Don't reschedule into a clash: same provider or same client already booked
  // at the target date & time.
  const { data: cur } = await supabase.from("appointments").select("provider_id, client_id, date, hour").eq("id", id).maybeSingle();
  if (cur) {
    const nd = (patch.date as string) ?? cur.date;
    const nh = (patch.hour as number) ?? cur.hour;
    const { data: sameSlot } = await supabase.from("appointments")
      .select("id, provider_id, client_id").eq("date", nd).eq("hour", nh).eq("status", "scheduled").neq("id", id);
    const rows = (sameSlot ?? []) as { id: string; provider_id: string | null; client_id: string | null }[];
    if (cur.provider_id && rows.some((r) => r.provider_id === cur.provider_id)) {
      return { ok: false, error: "That time is already booked for this provider." };
    }
    if (rows.some((r) => r.client_id === cur.client_id)) {
      return { ok: false, error: "This client already has an appointment at that time." };
    }
  }

  await supabase.from("appointments").update(patch).eq("id", id);
  await logAudit(p, "Appointment rescheduled", null, date);
  revalidatePath("/appointments");
  revalidatePath("/onboarding");
  return { ok: true };
}

// ---- email notifications (key-ready scaffold) ------------------------------

// Best-effort notifier: sends via provider when configured, always logs the
// attempt to email_log. Never throws — safe to call from other actions.
async function notifyEmail(opts: {
  supabase: ReturnType<typeof createClient>;
  to: string | null | undefined;
  clientId?: string | null;
  leadId?: string | null;
  template: string;
  tpl: Template;
  actor?: string | null;
}) {
  const { supabase, to, clientId, leadId, template, tpl, actor } = opts;
  if (!to) return;
  let result;
  try { result = await sendEmail(to, tpl.subject, tpl.html); }
  catch { result = { status: "failed" as const, error: "Unexpected" }; }
  try {
    await supabase.from("email_log").insert({
      to_email: to, client_id: clientId ?? null, lead_id: leadId ?? null, template, subject: tpl.subject,
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
    consultation_id: String(formData.get("consultation_id") ?? "") || null,
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
    // Which consultation advised this test, so the requisition can print every
    // test from one session on a single sheet.
    consultation_id: String(formData.get("consultation_id") ?? "") || null,
    category: String(formData.get("category") || "lab"),
    priority: String(formData.get("priority") || "routine"),
    notes: String(formData.get("notes") ?? "").trim() || null,
    status: "ordered", provider: p.name,
  });
  await logAudit(p, "Order placed", await clientName(supabase, client_id), test);
  revalidatePath(`/emr/${client_id}`);
  revalidatePath("/orders");
}

/**
 * Deliver a prescription to the client's portal — the step that was missing.
 *
 * `shared_at` gates everything downstream: the portal list, the "In client
 * portal" chip on the client card, and the Comprehensive "prescription" SLA
 * gate. Nothing wrote it, so the portal section was permanently empty and that
 * SLA clock could never be satisfied — it warned and then breached forever.
 *
 * Signing and sharing are deliberately separate: a doctor may sign a
 * prescription and still want a word with the patient before it is published.
 * Sharing a draft is refused for the same reason.
 */
export async function shareRxToPortal(formData: FormData): Promise<{ ok?: boolean; error?: string }> {
  const p = await emrGuard(); if (!p) return { error: "Not permitted" };
  const id = String(formData.get("id") || "");
  if (!id) return { error: "No prescription" };
  const undo = String(formData.get("undo") || "") === "true";
  const supabase = createClient();

  const { data: row } = await supabase.from("prescriptions").select("client_id, status").eq("id", id).maybeSingle();
  const rx = row as { client_id: string | null; status: string } | null;
  if (!rx) return { error: "Not found" };
  if (!undo && rx.status === "draft") return { error: "Sign the prescription before sharing it." };

  const { error } = await supabase.from("prescriptions")
    .update({ shared_at: undo ? null : new Date().toISOString() }).eq("id", id);
  if (error) return { error: error.message };

  await logAudit(p, undo ? "Prescription withdrawn from portal" : "Prescription shared to portal", await clientName(supabase, rx.client_id ?? ""), null);
  if (rx.client_id) revalidatePath(`/clients/${rx.client_id}`);
  revalidatePath("/portal");
  return { ok: true };
}

/**
 * Deliver the lab requisition for one consultation — every test advised in that
 * session, so the client gets the same single sheet the doctor printed.
 */
export async function shareLabToPortal(formData: FormData): Promise<{ ok?: boolean; error?: string }> {
  const p = await emrGuard(); if (!p) return { error: "Not permitted" };
  const consultationId = String(formData.get("consultation_id") || "");
  if (!consultationId) return { error: "No consultation" };
  const undo = String(formData.get("undo") || "") === "true";
  const supabase = createClient();

  const { data: rows } = await supabase.from("orders")
    .select("id, client_id").eq("consultation_id", consultationId).neq("status", "cancelled");
  const orders = (rows ?? []) as { id: string; client_id: string | null }[];
  if (!orders.length) return { error: "No tests to share." };

  const { error } = await supabase.from("orders")
    .update({ shared_at: undo ? null : new Date().toISOString() })
    .in("id", orders.map((o) => o.id));
  if (error) return { error: error.message };

  const clientId = orders[0].client_id;
  await logAudit(p, undo ? "Lab requisition withdrawn from portal" : "Lab requisition shared to portal", await clientName(supabase, clientId ?? ""), `${orders.length} test(s)`);
  if (clientId) revalidatePath(`/clients/${clientId}`);
  revalidatePath("/portal");
  return { ok: true };
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

// Log a meal-monitoring contact attempt (the escalation ladder: portal →
// WhatsApp → call → in-person). Recorded per client per day.
export async function logMealContact(formData: FormData) {
  const p = await getProfile();
  if (!p || !canConsult(p.role)) return;
  const client_id = String(formData.get("client_id") || "");
  const channel = String(formData.get("channel") || "");
  const outcome = String(formData.get("outcome") || "no_response");
  if (!client_id || !["portal", "whatsapp", "call", "meet"].includes(channel)) return;
  // Two stages per channel: an attempt marker (sent / called / visited), then an
  // outcome — positive (replied / reached / met) or negative (not_replied /
  // no_answer / refused). no_response kept for legacy rows.
  const OK = ["sent", "called", "visited", "replied", "reached", "met", "not_replied", "no_answer", "no_response", "refused"];
  const supabase = createClient();
  await supabase.from("meal_contacts").insert({
    client_id, date: String(formData.get("date") || todayISO()),
    channel, outcome: OK.includes(outcome) ? outcome : "no_response",
    note: String(formData.get("note") ?? "").trim() || null, staff: p.name,
  });
  await logAudit(p, "Meal-monitoring contact", client_id, `${channel} · ${outcome}`);
  revalidatePath("/meals");
  revalidatePath("/workspace");
}

// Undo a follow-up attempt logged in error — removes that single ladder entry.
export async function undoMealContact(formData: FormData) {
  const p = await getProfile();
  if (!p || !canConsult(p.role)) return;
  const id = String(formData.get("id") || "");
  if (!id) return;
  const supabase = createClient();
  await supabase.from("meal_contacts").delete().eq("id", id);
  await logAudit(p, "Meal-monitoring contact undone", null, id);
  revalidatePath("/meals");
  revalidatePath("/workspace");
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

// dietitian: manually log / edit a meal on the client's behalf (phone, in
// person, or correcting what they entered).
export async function logMealByStaff(formData: FormData) {
  const p = await getProfile();
  if (!p || !canConsult(p.role)) return;
  const client_id = String(formData.get("client_id"));
  const meal = String(formData.get("meal"));
  const description = String(formData.get("description") ?? "").trim();
  if (!client_id || !meal || !description) return;
  const supabase = createClient();
  await supabase.from("meal_logs").upsert(
    { client_id, date: todayISO(), meal, description, nudged: false, updated_at: new Date().toISOString() },
    { onConflict: "client_id,date,meal" }
  );
  const { data: c } = await supabase.from("clients").select("name").eq("id", client_id).maybeSingle();
  await logAudit(p, "Meal logged by staff", c?.name, meal);
  revalidatePath("/meals");
  revalidatePath("/workspace");
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
    dob: String(formData.get("dob") ?? "").trim() || null,
    address: String(formData.get("address") ?? "").trim() || null,
    emergency: String(formData.get("emergency") ?? "").trim() || null,
  };
}

export async function createClientRecord(formData: FormData) {
  const p = await getProfile();
  if (!p || !canWrite(p.role)) return;
  const supabase = createClient();
  const c = parseClientForm(formData);
  if (!c.name) return;

  // No package, not a client. A package-less client is an empty shell — no
  // invoice, no journey, no care team — and is invisible to everything that
  // reads client_packages (membership checks, obligations, renewals, the
  // whiteboard). Someone who hasn't chosen yet belongs in CRM & Leads. The
  // lead→client conversion already enforced this; the Onboard form was the
  // remaining way in.
  const subIdEarly = String(formData.get("sub_id") || "");
  if (!c.package_id) {
    redirect(`/clients/new?err=package${subIdEarly ? `&sub=${subIdEarly}` : ""}`);
  }

  // Membership prerequisite — enforced HERE, before the client row is created,
  // so a blocked attempt leaves nothing behind. A brand-new client has no
  // membership yet, so PT / Comprehensive can never be the package they're
  // onboarded with: sell the membership first, then add the care package from
  // the client card (which runs the same check in purchasePackage). Without
  // this, "Onboard Client" was a silent way around the rule.
  if (c.package_id) {
    const { data: pk } = await supabase
      .from("packages").select("is_facility").eq("id", c.package_id).maybeSingle();
    const cat0 = packageCategory(c.package_id, Boolean((pk as { is_facility: boolean } | null)?.is_facility));
    if (requiresMembership(cat0)) {
      const sub = String(formData.get("sub_id") || "");
      redirect(`/clients/new?err=membership${sub ? `&sub=${sub}` : ""}`);
    }
  }

  // next client code
  const code = await nextClientCode(supabase);

  const { data: inserted } = await supabase
    .from("clients")
    .insert({ ...c, code, used: 0, verified: true, consent_tnc: true, consent_waiver: true, pro_id: "t0" })
    .select("id")
    .single();

  // auto-schedule sessions for PT / Comprehensive + create the package invoice
  if (inserted && c.package_id) {
    const { data: pkg } = await supabase
      .from("packages").select("name, price, sessions, is_facility, validity").eq("id", c.package_id).maybeSingle();
    if (pkg) {
      // Record the package in client_packages — NOT just the legacy
      // clients.package_id. Everything that reasons about what a client holds
      // (active-membership checks, the PT/Comprehensive prerequisite, package
      // status & obligations, renewals/freeze, the whiteboard's alive/dead) reads
      // client_packages. Without this row a client onboarded here looked like
      // they held nothing at all. Mirrors purchasePackage.
      const cat = packageCategory(c.package_id, pkg.is_facility);
      const start = c.joined || todayISO();
      await supabase.from("client_packages").insert({
        client_id: inserted.id, package_id: c.package_id, package_name: pkg.name, category: cat,
        start_date: start, end_date: pkg.validity ? addDaysISO(start, pkg.validity) : null,
        price: pkg.price ?? 0, status: "active", created_by: p.name,
      });
      // PT / Comprehensive sessions are booked by front desk (their journeys
      // queue the prompt); everything else with credits still auto-builds.
      if (!pkg.is_facility && pkg.sessions > 0 && cat !== PT_CATEGORY && cat !== COMPREHENSIVE_CATEGORY) {
        await supabase.from("enrollments").insert({ client_id: inserted.id, trainer_id: "t0", hour: 9, session: "PT" });
        await supabase.from("sessions").insert(buildSessions(inserted.id, "t0", 9, start, pkg.sessions));
      }
      const num = await nextInvoiceNum(supabase);
      await supabase.from("invoices").insert({
        num, client_id: inserted.id, description: `${pkg.name} package`, amount: pkg.price ?? 0,
        status: "Unpaid", issued_date: todayISO(), created_by: p.name,
      });
      // Kick off the care journey (blood request, care team, booking prompts) —
      // same as buying the package from the client card.
      if (cat === "blueprint" || cat === COMPREHENSIVE_CATEGORY || cat === PT_CATEGORY) {
        if (cat === "blueprint") await startBlueprintJourney(supabase, inserted.id, c.name, p.name);
        else if (cat === COMPREHENSIVE_CATEGORY) await startComprehensiveJourney(supabase, inserted.id, c.name, start, p.name);
        else await startPTJourney(supabase, inserted.id, c.name, start, p.name);
      }
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
    summary: String(formData.get("summary") || "").trim() || null,
    meals, by_name: p.name,
  });
  await logAudit(p, "Diet chart drafted", c?.name, `v${(count ?? 0) + 1}`);
  revalidatePath("/workspace");
}

// Edit a Draft diet chart in place (same row/version). Only Drafts are editable —
// once it's In review / Approved / Published it's locked, so a change goes back
// through review. Used for the "request changes → edit → resubmit" loop.
export async function updateDietChart(formData: FormData) {
  const p = await getProfile();
  if (!p || !canWriteNutrition(p.role)) return; // dietitian-owned
  const id = String(formData.get("id") || "");
  if (!id) return;
  const supabase = createClient();
  const { data: dc } = await supabase.from("diet_charts").select("status").eq("id", id).maybeSingle();
  if ((dc as { status: string } | null)?.status !== "Draft") return; // only drafts are editable
  const labels = formData.getAll("meal_label").map((v) => String(v).trim());
  const details = formData.getAll("meal_detail").map((v) => String(v).trim());
  const meals = labels.map((l, i) => [l, details[i] ?? ""]).filter(([l, d]) => l && d);
  if (meals.length === 0) return;
  await supabase.from("diet_charts").update({
    meals,
    calories: Number(formData.get("calories")) || null,
    protein: String(formData.get("protein") || "").trim() || null,
    notes: String(formData.get("notes") || "").trim() || null,
    summary: String(formData.get("summary") || "").trim() || null,
  }).eq("id", id);
  await logAudit(p, "Diet chart edited", id, null);
  revalidatePath("/workspace");
}

// Dietitian sends a draft to the Super Admin for review.
export async function submitDietChartForReview(formData: FormData) {
  const p = await getProfile();
  if (!p || !canWriteNutrition(p.role)) return; // dietitian-owned
  const id = String(formData.get("id"));
  if (!id) return;
  const supabase = createClient();
  const { data: dc } = await supabase.from("diet_charts").select("client_id, clients:client_id(name)").eq("id", id).maybeSingle();
  await supabase.from("diet_charts").update({ status: "In review", submitted_at: new Date().toISOString(), review_note: null }).eq("id", id);
  const who = (dc as unknown as { clients: { name: string } | null } | null)?.clients?.name ?? "a client";
  await logAudit(p, "Diet chart submitted for review", who, id);
  await notifyRoles(supabase, ["Super Admin", "Administrator"], {
    title: "Diet chart awaiting review", body: `${who} · submitted by ${p.name}`,
    href: "/workspace?role=diet&tab=charts", icon: "🥗",
  });
  revalidatePath("/workspace");
}

// Super Admin approves the chart, or sends it back to Draft with a note.
export async function reviewDietChart(formData: FormData) {
  const p = await getProfile();
  if (!p || !canReviewDietChart(p.role)) return;
  const id = String(formData.get("id"));
  const decision = String(formData.get("decision") || "");
  if (!id || !["approve", "changes"].includes(decision)) return;
  const note = String(formData.get("note") || "").trim() || null;
  const supabase = createClient();
  const { data: dc } = await supabase.from("diet_charts").select("client_id, clients:client_id(name)").eq("id", id).maybeSingle();
  const who = (dc as unknown as { clients: { name: string } | null } | null)?.clients?.name ?? "a client";
  if (decision === "approve") {
    await supabase.from("diet_charts").update({ status: "Approved", reviewed_by: p.name, reviewed_at: new Date().toISOString(), review_note: null }).eq("id", id);
  } else {
    await supabase.from("diet_charts").update({ status: "Draft", reviewed_by: p.name, reviewed_at: new Date().toISOString(), review_note: note }).eq("id", id);
  }
  await logAudit(p, decision === "approve" ? "Diet chart approved" : "Diet chart changes requested", who, note ?? id);
  await notifyRoles(supabase, ["Dietitian"], {
    title: `Diet chart ${decision === "approve" ? "approved" : "sent back"} — ${who}`,
    body: decision === "approve" ? `Approved by ${p.name} · ready to publish` : `${p.name}: ${note ?? "changes requested"}`,
    href: "/workspace?role=diet&tab=charts", icon: decision === "approve" ? "✅" : "✏️",
  });
  revalidatePath("/workspace");
}

export async function publishDietChart(formData: FormData) {
  const p = await getProfile();
  if (!p || !canConsult(p.role) || !canWriteNutrition(p.role)) return; // dietitian-owned
  const id = String(formData.get("id"));
  if (!id) return;
  const supabase = createClient();
  // Gate: a chart can only reach the client once the Super Admin approves it.
  const { data: dc } = await supabase.from("diet_charts").select("status").eq("id", id).maybeSingle();
  if ((dc as { status: string } | null)?.status !== "Approved") return; // not approved → no-op
  await supabase.from("diet_charts").update({ status: "Published" }).eq("id", id);
  await logAudit(p, "Diet chart published", id, null);
  revalidatePath("/workspace");
}

// Publish & share directly, skipping MD review — for charts that don't need it.
// Dietitian-owned; works from Draft / In review / Approved.
export async function publishDietChartDirect(formData: FormData) {
  const p = await getProfile();
  if (!p || !canConsult(p.role) || !canWriteNutrition(p.role)) return; // dietitian-owned
  const id = String(formData.get("id"));
  if (!id) return;
  const supabase = createClient();
  const { data: dc } = await supabase.from("diet_charts").select("status").eq("id", id).maybeSingle();
  if ((dc as { status: string } | null)?.status === "Published") return; // already live
  await supabase.from("diet_charts").update({ status: "Published", published_at: new Date().toISOString() }).eq("id", id);
  await logAudit(p, "Diet chart shared (published without review)", id, null);
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

// ---- AI assist (OpenAI) — dietitian summaries & drafts ----------------------
// All read structured data already in Cureocity (no PDF upload) and return text
// the dietitian reviews before using. Gated to consult-capable roles.

type MeasRow = { date: string; weight: number | null; bmi: number | null; body_fat: number | null; muscle_mass: number | null; visceral_fat: number | null; waist: number | null; hip: number | null; resting_hr: number | null };
const fmtMeas = (m: MeasRow) => `${m.date}: weight ${m.weight ?? "—"}kg · BMI ${m.bmi ?? "—"} · body fat ${m.body_fat ?? "—"}% · skeletal muscle ${m.muscle_mass ?? "—"}kg · visceral fat ${m.visceral_fat ?? "—"} · waist ${m.waist ?? "—"}cm · hip ${m.hip ?? "—"}cm · resting HR ${m.resting_hr ?? "—"}`;

export async function aiInbodySummary(_prev: AiState, formData: FormData): Promise<AiState> {
  const me = await getProfile();
  if (!me || !canConsult(me.role)) return { error: "Not authorized." };
  const client_id = String(formData.get("client_id") || "");
  if (!client_id) return { error: "Pick a client first." };
  // The dietitian can paste the InBody report text (e.g. copied from the PDF)
  // into the box and hit Generate — the AI then summarises what they pasted.
  const pasted = String(formData.get("text") || "").trim();
  const supabase = createClient();
  const { data } = await supabase.from("measurements")
    .select("id, date, weight, bmi, body_fat, muscle_mass, visceral_fat, waist, hip, resting_hr")
    .eq("client_id", client_id).order("date", { ascending: false }).limit(2);
  const rows = (data ?? []) as (MeasRow & { id: string })[];

  // Read the uploaded InBody PDF itself. Uploading the report is the natural
  // action for a clinician, so the PDF must be a real source for the summary —
  // not just a document filed away. Only read when nothing was pasted: an
  // explicit paste is the clinician overriding what's on file.
  let pdfText: string | null = null;
  if (!pasted) {
    const { data: f } = await supabase.from("files")
      .select("bucket, path, name").eq("client_id", client_id).eq("kind", "inbody")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    const file = f as { bucket: string | null; path: string; name: string | null } | null;
    if (file?.path) {
      const { pdfTextFromStorage } = await import("@/lib/pdf-text");
      pdfText = await pdfTextFromStorage(supabase, file.bucket || "client-files", file.path);
    }
  }

  if (!rows.length && !pasted && !pdfText) {
    return { error: "No InBody data yet — upload the InBody PDF, enter the measurements, or paste the report text into the box, then Generate." };
  }
  const metricLines = rows.length ? `Recorded metrics — Latest: ${fmtMeas(rows[0])}` + (rows[1] ? `\nPrevious: ${fmtMeas(rows[1])}` : "") : "";
  const reportText = pasted
    ? `InBody report text provided by the dietitian:\n${pasted.slice(0, 4000)}`
    : pdfText ? `Text extracted from the client's uploaded InBody PDF:\n${pdfText}` : "";
  const user = [metricLines, reportText].filter(Boolean).join("\n\n");
  let r = await openaiComplete(
    "You are a clinical dietitian assistant. Summarise the client's InBody / body-composition report for the care team in 4–6 short lines: highlight the key metrics, note the change vs the previous reading if one is given (direction and magnitude), and add 2–3 concise practical observations. If the dietitian pasted report text, base the summary on it; if structured metrics are also given, reconcile and use them. Plain text, no markdown headings.",
    user,
  );

  // No API key yet (or the AI call failed) — fall back to reading the report
  // ourselves. A deterministic parse of the InBody fields is far more useful
  // than an error, and the wording says plainly that it's auto-extracted and
  // unreviewed so nobody mistakes it for clinical interpretation. Once
  // OPENAI_API_KEY is set the AI path takes over automatically.
  if (!r.text) {
    const source = pasted || pdfText;
    if (source) {
      const { inbodySummaryFromText } = await import("@/lib/inbody-parse");
      const { data: cg } = await supabase.from("clients").select("gender").eq("id", client_id).maybeSingle();
      const fallback = inbodySummaryFromText(source, (cg as { gender: string | null } | null)?.gender ?? null);
      if (fallback) r = { text: fallback };
    }
  }
  // Save onto the latest measurements record (if one exists to attach to).
  if (r.text && rows.length) {
    await supabase.from("measurements").update({ ai_summary: r.text, ai_summary_at: new Date().toISOString() }).eq("id", rows[0].id);
    await logAudit(me, "InBody AI summary saved", client_id, null);
    revalidatePath(`/clients/${client_id}`);
  }
  return r;
}

/**
 * Read the client's uploaded InBody PDF and build the summary from it directly —
 * no AI involved. Separate from Generate so the clinician can choose: this one
 * is deterministic, instant, free, and available before OPENAI_API_KEY is set.
 * Same shape as the AI action so the editor can call either.
 */
export async function extractInbodySummary(_prev: AiState, formData: FormData): Promise<AiState> {
  const me = await getProfile();
  if (!me || !canConsult(me.role)) return { error: "Not authorized." };
  const client_id = String(formData.get("client_id") || "");
  if (!client_id) return { error: "Pick a client first." };
  const supabase = createClient();

  const { data: f } = await supabase.from("files")
    .select("bucket, path, name").eq("client_id", client_id).eq("kind", "inbody")
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  const file = f as { bucket: string | null; path: string; name: string | null } | null;
  if (!file?.path) return { error: "No InBody PDF uploaded for this client yet — add the PDF first." };

  const { pdfTextFromStorage } = await import("@/lib/pdf-text");
  const text = await pdfTextFromStorage(supabase, file.bucket || "client-files", file.path);
  if (!text) return { error: "Couldn't read any text from that PDF — it may be a scan or an image. Paste the report text into the box instead." };

  const { inbodySummaryFromText } = await import("@/lib/inbody-parse");
  const { data: cg } = await supabase.from("clients").select("gender").eq("id", client_id).maybeSingle();
  const summary = inbodySummaryFromText(text, (cg as { gender: string | null } | null)?.gender ?? null);
  if (!summary) return { error: "That PDF didn't contain recognisable InBody fields — check it's the result sheet, or paste the values in." };

  // Record the measurement itself, not just the prose. The InBody's numbers are
  // sitting in the PDF — re-typing them by hand was busywork, and with no
  // measurement row there was nowhere to attach the summary either, so it
  // silently failed to save. Dated from the report's own test date so the
  // progress chart reflects when the scan happened, not when it was uploaded.
  const { parseInbodyText, parseInbodyDate } = await import("@/lib/inbody-parse");
  const m = parseInbodyText(text);
  const measuredOn = parseInbodyDate(text) ?? todayISO();

  // Match on the test date: re-extracting the same report updates that reading
  // rather than stacking duplicates, and a genuinely new scan adds a new row.
  const { data: sameDay } = await supabase.from("measurements")
    .select("id").eq("client_id", client_id).eq("date", measuredOn).limit(1).maybeSingle();

  const vals = {
    weight: m.weight ?? null, bmi: m.bmi ?? null, body_fat: m.bodyFat ?? null,
    muscle_mass: m.smm ?? null, visceral_fat: m.visceral ?? null,
    ai_summary: summary, ai_summary_at: new Date().toISOString(),
  };

  let mid = (sameDay as { id: string } | null)?.id ?? null;
  if (mid) {
    await supabase.from("measurements").update(vals).eq("id", mid);
  } else {
    const { data: created } = await supabase.from("measurements")
      .insert({ client_id, date: measuredOn, ...vals, notes: `From InBody report${file.name ? ` (${file.name})` : ""}`, recorded_by: me.name })
      .select("id").maybeSingle();
    mid = (created as { id: string } | null)?.id ?? null;
  }

  await logAudit(me, mid && sameDay ? "InBody measurement updated from PDF" : "InBody measurement recorded from PDF", client_id, `${measuredOn} · ${file.name ?? "report"}`);
  revalidatePath(`/clients/${client_id}`);
  return { text: summary };
}

// ---- medical reports (blood panels, thyroid, ECG, anything) -----------------
// Same shape as the InBody flow: upload the PDF, then either read it here or ask
// the AI. The summary lives on the file row (see migration 0116), because one
// document has exactly one summary.

async function reportFile(supabase: ReturnType<typeof createClient>, fileId: string) {
  const { data } = await supabase.from("files")
    .select("id, client_id, bucket, path, name, kind, report_label").eq("id", fileId).maybeSingle();
  return data as { id: string; client_id: string; bucket: string | null; path: string; name: string | null; kind: string | null; report_label: string | null } | null;
}

/** Read the report PDF and summarise the markers it contains — no AI needed. */
export async function extractReportSummary(_prev: AiState, formData: FormData): Promise<AiState> {
  const me = await getProfile();
  if (!me || !canConsult(me.role)) return { error: "Not authorized." };
  const fileId = String(formData.get("file_id") || "");
  if (!fileId) return { error: "Pick a report first." };
  const supabase = createClient();
  const f = await reportFile(supabase, fileId);
  if (!f) return { error: "Report not found." };

  const { pdfTextFromStorage } = await import("@/lib/pdf-text");
  const text = await pdfTextFromStorage(supabase, f.bucket || "client-files", f.path);
  if (!text) return { error: "Couldn't read any text from that PDF — it may be a scan or photo. Type the key values in instead." };

  const { data: cg } = await supabase.from("clients").select("gender").eq("id", f.client_id).maybeSingle();
  const gender = (cg as { gender: string | null } | null)?.gender ?? null;
  const { reportSummaryFromText, parseReportDate } = await import("@/lib/report-parse");
  const summary = reportSummaryFromText(text, gender, f.report_label || f.name || "Report");
  if (!summary) return { error: "No recognisable lab markers in that PDF — check it's the results page, or write the summary yourself." };

  await supabase.from("files").update({
    summary, summary_at: new Date().toISOString(),
    report_date: parseReportDate(text) ?? null,
  }).eq("id", fileId);
  await logAudit(me, "Report summary extracted from PDF", f.client_id, f.name ?? null);
  revalidatePath(`/clients/${f.client_id}`);
  return { text: summary };
}

/** AI narrative summary of a report — falls back to the parser if AI is off. */
export async function aiReportSummary(_prev: AiState, formData: FormData): Promise<AiState> {
  const me = await getProfile();
  if (!me || !canConsult(me.role)) return { error: "Not authorized." };
  const fileId = String(formData.get("file_id") || "");
  if (!fileId) return { error: "Pick a report first." };
  const supabase = createClient();
  const f = await reportFile(supabase, fileId);
  if (!f) return { error: "Report not found." };

  const pasted = String(formData.get("text") || "").trim();
  const { pdfTextFromStorage } = await import("@/lib/pdf-text");
  const text = pasted || await pdfTextFromStorage(supabase, f.bucket || "client-files", f.path);
  if (!text) return { error: "Nothing to summarise — the PDF has no readable text. Paste the values into the box." };

  let r = await openaiComplete(
    "You are a clinical assistant. Summarise this medical report for the care team in 4–6 short lines: name the test, lead with anything outside the reference range (value and direction), then note what was normal, and add 1–2 practical observations. Report observations, never a diagnosis. Plain text, no markdown headings.",
    `${f.report_label || f.name || "Medical report"}\n\n${text.slice(0, 6000)}`,
  );
  if (!r.text) {
    const { data: cg } = await supabase.from("clients").select("gender").eq("id", f.client_id).maybeSingle();
    const { reportSummaryFromText } = await import("@/lib/report-parse");
    const fb = reportSummaryFromText(text, (cg as { gender: string | null } | null)?.gender ?? null, f.report_label || f.name);
    if (fb) r = { text: fb };
  }
  if (r.text) {
    await supabase.from("files").update({ summary: r.text, summary_at: new Date().toISOString() }).eq("id", fileId);
    await logAudit(me, "Report summary generated", f.client_id, f.name ?? null);
    revalidatePath(`/clients/${f.client_id}`);
  }
  return r;
}

/** Clinician's own wording — same field the extract / AI write to. */
export async function saveReportSummary(fileId: string, text: string): Promise<{ ok?: boolean; error?: string }> {
  const me = await getProfile();
  if (!me || !canConsult(me.role)) return { error: "Not authorized." };
  if (!fileId) return { error: "Missing report." };
  const supabase = createClient();
  const f = await reportFile(supabase, fileId);
  if (!f) return { error: "Report not found." };
  await supabase.from("files").update({ summary: text.trim() || null, summary_at: new Date().toISOString() }).eq("id", fileId);
  await logAudit(me, "Report summary edited", f.client_id, f.name ?? null);
  revalidatePath(`/clients/${f.client_id}`);
  return { ok: true };
}

// Manually write / edit the saved summaries (same field the AI writes to), so a
// clinician can type their own or tweak the AI one. Empty text clears it.
export async function saveMeasurementSummary(client_id: string, text: string): Promise<{ ok?: boolean; error?: string }> {
  const me = await getProfile();
  if (!me || !canConsult(me.role)) return { error: "Not authorized." };
  if (!client_id) return { error: "Missing client." };
  const supabase = createClient();
  const { data } = await supabase.from("measurements").select("id").eq("client_id", client_id).order("date", { ascending: false }).limit(1);
  const id = (data ?? [])[0]?.id as string | undefined;
  if (!id) return { error: "No InBody / measurement record to attach a summary to." };
  await supabase.from("measurements").update({ ai_summary: text.trim() || null, ai_summary_at: new Date().toISOString() }).eq("id", id);
  await logAudit(me, "InBody summary edited", client_id, null);
  revalidatePath(`/clients/${client_id}`);
  return { ok: true };
}

export async function saveConsultationSummary(client_id: string, text: string): Promise<{ ok?: boolean; error?: string }> {
  const me = await getProfile();
  if (!me || !canConsult(me.role)) return { error: "Not authorized." };
  if (!client_id) return { error: "Missing client." };
  const supabase = createClient();
  const { data } = await supabase.from("consultations").select("id").eq("client_id", client_id).order("created_at", { ascending: false }).limit(1);
  const id = (data ?? [])[0]?.id as string | undefined;
  if (!id) return { error: "No consultation record to attach a summary to." };
  await supabase.from("consultations").update({ ai_summary: text.trim() || null, ai_summary_at: new Date().toISOString() }).eq("id", id);
  await logAudit(me, "Consultation summary edited", client_id, null);
  revalidatePath(`/clients/${client_id}`);
  return { ok: true };
}

export async function aiConsultSummary(_prev: AiState, formData: FormData): Promise<AiState> {
  const me = await getProfile();
  if (!me || !canConsult(me.role)) return { error: "Not authorized." };
  const client_id = String(formData.get("client_id") || "");
  if (!client_id) return { error: "Pick a client first." };
  const supabase = createClient();
  const [{ data: cons }, { data: meas }, { data: cli }] = await Promise.all([
    // Every discipline's consult (doctor / dietitian / trainer / psychologist),
    // newest first — we keep the latest per discipline and use its questionnaire
    // answers + summary.
    supabase.from("consultations").select("id, kind, status, answers, summary, created_at").eq("client_id", client_id).order("created_at", { ascending: false }).limit(20),
    // The InBody summary (manual or AI) lives on the latest measurements row.
    supabase.from("measurements").select("ai_summary, date").eq("client_id", client_id).not("ai_summary", "is", null).order("date", { ascending: false }).limit(1),
    supabase.from("clients").select("goals, conditions").eq("id", client_id).maybeSingle(),
  ]);
  const consults = (cons ?? []) as { id: string; kind: string; status: string; answers: [string, string][] | null; summary: string | null }[];
  const inbodySummary = ((meas ?? []) as { ai_summary: string | null }[])[0]?.ai_summary ?? null;
  const c = cli as { goals: string[] | null; conditions: string | null } | null;
  if (!consults.length && !inbodySummary) return { error: "No questionnaire answers or InBody summary found for this client yet." };

  const parts: string[] = [];
  if (c?.goals?.length) parts.push(`Goals: ${c.goals.join(", ")}`);
  if (c?.conditions) parts.push(`Conditions: ${c.conditions}`);
  if (inbodySummary) parts.push(`InBody / body-composition summary:\n${inbodySummary}`);

  // Latest consult per discipline, with its questionnaire answers.
  const seen = new Set<string>();
  for (const cn of consults) {
    if (seen.has(cn.kind)) continue;
    seen.add(cn.kind);
    const qa = Array.isArray(cn.answers) && cn.answers.length
      ? cn.answers.map(([q, a]) => `  - ${q}: ${a}`).join("\n")
      : null;
    parts.push(
      `${cn.kind} questionnaire (${cn.status}):` +
      (qa ? `\n${qa}` : " (no answers recorded)") +
      (cn.summary ? `\n  Summary: ${cn.summary}` : ""),
    );
  }

  const r = await openaiComplete(
    "You are a clinical assistant writing a consolidated, shareable consultation summary for a client. Draw together EVERY discipline's questionnaire answers provided (doctor, dietitian, fitness trainer, psychologist) and the InBody summary into one coherent overview. Cover: presenting goals/concerns, relevant history, key findings across disciplines, body-composition status, and the combined plan / next steps. Neutral clinical tone; tidy short paragraphs or bullet lines; no markdown headings.",
    parts.join("\n\n"),
  );
  // Save onto the most recent consultation record.
  if (r.text && consults.length) {
    await supabase.from("consultations").update({ ai_summary: r.text, ai_summary_at: new Date().toISOString() }).eq("id", consults[0].id);
    await logAudit(me, "Consultation AI summary saved", client_id, null);
    revalidatePath(`/clients/${client_id}`);
  }
  return r;
}

// Structured first-draft plan for the diet-chart maker (fills the fields, not
// copy-paste). Returns meal rows + calories/protein/notes as JSON.
export type DietDraft = { meals?: [string, string][]; calories?: number | null; protein?: string | null; notes?: string | null; error?: string };
export async function aiDietDraftStructured(client_id: string): Promise<DietDraft> {
  const me = await getProfile();
  if (!me || !canWriteNutrition(me.role)) return { error: "Not authorized." };
  if (!client_id) return { error: "Pick a client first." };
  const supabase = createClient();
  const [{ data: cons }, { data: meas }, { data: cli }, { data: wk }] = await Promise.all([
    // Every discipline's consult, newest first — we keep the latest per kind and
    // use its saved summary (AI or manual) + questionnaire answers.
    supabase.from("consultations").select("kind, summary, ai_summary, answers, created_at").eq("client_id", client_id).order("created_at", { ascending: false }),
    supabase.from("measurements").select("date, weight, bmi, body_fat, muscle_mass, visceral_fat, waist, hip, resting_hr, ai_summary").eq("client_id", client_id).order("date", { ascending: false }).limit(1),
    supabase.from("clients").select("name, goals, conditions").eq("id", client_id).maybeSingle(),
    supabase.from("client_workouts").select("name, type, mode").eq("client_id", client_id).order("created_at", { ascending: false }).limit(1),
  ]);
  const c = cli as { name: string; goals: string[] | null; conditions: string | null } | null;
  const parts: string[] = [];
  if (c) parts.push(`Client: ${c.name}${c.goals?.length ? ` · goals: ${c.goals.join(", ")}` : ""}${c.conditions ? ` · conditions: ${c.conditions}` : ""}`);

  // InBody summary (dietitian's saved/AI summary) — the body-composition picture.
  const mrows = (meas ?? []) as (MeasRow & { ai_summary?: string | null })[];
  if (mrows[0]?.ai_summary) parts.push(`InBody summary:\n${mrows[0].ai_summary}`);
  else if (mrows[0]) parts.push(`InBody — ${fmtMeas(mrows[0])}`);

  // Latest consult per discipline (dietitian, doctor, trainer, psychologist):
  // prefer the saved summary, else compile the questionnaire answers.
  const seenKind = new Set<string>();
  for (const cn of ((cons ?? []) as { kind: string; summary: string | null; ai_summary: string | null; answers: [string, string][] | null }[])) {
    if (seenKind.has(cn.kind)) continue;
    seenKind.add(cn.kind);
    const qa = Array.isArray(cn.answers) && cn.answers.length ? cn.answers.map(([q, a]) => `${q}: ${a}`).join("; ") : null;
    const body = cn.ai_summary || cn.summary || qa;
    if (body) parts.push(`${cn.kind} questionnaire summary:\n${body.slice(0, 1500)}`);
  }

  const w = (wk ?? [])[0] as { name: string; type: string; mode: string } | undefined;
  if (w) parts.push(`Fitness plan: ${w.name} (${w.type}, ${w.mode})`);
  if (parts.length <= 1) return { error: "Not enough client data yet (need consults / InBody / questionnaire)." };
  const r = await openaiComplete(
    'You are an expert clinical dietitian. Return ONLY a JSON object shaped as {"meals":[["Early Morning","..."],["Breakfast","..."],["Mid-Morning","..."],["Lunch","..."],["Evening","..."],["Dinner","..."]],"calories":<number kcal/day>,"protein":"<e.g. 72 g>","notes":"<short guidance for the client>"}. Each meal detail should be a concrete Indian-friendly suggestion with rough portions, aligned to the goals, conditions, InBody and fitness plan given.',
    parts.join("\n"),
    { json: true, maxTokens: 900 },
  );
  if (r.error) return { error: r.error };
  try {
    const parsed = JSON.parse(r.text ?? "{}") as { meals?: unknown; calories?: unknown; protein?: unknown; notes?: unknown };
    const meals = Array.isArray(parsed.meals)
      ? (parsed.meals as unknown[]).map((m) => Array.isArray(m) ? [String(m[0] ?? ""), String(m[1] ?? "")] as [string, string] : null).filter((x): x is [string, string] => Boolean(x && x[0]))
      : [];
    if (!meals.length) return { error: "The model didn't return a usable plan — try again." };
    return {
      meals,
      calories: typeof parsed.calories === "number" ? parsed.calories : (Number(parsed.calories) || null),
      protein: parsed.protein != null ? String(parsed.protein) : null,
      notes: parsed.notes != null ? String(parsed.notes) : null,
    };
  } catch {
    return { error: "Couldn't parse the AI plan — try again." };
  }
}

export async function aiDietDraft(_prev: AiState, formData: FormData): Promise<AiState> {
  const me = await getProfile();
  if (!me || !canWriteNutrition(me.role)) return { error: "Not authorized." };
  const client_id = String(formData.get("client_id") || "");
  if (!client_id) return { error: "Pick a client first." };
  const supabase = createClient();
  const [{ data: cons }, { data: forms }, { data: meas }, { data: cli }, { data: wk }] = await Promise.all([
    supabase.from("consultations").select("kind, summary, notes").eq("client_id", client_id).eq("status", "completed"),
    supabase.from("form_responses").select("answers").eq("client_id", client_id).order("created_at", { ascending: false }).limit(3),
    supabase.from("measurements").select("date, weight, bmi, body_fat, muscle_mass, visceral_fat, waist, hip, resting_hr").eq("client_id", client_id).order("date", { ascending: false }).limit(1),
    supabase.from("clients").select("name, goals, conditions").eq("id", client_id).maybeSingle(),
    supabase.from("client_workouts").select("name, type, mode, items").eq("client_id", client_id).order("created_at", { ascending: false }).limit(1),
  ]);
  const c = cli as { name: string; goals: string[] | null; conditions: string | null } | null;
  const parts: string[] = [];
  if (c) parts.push(`Client: ${c.name}${c.goals?.length ? ` · goals: ${c.goals.join(", ")}` : ""}${c.conditions ? ` · conditions: ${c.conditions}` : ""}`);
  const mrows = (meas ?? []) as MeasRow[];
  if (mrows[0]) parts.push(`InBody — ${fmtMeas(mrows[0])}`);
  for (const cn of ((cons ?? []) as { kind: string; summary: string | null; notes: string | null }[])) parts.push(`${cn.kind} consult: ${cn.summary ?? cn.notes ?? "—"}`);
  for (const a of ((forms ?? []) as { answers: Record<string, unknown> }[])) parts.push(`Questionnaire: ${JSON.stringify(a.answers).slice(0, 1200)}`);
  const w = (wk ?? [])[0] as { name: string; type: string; mode: string; items: unknown } | undefined;
  if (w) parts.push(`Fitness plan: ${w.name} (${w.type}, ${w.mode})`);
  if (parts.length <= 1) return { error: "Not enough client data yet (need consults / InBody / questionnaire)." };
  return openaiComplete(
    "You are an expert clinical dietitian. Draft a first-cut daily diet chart the dietitian will review and tweak. Use these meal slots in order: Early Morning, Breakfast, Mid-Morning, Lunch, Evening, Dinner. For each, give a concrete Indian-friendly suggestion with rough portions. Then add a line 'Calories: ~X kcal/day' and 'Protein target: ~X g'. Keep it practical and aligned to the goals, conditions, InBody and fitness plan given. Plain text.",
    parts.join("\n"),
    { maxTokens: 900 },
  );
}

export async function aiDailyMealSummary(_prev: AiState, formData: FormData): Promise<AiState> {
  const me = await getProfile();
  if (!me || !canConsult(me.role)) return { error: "Not authorized." };
  const client_id = String(formData.get("client_id") || "");
  const date = String(formData.get("date") || todayISO());
  if (!client_id) return { error: "Pick a client first." };
  const supabase = createClient();
  const { data } = await supabase.from("meal_logs").select("meal, description, review, doubt, doubt_answer").eq("client_id", client_id).eq("date", date);
  const logs = (data ?? []) as { meal: string; description: string | null; review: string | null; doubt: string | null; doubt_answer: string | null }[];
  if (!logs.length) return { error: `No meals logged for ${date}.` };
  const user = `Meals logged on ${date}:\n` + logs.map((l) => `- ${l.meal}: ${l.description ?? "—"}${l.review ? ` [dietitian: ${l.review}]` : ""}${l.doubt ? ` [client asked: ${l.doubt}${l.doubt_answer ? ` → ${l.doubt_answer}` : ""}]` : ""}`).join("\n");
  const r = await openaiComplete(
    "You are a friendly dietitian. Turn a client's logged meals for the day into a short, encouraging daily summary to send them: a compact meal-by-meal table (Meal | What you had | Note), then 2–3 lines of overall feedback and one gentle suggestion for tomorrow. Warm, concise.",
    user,
  );
  // Save onto the day's record so it's kept (and can later be sent to the client).
  if (r.text) {
    await supabase.from("meal_day_summaries").upsert({ client_id, date, summary: r.text, updated_by: me.name, updated_at: new Date().toISOString() }, { onConflict: "client_id,date" });
    await logAudit(me, "Daily meal summary saved", client_id, date);
  }
  return r;
}

// Send the day's summary to the client: surfaces it in their portal, stamps
// sent_at, and drops a notification on their login. Saves the current text first.
export async function sendMealDaySummary(client_id: string, date?: string): Promise<{ ok?: boolean; error?: string }> {
  const me = await getProfile();
  if (!me || !canConsult(me.role)) return { error: "Not authorized." };
  const day = date || todayISO();
  if (!client_id) return { error: "Missing client." };
  const supabase = createClient();
  const { data: row } = await supabase.from("meal_day_summaries").select("summary").eq("client_id", client_id).eq("date", day).maybeSingle();
  const summary = (row as { summary: string | null } | null)?.summary?.trim();
  if (!summary) return { error: "Write or generate the summary first, then send." };
  await supabase.from("meal_day_summaries").update({ sent_at: new Date().toISOString() }).eq("client_id", client_id).eq("date", day);
  // Notify the client's login(s), if they have portal access.
  const { data: profs } = await supabase.from("profiles").select("id").eq("client_id", client_id);
  const rows = ((profs ?? []) as { id: string }[]).map((p) => ({ user_id: p.id, title: "Your daily diet summary", body: `Your summary for ${day} is ready in your portal.`, href: "/portal", icon: "🥗" }));
  if (rows.length) await supabase.from("notifications").insert(rows);
  await logAudit(me, "Daily meal summary sent", client_id, day);
  revalidatePath("/portal");
  return { ok: true };
}

// Manually write / edit the stored daily meal summary for a client + date.
export async function saveMealDaySummary(client_id: string, text: string, date?: string): Promise<{ ok?: boolean; error?: string }> {
  const me = await getProfile();
  if (!me || !canConsult(me.role)) return { error: "Not authorized." };
  const day = date || todayISO();
  if (!client_id) return { error: "Missing client." };
  const supabase = createClient();
  await supabase.from("meal_day_summaries").upsert({ client_id, date: day, summary: text.trim() || null, updated_by: me.name, updated_at: new Date().toISOString() }, { onConflict: "client_id,date" });
  await logAudit(me, "Daily meal summary edited", client_id, day);
  return { ok: true };
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
  revalidatePath("/workspace");
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
  revalidatePath("/workspace");
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

/**
 * Answer a major whiteboard alert: the assigned person records WHY it happened
 * and the SOLUTION. Upserts on (session, client, alert_key) so re-answering
 * updates rather than duplicates. Any staff member may answer (an overseer can
 * capture it on the assignee's behalf during the meeting).
 */
export async function answerWhiteboardAlert(formData: FormData) {
  const p = await getProfile();
  if (!p) return;
  const session_id = String(formData.get("session_id"));
  const client_id = String(formData.get("client_id"));
  const alert_key = String(formData.get("alert_key"));
  if (!session_id || !client_id || !alert_key) return;
  const why = String(formData.get("why") ?? "").trim();
  const solution = String(formData.get("solution") ?? "").trim();
  if (!why && !solution) return;
  const supabase = createClient();
  await supabase.from("whiteboard_alert_responses").upsert({
    session_id, client_id, alert_key,
    alert_label: String(formData.get("alert_label") ?? "") || null,
    discipline: String(formData.get("discipline") ?? "") || null,
    why: why || null, solution: solution || null,
    resolved: Boolean(solution),
    answered_by: p.name, updated_at: new Date().toISOString(),
  }, { onConflict: "session_id,client_id,alert_key" });
  revalidatePath("/whiteboard");
  revalidatePath("/workspace");
}

/** Mark (or unmark) a client as walked through on today's board. */
export async function markClientReviewed(formData: FormData) {
  const p = await getProfile();
  if (!p) return;
  const session_id = String(formData.get("session_id"));
  const client_id = String(formData.get("client_id"));
  if (!session_id || !client_id) return;
  const supabase = createClient();
  if (String(formData.get("undo")) === "true") {
    await supabase.from("whiteboard_reviews").delete().eq("session_id", session_id).eq("client_id", client_id);
  } else {
    await supabase.from("whiteboard_reviews").upsert({
      session_id, client_id,
      stage: String(formData.get("stage") ?? "") || null,
      reviewed_by: p.name,
    }, { onConflict: "session_id,client_id" });
  }
  revalidatePath("/whiteboard");
  revalidatePath("/workspace");
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

// ============================================================================
// Customised diet plan — the structured document the clinic issues.
//
// Distinct from `diet_charts`, which stores flat [label, detail] pairs and
// drives the day-2 explanation workflow. This is the multi-page plan the client
// eats from: meal slots with time windows, numbered options under each, and
// per-option calories, protein and micronutrients.
// ============================================================================

/** Dietitians (and admin oversight) author plans; the review gate is separate. */
async function planGuard() {
  const p = await getProfile();
  return p && canWriteNutrition(p.role) ? p : null;
}

type PlanMealIn = {
  seq: number; name: string; time_from: string | null; time_to: string | null;
  note: string | null; conditional: boolean;
  options: { seq: number; food_items: string; qty: string | null; kcal: number | null; protein_g: number | null; micronutrients: string | null }[];
};

/** Start a plan for a client, seeded with the clinic's standard day. */
export async function createDietPlan(formData: FormData) {
  const p = await planGuard();
  if (!p) return { error: "Not authorized." };
  const client_id = String(formData.get("client_id") || "");
  if (!client_id) return { error: "Missing client." };
  const consultation_id = String(formData.get("consultation_id") || "") || null;

  const supabase = createClient();
  const { count } = await supabase.from("diet_plans").select("id", { count: "exact", head: true }).eq("client_id", client_id);
  const { data: plan, error } = await supabase.from("diet_plans").insert({
    client_id, consultation_id, version: (count ?? 0) + 1, status: "draft",
    issued_on: todayISO(),
    how_to_use: HOW_TO_USE,
    created_by: p.name,
  }).select("id").maybeSingle();
  if (error) return { error: error.message };
  const planId = (plan as { id: string } | null)?.id;
  if (!planId) return { error: "Could not create the plan." };

  // Seed the standard slots so the dietitian edits rather than starts blank.
  await supabase.from("diet_plan_meals").insert(
    DEFAULT_MEALS.map((m) => ({ ...m, plan_id: planId })),
  );
  const { data: c } = await supabase.from("clients").select("name").eq("id", client_id).maybeSingle();
  await logAudit(p, "Diet plan started", (c as { name: string } | null)?.name, `v${(count ?? 0) + 1}`);
  revalidatePath("/workspace");
  return { ok: true, id: planId };
}

/**
 * Save the whole plan in one go — targets, notes and every slot and option.
 *
 * Meals and options are replaced wholesale rather than diffed. The builder is a
 * single form and rows get added, deleted and reordered freely; reconciling
 * that row by row buys nothing and risks leaving orphans behind. A plan is a
 * few dozen rows, so the rewrite is cheap.
 */
export async function saveDietPlan(
  id: string,
  targets: { kcal: number | null; protein: string | null; carbohydrate: string | null; fats: string | null; fibre: string | null; water: string | null },
  meta: { allergies: string | null; notes: string | null; issued_on: string | null },
  meals: PlanMealIn[],
): Promise<{ ok?: boolean; error?: string }> {
  const p = await planGuard();
  if (!p) return { error: "Not authorized." };
  if (!id) return { error: "Missing plan." };
  const supabase = createClient();

  // A published plan is what a client is eating from — edits go to a new
  // version rather than silently changing the document under them.
  const { data: cur } = await supabase.from("diet_plans").select("status").eq("id", id).maybeSingle();
  const status = (cur as { status: string } | null)?.status;
  if (!status) return { error: "Plan not found." };
  if (status === "published" || status === "archived") return { error: "Published — start a new version to change it." };

  const { error: upErr } = await supabase.from("diet_plans").update({
    kcal: targets.kcal, protein: targets.protein, carbohydrate: targets.carbohydrate,
    fats: targets.fats, fibre: targets.fibre, water: targets.water,
    allergies: meta.allergies, notes: meta.notes, issued_on: meta.issued_on,
    updated_at: new Date().toISOString(),
  }).eq("id", id);
  if (upErr) return { error: upErr.message };

  await supabase.from("diet_plan_meals").delete().eq("plan_id", id);   // options cascade
  // A slot added and never filled in would otherwise print as a blank heading
  // over "No options added." on the client's plan.
  const real = meals.filter((m) => m.name.trim() || m.options.some((o) => o.food_items.trim()));
  for (const m of real) {
    const { data: row } = await supabase.from("diet_plan_meals").insert({
      plan_id: id, seq: m.seq, name: m.name.trim(),
      time_from: m.time_from?.trim() || null, time_to: m.time_to?.trim() || null,
      note: m.note?.trim() || null, conditional: m.conditional,
    }).select("id").maybeSingle();
    const mealId = (row as { id: string } | null)?.id;
    if (!mealId) continue;
    const opts = m.options.filter((o) => o.food_items.trim()).map((o, i) => ({
      meal_id: mealId, seq: i, food_items: o.food_items.trim(),
      qty: o.qty?.trim() || null, kcal: o.kcal, protein_g: o.protein_g,
      micronutrients: o.micronutrients?.trim() || null,
    }));
    if (opts.length) await supabase.from("diet_plan_options").insert(opts);
  }
  revalidatePath("/workspace");
  return { ok: true };
}

/** Send a finished draft for sign-off. */
export async function submitDietPlan(formData: FormData) {
  const p = await planGuard();
  if (!p) return;
  const id = String(formData.get("id") || "");
  if (!id) return;
  const supabase = createClient();

  // The builder disables Submit while problems remain, but a disabled button is
  // a courtesy, not a control. Re-check here so a stale tab or a direct post
  // can't push a plan with an empty meal slot into review.
  const { data: pl } = await supabase.from("diet_plans")
    .select("kcal, diet_plan_meals(name, conditional, diet_plan_options(food_items, qty))")
    .eq("id", id).maybeSingle();
  const row = pl as { kcal: number | null; diet_plan_meals: { name: string; conditional: boolean; diet_plan_options: { food_items: string; qty: string | null }[] }[] } | null;
  if (row) {
    const meals = (row.diet_plan_meals ?? []).map((m) => ({
      seq: 0, name: m.name, time_from: null, time_to: null, note: null, conditional: m.conditional,
      options: (m.diet_plan_options ?? []).map((o, i) => ({ seq: i, food_items: o.food_items, qty: o.qty, kcal: null, protein_g: null, micronutrients: null })),
    }));
    const problems = planProblems(meals, { kcal: row.kcal, protein: null, carbohydrate: null, fats: null, fibre: null, water: null });
    if (problems.length) return;
  }

  await supabase.from("diet_plans").update({ status: "in_review" }).eq("id", id).eq("status", "draft");
  await notifyRoles(supabase, ["Super Admin", "Administrator"], {
    title: "Diet plan awaiting review",
    body: `${p.name} submitted a customised diet plan.`,
    href: "/workspace?tab=charts", icon: "🥗",
  });
  revalidatePath("/workspace");
}

/** Approve and publish, or send it back. Same gate as the diet chart review. */
export async function reviewDietPlan(formData: FormData) {
  const p = await getProfile();
  if (!p || !canReviewDietChart(p.role)) return;
  const id = String(formData.get("id") || "");
  const approve = String(formData.get("approve") || "") === "true";
  if (!id) return;
  const supabase = createClient();
  // Only a plan actually awaiting review can move. Without this, "Send back to
  // draft" would flip a PUBLISHED, shared plan back to draft in place — and
  // since shared_at was never cleared, editing and re-approving it would
  // silently rewrite the document the client is already eating from. Changing a
  // published plan goes through newDietPlanVersion, which is the whole reason
  // that action exists.
  const { data: cur } = await supabase.from("diet_plans").select("status").eq("id", id).maybeSingle();
  if ((cur as { status: string } | null)?.status !== "in_review") return;

  await supabase.from("diet_plans").update(
    approve
      ? { status: "published", reviewed_by: p.name, reviewed_at: new Date().toISOString(), published_at: new Date().toISOString() }
      : { status: "draft", reviewed_by: p.name, reviewed_at: new Date().toISOString() },
  ).eq("id", id).eq("status", "in_review");
  await logAudit(p, approve ? "Diet plan published" : "Diet plan sent back", undefined, id);
  revalidatePath("/workspace");
  revalidatePath("/portal");
}

/**
 * Put the plan in the client's portal, or take it back out.
 *
 * Deliberately separate from publishing: publishing is the clinical decision,
 * sharing is the delivery one. A plan can be approved while a colleague checks
 * the wording, and withdrawn without un-publishing it.
 */
export async function shareDietPlan(formData: FormData) {
  const p = await planGuard();
  if (!p) return { error: "Not authorized." };
  const id = String(formData.get("id") || "");
  const undo = String(formData.get("undo") || "") === "true";
  if (!id) return { error: "Missing plan." };
  const supabase = createClient();
  const { data: row } = await supabase.from("diet_plans").select("status, client_id").eq("id", id).maybeSingle();
  const r = row as { status: string; client_id: string } | null;
  if (!r) return { error: "Plan not found." };
  if (!undo && r.status !== "published") return { error: "Publish the plan before sharing it." };

  await supabase.from("diet_plans").update({ shared_at: undo ? null : new Date().toISOString() }).eq("id", id);
  if (!undo) {
    await notifyClient(supabase, r.client_id, {
      title: "Your diet plan is ready",
      body: "Your customised diet plan is now in your portal.",
      href: "/portal", icon: "🥗",
    });
  }
  await logAudit(p, undo ? "Diet plan withdrawn from portal" : "Diet plan shared to portal", undefined, id);
  revalidatePath("/workspace");
  revalidatePath("/portal");
  return { ok: true };
}

/** Copy a published plan into a fresh editable draft — the way a plan changes. */
export async function newDietPlanVersion(formData: FormData) {
  const p = await planGuard();
  if (!p) return { error: "Not authorized." };
  const id = String(formData.get("id") || "");
  if (!id) return { error: "Missing plan." };
  const supabase = createClient();

  const { data: src } = await supabase.from("diet_plans").select("*").eq("id", id).maybeSingle();
  const s = src as Record<string, unknown> | null;
  if (!s) return { error: "Plan not found." };
  const { count } = await supabase.from("diet_plans").select("id", { count: "exact", head: true }).eq("client_id", s.client_id as string);

  const { data: copy } = await supabase.from("diet_plans").insert({
    client_id: s.client_id, consultation_id: s.consultation_id,
    version: (count ?? 0) + 1, status: "draft", issued_on: todayISO(),
    kcal: s.kcal, protein: s.protein, carbohydrate: s.carbohydrate, fats: s.fats,
    fibre: s.fibre, water: s.water, allergies: s.allergies, notes: s.notes,
    how_to_use: s.how_to_use, created_by: p.name,
  }).select("id").maybeSingle();
  const newId = (copy as { id: string } | null)?.id;
  if (!newId) return { error: "Could not copy the plan." };

  const { data: meals } = await supabase.from("diet_plan_meals").select("id, seq, name, time_from, time_to, note, conditional").eq("plan_id", id).order("seq");
  for (const m of ((meals ?? []) as { id: string; seq: number; name: string; time_from: string | null; time_to: string | null; note: string | null; conditional: boolean }[])) {
    const { data: nm } = await supabase.from("diet_plan_meals").insert({
      plan_id: newId, seq: m.seq, name: m.name, time_from: m.time_from, time_to: m.time_to, note: m.note, conditional: m.conditional,
    }).select("id").maybeSingle();
    const nmId = (nm as { id: string } | null)?.id;
    if (!nmId) continue;
    const { data: opts } = await supabase.from("diet_plan_options").select("seq, food_items, qty, kcal, protein_g, micronutrients").eq("meal_id", m.id).order("seq");
    const rows = ((opts ?? []) as Record<string, unknown>[]).map((o) => ({ ...o, meal_id: nmId }));
    if (rows.length) await supabase.from("diet_plan_options").insert(rows);
  }
  revalidatePath("/workspace");
  return { ok: true, id: newId };
}

// ============================================================================
// Rendering a document to an actual PDF file.
//
// The seam lives in lib/pdf.ts; this is the part that talks to the database and
// storage. Nothing here assumes a particular renderer — swapping Browserless
// for PDFShift is an environment change, not a code change.
// ============================================================================

/** What the UI needs to decide whether to offer a "Generate PDF" button. */
export async function pdfStatus(): Promise<{ ready: boolean; provider: string | null; missing: string[] }> {
  const p = await getProfile();
  if (!p || !canConsult(p.role)) return { ready: false, provider: null, missing: [] };
  return pdfReadiness();
}

/**
 * Render a document, store it, and record what was issued.
 *
 * Returns a signed link to the stored file. The file itself is permanent and
 * frozen; only the link expires, which is the right way round — the record of
 * what a client was given must outlive any URL.
 */
export async function renderDocument(formData: FormData): Promise<{ ok?: boolean; url?: string; name?: string; docId?: string; error?: string }> {
  const p = await getProfile();
  if (!p || !canConsult(p.role)) return { error: "Not authorized." };

  const kind = String(formData.get("kind") || "") as DocKind;
  const id = String(formData.get("id") || "");
  if (!DOC_KINDS.includes(kind)) return { error: "Unknown document type." };
  if (!id) return { error: "Missing document." };

  const ready = pdfReadiness();
  if (!ready.ready) return { error: `PDF rendering isn't set up yet — still needs ${ready.missing.join(", ")}.` };
  const provider = pdfProvider();
  const url = renderUrl(kind, id);
  if (!provider || !url) return { error: "PDF rendering isn't set up yet." };

  const supabase = createClient();

  // Who the document belongs to, and what to call the file. Each document type
  // reaches its client differently, so resolve it per kind rather than guessing.
  let clientId: string | null = null;
  let clientName = "Client";
  let issuedOn: string | null = null;
  if (kind === "plan") {
    const { data } = await supabase.from("diet_plans").select("client_id, issued_on, clients(name)").eq("id", id).maybeSingle();
    const r = data as unknown as { client_id: string; issued_on: string | null; clients: { name: string } | null } | null;
    clientId = r?.client_id ?? null; clientName = r?.clients?.name ?? "Client"; issuedOn = r?.issued_on ?? null;
  } else if (kind === "rx") {
    const { data } = await supabase.from("prescriptions").select("client_id, clients(name)").eq("id", id).maybeSingle();
    const r = data as unknown as { client_id: string; clients: { name: string } | null } | null;
    clientId = r?.client_id ?? null; clientName = r?.clients?.name ?? "Client";
  } else if (kind === "assess") {
    const { data } = await supabase.from("diet_assessments").select("client_id, issued_on, clients(name)").eq("id", id).maybeSingle();
    const r = data as unknown as { client_id: string; issued_on: string | null; clients: { name: string } | null } | null;
    clientId = r?.client_id ?? null; clientName = r?.clients?.name ?? "Client"; issuedOn = r?.issued_on ?? null;
  } else if (kind === "lab" || kind === "summary") {
    // Both print from a consultation.
    const { data } = await supabase.from("consultations").select("client_id, clients(name)").eq("id", id).maybeSingle();
    const r = data as unknown as { client_id: string | null; clients: { name: string } | null } | null;
    clientId = r?.client_id ?? null; clientName = r?.clients?.name ?? "Client";
  }
  if (!clientId) return { error: "That document isn't attached to a client." };

  // ---- render ---------------------------------------------------------------
  let bytes: Uint8Array;
  try {
    bytes = await provider.render(url);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await logAudit(p, "PDF render failed", clientName, `${kind} · ${msg.slice(0, 160)}`);
    return { error: `Rendering failed — ${msg.slice(0, 160)}` };
  }
  // A PDF always starts "%PDF". Anything else means the renderer returned an
  // error page or an empty body, and storing that would leave a file that opens
  // to nothing — worse than failing here.
  if (bytes.length < 1000 || String.fromCharCode(...bytes.slice(0, 4)) !== "%PDF") {
    return { error: "The renderer did not return a PDF. Check the page loads for a signed-out visitor." };
  }

  // ---- store ----------------------------------------------------------------
  const path = storagePath(kind, id);
  const name = fileName(kind, clientName, issuedOn);
  const { error: upErr } = await supabase.storage.from("documents")
    .upload(path, bytes, { contentType: "application/pdf", upsert: false });
  if (upErr) return { error: upErr.message };

  const { data: docRow } = await supabase.from("issued_documents").insert({
    kind, ref_id: id, client_id: clientId, path, file_name: name,
    bytes: bytes.length, provider: provider.name, issued_by: p.name,
  }).select("id").maybeSingle();
  await logAudit(p, "Document rendered", clientName, `${DOC_LABEL[kind]} · ${(bytes.length / 1024).toFixed(0)} KB`);

  const { data: signed } = await supabase.storage.from("documents").createSignedUrl(path, 3600);
  revalidatePath("/workspace");
  return { ok: true, url: signed?.signedUrl, name, docId: (docRow as { id: string } | null)?.id };
}

/** A fresh link to a document already rendered. Links expire; files do not. */
export async function documentLink(formData: FormData): Promise<{ url?: string; name?: string; error?: string }> {
  const p = await getProfile();
  if (!p || !canConsult(p.role)) return { error: "Not authorized." };
  const docId = String(formData.get("doc_id") || "");
  if (!docId) return { error: "Missing document." };
  const supabase = createClient();
  const { data } = await supabase.from("issued_documents").select("path, file_name").eq("id", docId).maybeSingle();
  const r = data as { path: string; file_name: string } | null;
  if (!r) return { error: "Document not found." };
  const { data: signed } = await supabase.storage.from("documents").createSignedUrl(r.path, 3600);
  return { url: signed?.signedUrl, name: r.file_name };
}

/**
 * Send an already-rendered document to the client's WhatsApp.
 *
 * Deliberately takes an `issued_documents` row rather than a plan or
 * prescription id: you send a FILE that exists, not a document you hope renders.
 * That also means the delivery record points at the exact bytes the client
 * received, which is the whole reason the table exists.
 */
export async function sendDocumentWhatsApp(formData: FormData): Promise<{ ok?: boolean; error?: string }> {
  const p = await getProfile();
  if (!p || !canConsult(p.role)) return { error: "Not authorized." };
  const docId = String(formData.get("doc_id") || "");
  if (!docId) return { error: "Missing document." };

  const wati = watiReadiness();
  if (!wati.ready) return { error: `WhatsApp isn't set up — missing ${wati.missing.join(", ")}.` };

  const supabase = createClient();
  const { data } = await supabase.from("issued_documents")
    .select("id, kind, path, file_name, client_id, sent_at, clients(name, phone)")
    .eq("id", docId).maybeSingle();
  const doc = data as unknown as {
    id: string; kind: string; path: string; file_name: string; client_id: string | null;
    sent_at: string | null; clients: { name: string; phone: string | null } | null;
  } | null;
  if (!doc) return { error: "Document not found." };
  if (doc.sent_at) return { error: "Already sent. Render a fresh copy to send again." };
  const phone = doc.clients?.phone ?? null;
  if (!phone) return { error: "That client has no phone number on record." };

  // Wati fetches the file from its own servers, so the link must outlive the
  // request. A day is generous for a retry and still expires.
  const { data: signed } = await supabase.storage.from("documents").createSignedUrl(doc.path, 86_400);
  if (!signed?.signedUrl) return { error: "Could not produce a link to the file." };

  const first = (doc.clients?.name ?? "there").trim().split(/\s+/)[0];
  const res = await sendDocument({
    phone,
    template: { name: templateFor(doc.kind), params: [first] },
    mediaUrl: signed.signedUrl,
    fileName: doc.file_name,
  });

  // Record the outcome either way. A failed send that leaves no trace is how
  // "I sent it" and "they never got it" both end up true.
  await supabase.from("issued_documents").update(
    res.ok
      ? { sent_at: new Date().toISOString(), sent_to: normalisePhone(phone), send_error: null }
      : { send_error: res.error?.slice(0, 300) ?? "Unknown error" },
  ).eq("id", docId);

  await logAudit(p, res.ok ? "Document sent on WhatsApp" : "WhatsApp send failed",
    doc.clients?.name, `${doc.file_name}${res.ok ? "" : ` · ${res.error?.slice(0, 120)}`}`);
  revalidatePath("/workspace");
  return res.ok ? { ok: true } : { error: res.error };
}

/** Readiness for the UI, so a Send button is offered only when it can work. */
export async function whatsappStatus(): Promise<{ ready: boolean; missing: string[] }> {
  const p = await getProfile();
  if (!p || !canConsult(p.role)) return { ready: false, missing: [] };
  return watiReadiness();
}

// ============================================================================
// Dietary Assessment Summary — the companion document to the diet plan.
// ============================================================================

/**
 * Start an assessment, pre-filled from everything already recorded.
 *
 * The point of drafting rather than opening blank: a dietitian who has just
 * spent an hour on the questionnaire should be correcting, not retyping it into
 * a second document.
 */
export async function createDietAssessment(formData: FormData): Promise<{ ok?: boolean; id?: string; error?: string }> {
  const p = await planGuard();
  if (!p) return { error: "Not authorized." };
  const client_id = String(formData.get("client_id") || "");
  if (!client_id) return { error: "Missing client." };
  const consultation_id = String(formData.get("consultation_id") || "") || null;
  const supabase = createClient();

  const [{ data: c }, { data: m }, { data: alg }, { data: consult }, { count }] = await Promise.all([
    supabase.from("clients").select("dob, gender, occupation, height, weight, conditions, goals").eq("id", client_id).maybeSingle(),
    supabase.from("measurements").select("weight, bmi, body_fat, muscle_mass, visceral_fat, waist, hip, bmr")
      .eq("client_id", client_id).order("date", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("allergies").select("substance, severity").eq("client_id", client_id),
    supabase.from("consultations").select("answers, created_at, staff(name)")
      .eq("client_id", client_id).eq("kind", "Diet").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("diet_assessments").select("id", { count: "exact", head: true }).eq("client_id", client_id),
  ]);

  const con = consult as unknown as { answers: [string, string][] | null; created_at: string; staff: { name: string } | null } | null;
  const draft = draftAssessment({
    client: (c ?? { dob: null, gender: null, occupation: null, height: null, weight: null, conditions: null, goals: null }) as never,
    measurement: (m ?? null) as never,
    allergies: ((alg ?? []) as { substance: string; severity: string }[]).map((a) => `${a.substance}${a.severity ? ` (${a.severity})` : ""}`),
    answers: con?.answers ?? [],
    dietitian: con?.staff?.name ?? p.name,
    consultedOn: con?.created_at ? con.created_at.slice(0, 10) : null,
  });

  const { data: row, error } = await supabase.from("diet_assessments").insert({
    client_id, consultation_id, version: (count ?? 0) + 1, status: "draft",
    issued_on: todayISO(), created_by: p.name, ...draft,
  }).select("id").maybeSingle();
  if (error) return { error: error.message };

  const { data: cl } = await supabase.from("clients").select("name").eq("id", client_id).maybeSingle();
  await logAudit(p, "Assessment summary drafted", (cl as { name: string } | null)?.name, `v${(count ?? 0) + 1}`);
  revalidatePath("/workspace");
  return { ok: true, id: (row as { id: string } | null)?.id };
}

/** Save the assessment. Published rows are immutable — change goes to a new version. */
export async function saveDietAssessment(id: string, patch: Record<string, unknown>): Promise<{ ok?: boolean; error?: string }> {
  const p = await planGuard();
  if (!p) return { error: "Not authorized." };
  if (!id) return { error: "Missing assessment." };
  const supabase = createClient();
  const { data: cur } = await supabase.from("diet_assessments").select("status").eq("id", id).maybeSingle();
  const status = (cur as { status: string } | null)?.status;
  if (!status) return { error: "Assessment not found." };
  if (status === "published" || status === "archived") return { error: "Published — start a new version to change it." };

  // Whitelist: a patch comes from the browser, and letting it name its own
  // columns would let it move `status` or `client_id`.
  const ALLOWED = new Set([
    "consulted_on", "dietitian", "medical_history", "existing_condition", "medications", "allergies", "family_history",
    "occupation", "daily_activity", "exercise", "sleep_hours", "sleep_quality", "stress_level", "gut_health", "weight_change",
    "diet_type", "food_allergies", "food_dislikes", "supplements",
    "height", "weight", "bmi", "bmr", "tee", "muscle_mass", "fat_mass", "body_fat", "visceral_fat", "waist_hip",
    "primary_goals", "target_weight", "timeline_weeks", "objectives",
    "meal_frequency", "meals_per_day", "snacking", "hydration", "notes", "issued_on",
  ]);
  const clean: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const [k, v] of Object.entries(patch)) if (ALLOWED.has(k)) clean[k] = v;

  const { error } = await supabase.from("diet_assessments").update(clean).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/workspace");
  return { ok: true };
}

/**
 * Copy a published assessment into a fresh editable draft.
 *
 * Deliberately NOT `createDietAssessment`, which re-drafts from live data: that
 * would discard every correction the dietitian made and silently swap in
 * today's InBody figures. A revision starts from what was issued.
 */
export async function newDietAssessmentVersion(formData: FormData): Promise<{ ok?: boolean; id?: string; error?: string }> {
  const p = await planGuard();
  if (!p) return { error: "Not authorized." };
  const id = String(formData.get("id") || "");
  if (!id) return { error: "Missing assessment." };
  const supabase = createClient();

  const { data: src } = await supabase.from("diet_assessments").select("*").eq("id", id).maybeSingle();
  const s = src as Record<string, unknown> | null;
  if (!s) return { error: "Assessment not found." };
  const { count } = await supabase.from("diet_assessments").select("id", { count: "exact", head: true }).eq("client_id", s.client_id as string);

  // Everything except the row's own identity and its lifecycle stamps.
  const { id: _id, version: _v, status: _s, created_at: _c, updated_at: _u,
    reviewed_by: _rb, reviewed_at: _ra, published_at: _pa, shared_at: _sa, ...carry } = s;

  const { data: copy, error } = await supabase.from("diet_assessments").insert({
    ...carry, version: (count ?? 0) + 1, status: "draft",
    issued_on: todayISO(), created_by: p.name,
  }).select("id").maybeSingle();
  if (error) return { error: error.message };
  revalidatePath("/workspace");
  return { ok: true, id: (copy as { id: string } | null)?.id };
}

export async function submitDietAssessment(formData: FormData) {
  const p = await planGuard();
  if (!p) return;
  const id = String(formData.get("id") || "");
  if (!id) return;
  const supabase = createClient();
  await supabase.from("diet_assessments").update({ status: "in_review" }).eq("id", id).eq("status", "draft");
  await notifyRoles(supabase, ["Super Admin", "Administrator"], {
    title: "Assessment summary awaiting review",
    body: `${p.name} submitted a dietary assessment summary.`,
    href: "/workspace?tab=charts", icon: "📋",
  });
  revalidatePath("/workspace");
}

export async function reviewDietAssessment(formData: FormData) {
  const p = await getProfile();
  if (!p || !canReviewDietChart(p.role)) return;
  const id = String(formData.get("id") || "");
  const approve = String(formData.get("approve") || "") === "true";
  if (!id) return;
  const supabase = createClient();
  // Only a row actually awaiting review may move — same reasoning as the plan:
  // otherwise a published, shared document could be flipped back and rewritten
  // under a client who already has it.
  const { data: cur } = await supabase.from("diet_assessments").select("status").eq("id", id).maybeSingle();
  if ((cur as { status: string } | null)?.status !== "in_review") return;

  await supabase.from("diet_assessments").update(
    approve
      ? { status: "published", reviewed_by: p.name, reviewed_at: new Date().toISOString(), published_at: new Date().toISOString() }
      : { status: "draft", reviewed_by: p.name, reviewed_at: new Date().toISOString() },
  ).eq("id", id).eq("status", "in_review");
  await logAudit(p, approve ? "Assessment summary published" : "Assessment summary sent back", undefined, id);
  revalidatePath("/workspace");
  revalidatePath("/portal");
}

export async function shareDietAssessment(formData: FormData): Promise<{ ok?: boolean; error?: string }> {
  const p = await planGuard();
  if (!p) return { error: "Not authorized." };
  const id = String(formData.get("id") || "");
  const undo = String(formData.get("undo") || "") === "true";
  if (!id) return { error: "Missing assessment." };
  const supabase = createClient();
  const { data: row } = await supabase.from("diet_assessments").select("status, client_id").eq("id", id).maybeSingle();
  const r = row as { status: string; client_id: string } | null;
  if (!r) return { error: "Assessment not found." };
  if (!undo && r.status !== "published") return { error: "Publish it before sharing." };

  await supabase.from("diet_assessments").update({ shared_at: undo ? null : new Date().toISOString() }).eq("id", id);
  if (!undo) {
    await notifyClient(supabase, r.client_id, {
      title: "Your dietary assessment is ready",
      body: "Your assessment summary is now in your portal.",
      href: "/portal", icon: "📋",
    });
  }
  await logAudit(p, undo ? "Assessment withdrawn from portal" : "Assessment shared to portal", undefined, id);
  revalidatePath("/workspace");
  revalidatePath("/portal");
  return { ok: true };
}
