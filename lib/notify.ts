// In-app notification helper. Fans a notification out to every staff member
// holding one of the given roles. Works with the request-scoped Supabase client
// (staff insert is RLS-allowed) or the service-role client (cron).

type AnyClient = { from: (t: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any

type NotifInput = { title: string; body?: string; href?: string; icon?: string; link?: { kind: string; ref: string } };

export async function notifyRoles(
  supabase: AnyClient,
  roles: string[],
  n: NotifInput,
) {
  const { data } = await supabase.from("profiles").select("id").in("role", roles);
  const rows = ((data ?? []) as { id: string }[]).map((p) => ({
    user_id: p.id, title: n.title, body: n.body ?? null, href: n.href ?? null, icon: n.icon ?? "🔔",
    link_kind: n.link?.kind ?? null, link_ref: n.link?.ref ?? null,
  }));
  if (rows.length) await supabase.from("notifications").insert(rows);
}

/**
 * Notify one specific person, by staff id.
 *
 * `notifyRoles` fans out to everyone holding a role, which is right for
 * "someone in management should look at this" but wrong for "this is your
 * lead". Without this, the lead owner recorded on a row could only ever be
 * interpolated into message text, never actually targeted — which is why every
 * Front Desk staffer received every callback alert.
 *
 * Returns true if a notification was written. A staff member with no linked
 * login (no profiles row pointing at them) silently gets nothing, which is
 * correct — there is no inbox to deliver to.
 */
export async function notifyStaff(
  supabase: AnyClient,
  staffId: string,
  n: NotifInput,
): Promise<boolean> {
  const { data } = await supabase
    .from("profiles").select("id").eq("staff_id", staffId).limit(1);
  const prof = ((data ?? []) as { id: string }[])[0];
  if (!prof) return false;
  await supabase.from("notifications").insert({
    user_id: prof.id, title: n.title, body: n.body ?? null,
    href: n.href ?? null, icon: n.icon ?? "🔔",
    link_kind: n.link?.kind ?? null, link_ref: n.link?.ref ?? null,
  });
  return true;
}

/**
 * Notify a CLIENT in their portal, by client id.
 *
 * The two helpers above target staff — by role, or by staff id. Neither can
 * reach a client, because a client's login is linked through profiles.client_id
 * rather than staff_id. Without this, "your diet plan is ready" could only be
 * written into a message thread and hoped for.
 *
 * Silently does nothing if the client has no portal login yet, which is the
 * right behaviour: there is no inbox to deliver to, and the document is still
 * waiting for them when they do log in.
 */
export async function notifyClient(
  supabase: AnyClient,
  clientId: string,
  n: NotifInput,
): Promise<boolean> {
  const { data } = await supabase
    .from("profiles").select("id").eq("client_id", clientId).limit(1);
  const prof = ((data ?? []) as { id: string }[])[0];
  if (!prof) return false;
  await supabase.from("notifications").insert({
    user_id: prof.id, title: n.title, body: n.body ?? null,
    href: n.href ?? null, icon: n.icon ?? "🔔",
    link_kind: n.link?.kind ?? null, link_ref: n.link?.ref ?? null,
  });
  return true;
}
