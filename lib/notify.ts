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
