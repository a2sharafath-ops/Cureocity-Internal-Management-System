import { MARKER_BY_KEY, type MarkerKey } from "@/lib/coach-markers";

export type CoachAlertLevel = "red" | "amber" | "blue" | "green";

export type CoachRuleAlert = {
  key: string;
  clientId: string;
  clientName: string;
  level: CoachAlertLevel;
  title: string;
  detail: string;
  actionLabel: string;
  href: string;
  occurredOn: string;
};

export type CoachAlertAssessment = {
  client_id: string;
  marker: string;
  date: string;
  tone: string | null;
  band: string | null;
  next_review_date: string | null;
  recommended_action: string | null;
};

export type CoachAlertSafety = {
  id: string;
  client_id: string;
  status: string;
  trigger_type: string;
  concern_summary: string;
  opened_at: string;
};

export type CoachAlertReferral = {
  id: string;
  client_id: string;
  destination_role: string;
  urgency: string;
  status: string;
  reason: string;
  created_at: string;
  updated_at: string;
};

export type CoachAlertAdherence = {
  client_id: string;
  event_date: string;
  outcome: "Completed" | "Missed" | "Excused";
  category: string;
};

export type CoachAlertGoal = {
  client_id: string;
  name: string;
  status: string;
  updated_at: string;
};

export type CoachAlertLifecycle = {
  client_id: string;
  status: string;
  next_contact_date: string | null;
  next_contact_plan: string | null;
};

export type CoachAlertInput = {
  today: string;
  clients: { id: string; name: string }[];
  assessments: CoachAlertAssessment[];
  safetyEvents: CoachAlertSafety[];
  referrals: CoachAlertReferral[];
  adherenceEvents: CoachAlertAdherence[];
  goals: CoachAlertGoal[];
  lifecycles: CoachAlertLifecycle[];
};

const LEVEL_ORDER: Record<CoachAlertLevel, number> = { red: 0, amber: 1, blue: 2, green: 3 };
const CLOSED_REFERRALS = new Set(["Completed", "Declined", "Unable to contact", "Cancelled"]);

const REFERRAL_DESTINATION: Partial<Record<MarkerKey, string>> = {
  stress: "Psychologist",
  sleep: "Doctor",
  activity: "Doctor",
  nutrition: "Dietitian",
  substance: "Doctor",
  anxiety: "Psychologist",
  mood: "Psychologist",
};

