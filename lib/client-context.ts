import { isWakingSlot, type PlanMeal } from "@/lib/diet-plan";

/**
 * Three facts about a client that change the shape of a chart, and what the
 * brief asks be done about each.
 *
 * Sections 1, 6, 9 and 10 all turn on these, and until 0159 none of them was
 * written down anywhere. The Kerala default in particular was a habit: every
 * chart is written in Kerala dishes because that is what the clinic does, and a
 * client from Hyderabad was caught only if the dietitian remembered.
 *
 * WHAT THESE CHECKS CAN AND CANNOT DO
 *
 * They read a few unmistakable words and otherwise say plainly that somebody
 * should read the note. None of them judges whether a chart is culturally right
 * or whether a meal time suits a shift — those are the dietitian's, and a rule
 * pretending to make them would be confidently wrong on the interesting cases.
 *
 * All of them are reminders. Nothing here refuses a chart: a night-shift client
 * may well want an ordinary daytime chart because that is the routine they are
 * trying to get back to, and a rule that argued would be arguing with the plan.
 */

export type ClientContext = {
  region: string | null;
  shift_pattern: string | null;
  outside_meals: string | null;
};

export type ContextNote = { id: string; text: string };

/** Words that mean the working day is not an ordinary one. */
const UNUSUAL_SHIFT = /\bnight\b|\brotating\b|\brotational\b|\bshift\b|\bgraveyard\b|\bodd hours\b|\bon call\b/i;

/** Words that mean the client eats out often enough for section 10 to apply. */
const EATS_OUT = /\bdaily\b|\bevery day\b|\boften\b|\bfrequent|\bregular|\bweekly\b|\btwice\b|\bthrice\b|\b[2-9]\s*(times|x)\b/i;

/** Words that mean they do not, so section 10 can stay quiet. */
const RARELY_OUT = /\bnever\b|\brarely\b|\bseldom\b|\bhardly\b|\boccasional/i;

const KERALA = /\bkerala\b|\bmalayal/i;

/**
 * The reminders worth putting on a chart for this client.
 *
 * `meals` is read only for the shift check — the point is not that a night
 * worker needs different food but that a chart timed 8 am to 8:30 pm describes
 * a day they are asleep for.
 */
export function contextNotes(ctx: ClientContext, meals: PlanMeal[]): ContextNote[] {
  const out: ContextNote[] = [];

  // ---- section 9: the Kerala default ---------------------------------------
  const region = ctx.region?.trim();
  if (region && !KERALA.test(region)) {
    out.push({
      id: "region",
      text: `This client is from ${region}, not Kerala. The library and the meal slots both `
        + `default to Kerala cuisine, so the dish names on this chart are worth reading `
        + `once with that in mind — section 9 asks for options that are culturally aligned, `
        + `which is a judgement rather than something the app can check.`,
    });
  }

  // ---- sections 1 and 6: shift timing --------------------------------------
  const shift = ctx.shift_pattern?.trim();
  if (shift && UNUSUAL_SHIFT.test(shift)) {
    // Only worth saying if the chart is still on a daytime skeleton. A chart
    // already rearranged around the shift needs no reminder, and giving one
    // anyway is how a warning becomes wallpaper.
    const daytime = meals.some((m) => isWakingSlot(m.name) && /\b([6-9]|1[01])\s*[:.]?\d*\s*am\b/i.test(m.time_from ?? ""));
    if (daytime) {
      out.push({
        id: "shift",
        text: `Working hours are recorded as "${shift}". The slots on this chart still run to `
          + `an ordinary daytime routine, which describes hours this client may be asleep for. `
          + `Section 6 asks for the meal structure to follow the wake/sleep cycle.`,
      });
    }
  }

  // ---- section 10: restaurant and English meals ----------------------------
  const out_ = ctx.outside_meals?.trim();
  if (out_ && EATS_OUT.test(out_) && !RARELY_OUT.test(out_)) {
    out.push({
      id: "outside",
      text: `Eating out is recorded as "${out_}". Section 10 asks for restaurant or `
        + `English-style options to be included at matching calories, rather than left off `
        + `for the client to improvise — portion distortion is the usual reason a chart `
        + `stops working.`,
    });
  }

  return out;
}
