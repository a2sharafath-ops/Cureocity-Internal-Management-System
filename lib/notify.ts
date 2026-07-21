// In-app notification helper. Fans a notification out to every staff member
// holding one of the given roles. Works with the request-scoped Supabase client
// (staff insert is RLS-allowed) or the service-role client (cron).

type AnyClient = { from: (t: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any

export async function notifyRoles(
  supabase: AnyClient,
  roles: string[],
  n: { title: string; body?: string; href?: string; icon?: string },
) {
  const { data } = await supabase.from("profiles").select("id").in("role", roles);
  const rows = ((data ?? []) as { id: string }[]).map((p) => ({
    user_id: p.id, title: n.title, body: n.body ?? null, href: n.href ?? null, icon: n.icon ?? "🔔",
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
  n: { title: string; body?: string; href?: string; icon?: string },
): Promise<boolean> {
  const { data } = await supabase
    .from("profiles").select("id").eq("staff_id", staffId).limit(1);
  const prof = ((data ?? []) as { id: string }[])[0];
  if (!prof) return false;
  await supabase.from("notifications").insert({
    user_id: prof.id, title: n.title, body: n.body ?? null,
    href: n.href ?? null, icon: n.icon ?? "🔔",
  });
  return true;
}
