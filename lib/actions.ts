"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/auth";
import { canWrite, canManageSessions, canManagePackages, canConsult, canManageBlueprint, canBill, canMessage, canClasses, canRetention, canPos, canEmr } from "@/lib/roles";
import { BP_SCORES } from "@/lib/blueprint";
import { todayISO } from "@/lib/today";


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
  if (!me || me.role !== "Administrator") return; // only admins can preview
  const role = String(formData.get("role") ?? "");
  const store = cookies();
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
  "Administrator", "Manager", "Front Desk", "Health Professional", "Finance", "HR", "Staff",
];

export type InviteState = { error?: string; ok?: string };

export async function inviteStaff(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const me = await getProfile();
  if (!me || me.role !== "Administrator") return { error: "Not authorized." };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "Front Desk");
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
  if (uid) {
    // the signup trigger creates a Front Desk profile; set the chosen name + role
    await admin.from("profiles").upsert({ id: uid, email, name: name || email.split("@")[0], role });
  }
  await logAudit(me, "Staff created", email, `role: ${role}`);
  revalidatePath("/users");
  return { ok: `Created ${email} as ${role}. Share the temporary password with them.` };
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
  if (!me || me.role !== "Administrator") return; // only admins manage roles
  const id = String(formData.get("id"));
  const role = String(formData.get("role"));
  if (!ALLOWED_ROLES.includes(role)) return;
  if (id === me.id && role !== "Administrator") return; // don't let an admin demote themselves
  const admin = createAdminClient();
  const { data: target } = await admin.from("profiles").select("email, role").eq("id", id).maybeSingle();
  await admin.from("profiles").update({ role }).eq("id", id);
  await logAudit(me, "Role changed", target?.email ?? id, `${target?.role ?? "?"} → ${role}`);
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

// ---- consultations (professional workspace) --------------------------------

export async function createConsultation(formData: FormData) {
  const p = await getProfile();
  if (!p || !canConsult(p.role)) return;
  const client_id = String(formData.get("client_id"));
  const kind = String(formData.get("kind"));
  const notes = String(formData.get("notes") ?? "").trim() || null;
  if (!client_id || !kind) return;
  const supabase = createClient();
  await supabase.from("consultations").insert({
    client_id, kind, notes, status: "scheduled", by_name: p.name, by_role: p.role,
  });
  const { data: c } = await supabase.from("clients").select("name").eq("id", client_id).maybeSingle();
  await logAudit(p, "Consultation created", c?.name, kind);
  revalidatePath("/pro");
}

export async function completeConsultation(formData: FormData) {
  const p = await getProfile();
  if (!p || !canConsult(p.role)) return;
  const id = String(formData.get("id"));
  const summary = String(formData.get("summary") ?? "").trim() || null;
  const supabase = createClient();
  await supabase.from("consultations").update({ status: "completed", summary }).eq("id", id);
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
  await supabase.from("consultations").update({ [field]: !value }).eq("id", id);
  revalidatePath("/pro");
  revalidatePath("/", "layout");
}

// ---- BluePrint -------------------------------------------------------------

export async function requestBlood(formData: FormData) {
  const p = await getProfile();
  if (!p || !canManageBlueprint(p.role)) return;
  const client_id = String(formData.get("client_id"));
  const supabase = createClient();
  await supabase.from("blood_requests").upsert({
    client_id, requested_at: todayISO(), submitted: false,
  });
  const { data: c } = await supabase.from("clients").select("name").eq("id", client_id).maybeSingle();
  await logAudit(p, "Blood report requested", c?.name, null);
  revalidatePath("/blueprint");
}

export async function markBloodReceived(formData: FormData) {
  const p = await getProfile();
  if (!p || !canManageBlueprint(p.role)) return;
  const client_id = String(formData.get("client_id"));
  const supabase = createClient();
  await supabase.from("blood_requests").update({ submitted: true, submitted_date: todayISO() }).eq("client_id", client_id);
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
    await supabase.from("blood_requests").update({ submitted: true, submitted_date: todayISO() }).eq("client_id", prof.client_id);
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
  await supabase.from("blueprints").upsert({
    client_id, consolidated, status: "generated", generated: true, generated_date: todayISO(),
    updated_at: new Date().toISOString(),
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
  const supabase = createClient();
  await supabase.from("messages").insert({ client_id, sender: "staff", sender_name: p.name, body });
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
  if (!p || !canBill(p.role)) return;
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
  revalidatePath("/billing");
  if (client_id) revalidatePath(`/clients/${client_id}`);
}

export async function markInvoicePaid(formData: FormData) {
  const p = await getProfile();
  if (!p || !canBill(p.role)) return;
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
  if (!p || !canBill(p.role)) return;
  const id = String(formData.get("id"));
  const supabase = createClient();
  await supabase.from("invoices").update({ status: "Refunded" }).eq("id", id);
  await logAudit(p, "Invoice refunded", null, null);
  revalidatePath("/billing");
  revalidatePath("/", "layout");
}

// ---- subscriptions / recurring billing -------------------------------------

function addDays(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
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
  await logAudit(p, "Client created", c.name, code);
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
  await logAudit(p, "Client updated", c.name, null);
  revalidatePath("/", "layout");
  redirect(`/clients/${id}`);
}