function recentStart(today: string, days: number) {
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function addDays(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function referralLink(clientId: string, destination: string, reason: string) {
  return `/clients/${clientId}?tab=overview&referral=${encodeURIComponent(destination)}&referral_reason=${encodeURIComponent(reason)}#care-coordination`;
}

/**
 * Convert existing clinical and coaching records into the SOP's four alert
 * levels. This function never diagnoses, changes a plan or sends a referral.
 * A rule can pre-fill the approved warm-referral form, but a person must review
 * and submit it.
 */
export function buildCoachAlerts(input: CoachAlertInput): CoachRuleAlert[] {
  const names = new Map(input.clients.map((client) => [client.id, client.name]));
  const alerts: CoachRuleAlert[] = [];
  const openSafetyClients = new Set<string>();

  for (const lifecycle of input.lifecycles) {
    if (!names.has(lifecycle.client_id) || !lifecycle.next_contact_date || lifecycle.next_contact_date > addDays(input.today, 7)) continue;
    const isUpcoming = lifecycle.next_contact_date > input.today;
    const daysAway = Math.round((Date.parse(`${lifecycle.next_contact_date}T00:00:00Z`) - Date.parse(`${input.today}T00:00:00Z`)) / 86_400_000);
    alerts.push({
      key: `programme-contact:${lifecycle.client_id}`,
      clientId: lifecycle.client_id,
      clientName: names.get(lifecycle.client_id)!,
      level: lifecycle.status === "Active" ? "blue" : "amber",
      title: isUpcoming ? `${lifecycle.status} programme follow-up is coming up` : `${lifecycle.status} programme follow-up is due`,
      detail: `${lifecycle.next_contact_plan ?? "Review the recorded lifecycle plan."} · ${isUpcoming ? `in ${daysAway} day${daysAway === 1 ? "" : "s"}` : "due"} ${lifecycle.next_contact_date}`,
      actionLabel: isUpcoming ? "Plan follow-up" : "Open lifecycle",
      href: `/clients/${lifecycle.client_id}?tab=overview#programme-lifecycle`,
      occurredOn: lifecycle.next_contact_date,
    });
  }

  for (const event of input.safetyEvents) {
    if (event.status === "Resolved" || !names.has(event.client_id)) continue;
    openSafetyClients.add(event.client_id);
    alerts.push({
      key: `safety:${event.id}`,
      clientId: event.client_id,
      clientName: names.get(event.client_id)!,
      level: "red",
      title: "Safety escalation requires clinical ownership",
      detail: `${event.trigger_type} · ${event.status}. ${event.concern_summary}`,
      actionLabel: "Open safety record",
      href: `/clients/${event.client_id}?tab=overview#safety-alerts`,
      occurredOn: event.opened_at.slice(0, 10),
    });
  }

  const openReferrals = input.referrals.filter((referral) =>
    names.has(referral.client_id) && !CLOSED_REFERRALS.has(referral.status),
  );
  for (const referral of openReferrals) {
    alerts.push({
      key: `referral:${referral.id}`,
      clientId: referral.client_id,
      clientName: names.get(referral.client_id)!,
      level: referral.urgency === "Urgent" ? "red" : "blue",
      title: referral.urgency === "Urgent"
        ? `Urgent ${referral.destination_role.toLowerCase()} referral is still open`
        : `${referral.destination_role} referral is ${referral.status.toLowerCase()}`,
      detail: referral.reason,
      actionLabel: "Open referral",
      href: `/clients/${referral.client_id}?tab=overview#care-coordination`,
      occurredOn: referral.updated_at.slice(0, 10),
    });
  }

  // Only the newest result for each client/instrument controls the current
  // alert. An older high score must not remain open after a newer safe result.
  const latest = new Map<string, CoachAlertAssessment>();
  for (const assessment of [...input.assessments].sort((a, b) => b.date.localeCompare(a.date))) {
    const key = `${assessment.client_id}:${assessment.marker}`;
    if (!latest.has(key) && names.has(assessment.client_id)) latest.set(key, assessment);
  }
  for (const assessment of latest.values()) {
    const marker = MARKER_BY_KEY[assessment.marker as MarkerKey];
    if (!marker) continue;
    const destination = REFERRAL_DESTINATION[marker.key];
    const matchingReferral = destination && openReferrals.some((referral) =>
      referral.client_id === assessment.client_id && referral.destination_role === destination,
    );

    if (assessment.tone === "bad" && destination && !matchingReferral && !openSafetyClients.has(assessment.client_id)) {
      const reason = `${marker.tool} result recorded as ${assessment.band ?? "action required"}. ${assessment.recommended_action ?? marker.referral}`;
      alerts.push({
        key: `screen-referral:${assessment.client_id}:${marker.key}`,
        clientId: assessment.client_id,
        clientName: names.get(assessment.client_id)!,
        level: "amber",
        title: `${marker.label} result needs a warm referral decision`,
        detail: reason,
        actionLabel: `Prepare ${destination} referral`,
        href: referralLink(assessment.client_id, destination, reason),
        occurredOn: assessment.date,
      });
    } else if (assessment.next_review_date && assessment.next_review_date <= input.today) {
      alerts.push({
        key: `screen-due:${assessment.client_id}:${marker.key}`,
        clientId: assessment.client_id,
        clientName: names.get(assessment.client_id)!,
        level: "amber",
        title: `${marker.label} re-assessment is due`,
        detail: `${marker.tool} · due ${assessment.next_review_date}`,
        actionLabel: "Open screening",
        href: `/workspace?role=coach&tab=coaching`,
        occurredOn: assessment.next_review_date,
      });
    }
  }

  // Repeated, objectively recorded misses are an amber coaching signal. There
  // is deliberately no invented adherence cut-off here: two consecutive misses
  // describe the record without pretending to be a clinical threshold.
  const adherenceByClient = new Map<string, CoachAlertAdherence[]>();
  for (const event of input.adherenceEvents) {
    if (!names.has(event.client_id) || event.outcome === "Excused") continue;
    const rows = adherenceByClient.get(event.client_id) ?? [];
    rows.push(event);
    adherenceByClient.set(event.client_id, rows);
  }
  for (const [clientId, rows] of adherenceByClient) {
    const recent = rows.sort((a, b) => b.event_date.localeCompare(a.event_date)).slice(0, 2);
    if (recent.length === 2 && recent.every((event) => event.outcome === "Missed")) {
      alerts.push({
        key: `adherence:${clientId}`,
        clientId,
        clientName: names.get(clientId)!,
        level: "amber",
        title: "Two agreed actions were missed in a row",
        detail: `Review the barrier before adding more actions · latest ${recent[0].event_date}`,
        actionLabel: "Review goals",
        href: `/clients/${clientId}?tab=overview#coaching-goals`,
        occurredOn: recent[0].event_date,
      });
    }
  }

  const sevenDaysAgo = recentStart(input.today, 7);
  for (const goal of input.goals) {
    if (goal.status !== "Completed" || goal.updated_at.slice(0, 10) < sevenDaysAgo || !names.has(goal.client_id)) continue;
    alerts.push({
      key: `goal-win:${goal.client_id}:${goal.name}`,
      clientId: goal.client_id,
      clientName: names.get(goal.client_id)!,
      level: "green",
      title: "Behaviour goal completed",
      detail: goal.name,
      actionLabel: "Open goals",
      href: `/clients/${goal.client_id}?tab=overview#coaching-goals`,
      occurredOn: goal.updated_at.slice(0, 10),
    });
  }
  for (const referral of input.referrals) {
    if (referral.status !== "Completed" || referral.updated_at.slice(0, 10) < sevenDaysAgo || !names.has(referral.client_id)) continue;
    alerts.push({
      key: `referral-win:${referral.id}`,
      clientId: referral.client_id,
      clientName: names.get(referral.client_id)!,
      level: "green",
      title: `${referral.destination_role} referral completed`,
      detail: referral.reason,
      actionLabel: "View outcome",
      href: `/clients/${referral.client_id}?tab=overview#care-coordination`,
      occurredOn: referral.updated_at.slice(0, 10),
    });
  }

  return alerts.sort((a, b) =>
    LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]
    || b.occurredOn.localeCompare(a.occurredOn)
    || a.clientName.localeCompare(b.clientName),
  );
}
