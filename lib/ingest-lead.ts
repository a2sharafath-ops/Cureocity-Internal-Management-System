// The single door every externally-captured lead comes through.
//
// Deliberately one function rather than logic inside the website route, because
// Instagram lead ads, WhatsApp and CSV import are all meant to land here next.
// If each source did its own insert, they would drift: one would forget to
// dedupe, another would skip scoring, a third would leave the lead unowned —
// and the one that forgets is the one that matters.
//
// Everything a lead needs to be workable happens here, once:
//   dedupe by phone · score · assign an owner · first-response task
//
// Note this is NOT a "use server" file and must not become one — it is called
// from a route handler, not a form action.

import { leadScore } from "@/lib/leadscore";
import { todayISO } from "@/lib/today";

type Sb = { from: (t: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any

/** Digits only, last 10 — so "+91 85900 59059" and "8590059059" are one person. */
export function normalisePhone(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  return digits.slice(-10);
}

export type IngestInput = {
  name: string;
  phone?: string | null;
  email?: string | null;
  /** where it came from — "Website", "Instagram", "WhatsApp" */
  source: string;
  campaign?: string | null;
  interest?: string | null;
  goals?: string | null;
  location?: string | null;
  notes?: string | null;
};

export type IngestResult =
  | { status: "created"; leadId: string; num: number }
  | { status: "duplicate"; leadId: string; reason: string }
  | { status: "rejected"; reason: string };

/** Fields a caller may set. Anything else in the payload is ignored, so a
 *  malicious body cannot write `stage`, `score` or `owner_id` directly. */
const ALLOWED = ["name", "phone", "email", "source", "campaign", "interest", "goals", "location", "notes"] as const;

export function validate(input: Partial<IngestInput>): { ok: true; value: IngestInput } | { ok: false; reason: string } {
  const name = String(input.name ?? "").trim();
  if (!name) return { ok: false, reason: "name is required" };
  if (name.length > 120) return { ok: false, reason: "name too long" };

  const phone = String(input.phone ?? "").trim();
  const email = String(input.email ?? "").trim();
  // One contactable channel, or the lead is unworkable and shouldn't be stored.
  if (!phone && !email) return { ok: false, reason: "phone or email is required" };
  if (phone && !normalisePhone(phone)) return { ok: false, reason: "phone must have at least 10 digits" };
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, reason: "email is not valid" };

  const clip = (v: unknown, n: number) => {
    const s = String(v ?? "").trim();
    return s ? s.slice(0, n) : null;
  };

  return {
    ok: true,
    value: {
      name: name.slice(0, 120),
      phone: phone || null,
      email: email || null,
      source: clip(input.source, 40) ?? "Website",
      campaign: clip(input.campaign, 80),
      interest: clip(input.interest, 60),
      goals: clip(input.goals, 200),
      location: clip(input.location, 80),
      notes: clip(input.notes, 1000),
    },
  };
}

/**
 * Insert a lead from an external source.
 *
 * `ownerId` is who to assign it to. A public form has no acting user, so the
 * caller supplies a default owner — otherwise the lead arrives unowned and is
 * invisible to every alert we built, which is the exact failure mode the
 * ownership work was for.
 */
export async function ingestLead(
  supabase: Sb,
  input: IngestInput,
  opts: { ownerId: string | null; dedupeWindowDays?: number },
): Promise<IngestResult> {
  const phone10 = normalisePhone(input.phone);

  // ---- dedupe --------------------------------------------------------------
  // A public form gets double-submitted, and ad platforms retry webhooks. Both
  // produce the same person twice. Matching on the last 10 digits catches the
  // same number written five different ways.
  if (phone10) {
    // Stored phones are inconsistent — "+91 85900 59059", "8590059059",
    // "085900 59059" are all the same person. A substring search on the full
    // number fails whenever a space falls inside it, so narrow on the last four
    // digits (contiguous in every format seen) and confirm in JS by comparing
    // fully normalised values. Cheap, and formatting-proof.
    const tail = phone10.slice(-4);
    const { data: existing } = await supabase
      .from("leads")
      .select("id, phone, created_at")
      .ilike("phone", `%${tail}%`)
      .limit(50);

    const rows = (existing ?? []) as { id: string; phone: string | null; created_at: string | null }[];
    const match = rows.find((r) => normalisePhone(r.phone) === phone10);
    if (match) {
      const windowDays = opts.dedupeWindowDays ?? 30;
      const age = match.created_at
        ? Math.floor((Date.now() - Date.parse(match.created_at)) / 86_400_000)
        : 0;
      // An enquiry from someone who asked six months ago is a genuinely new
      // enquiry, not a duplicate — they came back, which is a strong signal.
      if (age <= windowDays) {
        return { status: "duplicate", leadId: match.id, reason: `same phone within ${windowDays} days` };
      }
    }
  }

  // ---- create --------------------------------------------------------------
  const { data: last } = await supabase
    .from("leads").select("num").order("num", { ascending: false }).limit(1).maybeSingle();
  const num = (((last as { num: number } | null)?.num) ?? 0) + 1;

  const row: Record<string, unknown> = { num };
  for (const f of ALLOWED) row[f] = (input as Record<string, unknown>)[f] ?? null;
  row.stage = "1-New Lead";

  const scored = leadScore(row as Parameters<typeof leadScore>[0]);
  row.score = scored.total;
  row.tier = scored.tier;
  row.scored_at = new Date().toISOString();

  if (opts.ownerId) {
    row.owner_id = opts.ownerId;
    row.owner_method = "rule";
    row.owner_assigned_at = new Date().toISOString();
  }

  const { data: created, error } = await supabase.from("leads").insert(row).select("id").maybeSingle();
  if (error || !created) return { status: "rejected", reason: "insert failed" };
  const leadId = (created as { id: string }).id;

  // ---- first response ------------------------------------------------------
  // Same promise the in-app form makes: somebody owns this and owes a call.
  if (opts.ownerId) {
    await supabase.from("tasks").insert({
      title: `Call ${input.name} — new ${input.source.toLowerCase()} lead`,
      assignee_id: opts.ownerId,
      lead_id: leadId,
      type: "Follow-up",
      priority: "High",
      status: "todo",
      due_date: todayISO(),
      created_by: "auto",
    });
  }

  return { status: "created", leadId, num };
}
