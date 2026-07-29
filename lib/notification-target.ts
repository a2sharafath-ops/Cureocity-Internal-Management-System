// Stable notification targets.
//
// A notification's `href` is captured when it's created and never changes, so if
// we later move where an intent should point, older notifications go stale. To
// avoid that whole class of bug, notifications can store an *intent*
// (link_kind + link_ref) and the destination URL is computed fresh every time
// the notification is opened (see openNotification). Add a case here — never a
// hardcoded href — when a new kind of actionable notification is introduced.

export type NotifLink = { kind: string; ref: string };

/** Resolve an intent to a current URL. Returns null for unknown kinds so the
 *  caller can fall back to the notification's stored href. */
export function resolveNotificationTarget(kind: string | null, ref: string | null): string | null {
  if (!kind || !ref) return null;
  switch (kind) {
    case "workout":     return `/workspace?role=trainer&tab=planner&client=${ref}`;
    case "diet-chart":  return `/workspace?role=diet&tab=charts&client=${ref}`;
    case "consolidated":return `/workspace?role=doctor&tab=summaries&client=${ref}`;
    // A clinician's own workspace Appointments tab (their login resolves the
    // discipline; oversight roles land on their default workspace).
    case "appointment": return `/workspace?tab=appts`;
    case "client":      return `/clients/${ref}`;
    default:            return null;
  }
}

/** Derive the intent for a clinician nudge from its label + client, so the
 *  reminder always opens the right drafting screen even if that screen moves. */
export function nudgeLink(label: string, clientId: string): NotifLink {
  const l = label.toLowerCase();
  if (/diet chart/.test(l)) return { kind: "diet-chart", ref: clientId };
  if (/workout/.test(l))    return { kind: "workout", ref: clientId };
  if (/consolidated/.test(l)) return { kind: "consolidated", ref: clientId };
  return { kind: "client", ref: clientId };
}
