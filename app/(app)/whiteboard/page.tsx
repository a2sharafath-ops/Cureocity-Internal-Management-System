import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canSee, canConsult, isClinician } from "@/lib/roles";
import { todayISO } from "@/lib/today";
import { ageFromDob } from "@/lib/dob";
import { boardCandidates, boardProgress, effectiveScores, type ScoreTweaks, type CandidateInput } from "@/lib/whiteboard";
import type { BpScores } from "@/lib/blueprint";
import { openWhiteboard, closeWhiteboard, addWhiteboardCard } from "@/lib/actions";
import WhiteboardCard, { type CardData } from "@/components/WhiteboardCard";
import BackLink from "@/components/BackLink";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import { RingMeter } from "@/components/Meters";

export const dynamic = "force-dynamic";

const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
const btn: React.CSSProperties = { border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "7px 13px", fontSize: 13, fontWeight: 600, cursor: "pointer" };

export default async function WhiteboardPage() {
  const me = await getProfile();
  if (!me || !canSee(me.role, "/whiteboard")) redirect("/dashboard");

  const supabase = createClient();
  const today = todayISO();
  const branch = me.branch ?? "Kochi";

  const { data: sessionRow } = await supabase
    .from("whiteboard_sessions").select("*").eq("date", today).eq("branch", branch).maybeSingle();
  const session = sessionRow as { id: string; date: string; branch: string | null; status: string; facilitator: string | null } | null;

  // ---- everything the board reads (the same dataset BluePrint uses) --------
  const [
    { data: clientData }, { data: bpData }, { data: bloodData }, { data: sessData },
    { data: concernData }, { data: fuData }, { data: measureData }, { data: staffData },
    { data: cardData }, { data: pastCardData },
  ] = await Promise.all([
    supabase.from("clients").select("id, code, name, dob, gender, package_id, conditions, goals"),
    supabase.from("blueprints").select("client_id, scores, generated"),
    supabase.from("blood_requests").select("client_id, submitted"),
    supabase.from("sessions").select("client_id, status, date"),
    supabase.from("concerns").select("client_id, status, body, role"),
    supabase.from("followups").select("client_id, status, due_date"),
    supabase.from("measurements").select("client_id, weight, body_fat, bmi, date").order("date", { ascending: false }),
    supabase.from("staff").select("id, name, role").in("role", ["Doctor", "Dietitian", "Fitness Trainer", "Health Coach", "Psychologist"]),
    session ? supabase.from("whiteboard_cards").select("*").eq("session_id", session.id).order("position") : Promise.resolve({ data: [] }),
    supabase.from("whiteboard_cards").select("client_id, session_id, whiteboard_sessions(date)").order("created_at", { ascending: false }).limit(400),
  ]);

  const clients = (clientData ?? []) as { id: string; code: string | null; name: string; dob: string | null; gender: string | null; package_id: string | null; conditions: string | null; goals: string[] | null }[];
  const bps = new Map(((bpData ?? []) as { client_id: string; scores: BpScores | null; generated: boolean }[]).map((b) => [b.client_id, b]));
  const bloods = new Map(((bloodData ?? []) as { client_id: string; submitted: boolean }[]).map((b) => [b.client_id, b]));
  const sessions = (sessData ?? []) as { client_id: string; status: string; date: string }[];
  const concerns = (concernData ?? []) as { client_id: string; status: string; body: string; role: string }[];
  const followups = (fuData ?? []) as { client_id: string; status: string; due_date: string }[];
  const measurements = (measureData ?? []) as { client_id: string; weight: number | null; body_fat: number | null; bmi: number | null; date: string | null }[];
  const staff = (staffData ?? []) as { id: string; name: string; role: string }[];
  const cards = (cardData ?? []) as { id: string; client_id: string; reason: string | null; origin: string; status: string; headline: string | null; score_tweaks: ScoreTweaks }[];

  // when each client was last on a board
  const lastDiscussed = new Map<string, string>();
  for (const r of (pastCardData ?? []) as unknown as { client_id: string; whiteboard_sessions: { date: string } | null }[]) {
    const d = r.whiteboard_sessions?.date;
    if (d && (!lastDiscussed.has(r.client_id) || d > lastDiscussed.get(r.client_id)!)) lastDiscussed.set(r.client_id, d);
  }

  // ---- who should the team look at today ----------------------------------
  const inputs: CandidateInput[] = clients.map((c) => {
    const mine = sessions.filter((s) => s.client_id === c.id);
    const done = mine.filter((s) => s.status === "completed").map((s) => s.date).sort();
    return {
      id: c.id, name: c.name,
      scores: bps.get(c.id)?.scores ?? null,
      bloodSubmitted: Boolean(bloods.get(c.id)?.submitted),
      blueprintGenerated: Boolean(bps.get(c.id)?.generated),
      lastSession: done.length ? done[done.length - 1] : null,
      upcoming: mine.filter((s) => s.status === "scheduled" && s.date >= today).length,
      openConcerns: concerns.filter((x) => x.client_id === c.id && x.status === "Open").length,
      overdueFollowups: followups.filter((f) => f.client_id === c.id && f.status === "pending" && f.due_date < today).length,
      lastDiscussed: lastDiscussed.get(c.id) ?? null,
    };
  });
  const onBoard = new Set(cards.map((c) => c.client_id));
  const suggestions = boardCandidates(inputs, today).filter((s) => !onBoard.has(s.id)).slice(0, 6);

  // ---- build the cards -----------------------------------------------------
  const notesByCard = new Map<string, CardData["notes"]>();
  if (cards.length) {
    const { data: noteData } = await supabase
      .from("whiteboard_notes").select("*").in("card_id", cards.map((c) => c.id)).order("created_at");
    for (const n of (noteData ?? []) as CardData["notes"] & { card_id: string }[]) {
      const arr = notesByCard.get((n as unknown as { card_id: string }).card_id) ?? [];
      arr.push(n);
      notesByCard.set((n as unknown as { card_id: string }).card_id, arr);
    }
  }

  const built: CardData[] = cards.map((card) => {
    const c = clients.find((x) => x.id === card.client_id);
    const bp = bps.get(card.client_id);
    const mine = sessions.filter((s) => s.client_id === card.client_id);
    const doneDates = mine.filter((s) => s.status === "completed").map((s) => s.date).sort();
    const m = measurements.find((x) => x.client_id === card.client_id);
    const openConcerns = concerns.filter((x) => x.client_id === card.client_id && x.status === "Open");

    return {
      id: card.id,
      clientId: card.client_id,
      name: c?.name ?? "—",
      code: c?.code ?? null,
      age: ageFromDob(c?.dob ?? null),
      reason: card.reason,
      origin: card.origin,
      status: card.status,
      headline: card.headline,
      tweaks: card.score_tweaks ?? {},
      scores: effectiveScores(bp?.scores ?? null, card.score_tweaks ?? {}),
      notes: notesByCard.get(card.id) ?? [],
      blueprintGenerated: Boolean(bp?.generated),
      facts: [
        { label: "Sessions done", value: String(doneDates.length) },
        { label: "Last session", value: doneDates.length ? doneDates[doneDates.length - 1] : "—" },
        { label: "Upcoming", value: String(mine.filter((s) => s.status === "scheduled" && s.date >= today).length) },
        { label: "Open concerns", value: String(openConcerns.length) },
        { label: "Weight", value: m?.weight != null ? `${m.weight} kg` : "—" },
        { label: "Body fat", value: m?.body_fat != null ? `${m.body_fat}%` : "—" },
        { label: "BMI", value: m?.bmi != null ? String(m.bmi) : "—" },
        { label: "Conditions", value: c?.conditions || "None recorded" },
        { label: "Goals", value: (c?.goals ?? []).join(", ") || "—" },
      ],
    };
  });

  const progress = boardProgress(cards);
  const locked = session?.status === "closed" || !canConsult(me.role);

  return (
    <div style={{ maxWidth: 1180 }}>
      <RealtimeRefresh tables={["whiteboard_cards", "whiteboard_notes", "whiteboard_sessions"]} />
      {/* clinicians arrive from their workspace; everyone else from Care Team */}
      {isClinician(me.role)
        ? <BackLink href="/workspace" label="my Workspace" />
        : <BackLink />}
      <h1 style={{ fontSize: 20, margin: "0 0 4px" }}>Whiteboard</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 18px" }}>
        Daily team meeting — the same client data BluePrint reads, reviewed together and turned into today&apos;s actions.
      </p>

      {!session ? (
        <div style={{ ...box, padding: "26px 22px", textAlign: "center" }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>No board open for today</div>
          <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 14 }}>
            {suggestions.length
              ? `${suggestions.length} client${suggestions.length === 1 ? "" : "s"} look like they need discussing.`
              : "Nothing is flagged — you can still open a board and add clients by hand."}
          </div>
          <form action={openWhiteboard}>
            <input type="hidden" name="branch" value={branch} />
            <button type="submit" style={{ ...btn, background: "var(--ink)", color: "#fff", border: "none", padding: "10px 18px" }}>
              Open today&apos;s board
            </button>
          </form>
        </div>
      ) : (
        <>
          {/* board header */}
          <div style={{ ...box, padding: "14px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 16 }}>
            <RingMeter value={progress.pct} size={58} stroke={7} centerText={`${progress.done}/${progress.total}`} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700 }}>
                {new Date(today + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}
                {session.status === "closed" && <span style={{ marginLeft: 8, background: "var(--neutral-bg)", color: "var(--muted)", borderRadius: 999, padding: "1px 9px", fontSize: 11, fontWeight: 700 }}>Closed</span>}
              </div>
              <div style={{ color: "var(--muted)", fontSize: 12.5 }}>
                {branch}{session.facilitator ? ` · led by ${session.facilitator}` : ""} · {progress.total} client{progress.total === 1 ? "" : "s"} on the board
              </div>
            </div>
            {session.status === "open" && canConsult(me.role) && (
              <form action={closeWhiteboard}>
                <input type="hidden" name="session_id" value={session.id} />
                <button type="submit" style={btn}>Close board</button>
              </form>
            )}
          </div>

          {/* suggestions */}
          {!locked && suggestions.length > 0 && (
            <div style={{ ...box, padding: "14px 16px", marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Suggested for discussion</div>
              {suggestions.map((s) => (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderTop: "1px solid var(--border)", fontSize: 12.5 }}>
                  <b style={{ minWidth: 130 }}>{s.name}</b>
                  <span style={{ flex: 1, color: "var(--muted)", minWidth: 0 }}>{s.reason}</span>
                  <form action={addWhiteboardCard}>
                    <input type="hidden" name="session_id" value={session.id} />
                    <input type="hidden" name="client_id" value={s.id} />
                    <input type="hidden" name="reason" value={s.reason} />
                    <input type="hidden" name="origin" value="flagged" />
                    <button type="submit" style={{ ...btn, padding: "4px 10px", fontSize: 12 }}>Add to board</button>
                  </form>
                </div>
              ))}
            </div>
          )}

          {/* the board */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
            {built.length ? built.map((c) => (
              <WhiteboardCard key={c.id} card={c} staff={staff} locked={locked} />
            )) : (
              <div style={{ ...box, padding: "22px 16px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
                Nothing on the board yet — add a client from the suggestions above, or pick one below.
              </div>
            )}
          </div>

          {/* add anyone by hand */}
          {!locked && (
            <div style={{ ...box, padding: "14px 16px" }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Add a client</div>
              <form action={addWhiteboardCard} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input type="hidden" name="session_id" value={session.id} />
                <select name="client_id" required defaultValue="" style={{ padding: "7px 9px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, background: "#fff", minWidth: 200 }}>
                  <option value="" disabled>— choose a client —</option>
                  {clients.filter((c) => !onBoard.has(c.id)).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}{c.code ? ` · ${c.code}` : ""}</option>
                  ))}
                </select>
                <input name="reason" placeholder="Why are we discussing them?" style={{ padding: "7px 9px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, background: "#fff", flex: 1, minWidth: 200 }} />
                <button type="submit" style={{ ...btn, background: "var(--ink)", color: "#fff", border: "none" }}>Add</button>
              </form>
            </div>
          )}
        </>
      )}

      <div style={{ marginTop: 16, fontSize: 12, color: "var(--muted)" }}>
        Adjustments made here are a dated working record. The signed-off <Link href="/blueprint" style={{ color: "var(--brand-text)" }}>BluePrint</Link> document is never overwritten.
      </div>
    </div>
  );
}
