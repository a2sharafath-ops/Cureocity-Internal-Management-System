// The five disciplines, named once. Every badge, dropdown and printed report
// reads from here — previously five files each kept their own map and they
// disagreed, so a Health Coach saw "Health Coach" on the whiteboard and "Coach"
// on their own sign-off badge.
//
// Keys cover every spelling actually in use across the app: lowercase
// workspace/assignment keys (doctor/diet/trainer/coach/psych), their
// capitalised consultation-"kind" siblings (Doctor/Diet/Trainer/Coach/
// Psychologist), and the longer aliases a couple of files used in place of
// "diet"/"psych" (dietitian/psychologist). None of these are database values
// being changed — only what gets displayed.
export const DISCIPLINE_LABEL: Record<string, string> = {
  doctor: "Doctor",
  Doctor: "Doctor",
  diet: "Dietitian",
  Diet: "Dietitian",
  dietitian: "Dietitian",
  trainer: "Fitness Trainer",
  Trainer: "Fitness Trainer",
  coach: "Health Coach",
  Coach: "Health Coach",
  psych: "Psychologist",
  psychologist: "Psychologist",
  Psychologist: "Psychologist",
};

export function disciplineLabel(kind: string): string {
  return DISCIPLINE_LABEL[kind] ?? kind;
}

/** The five canonical discipline keys, in the order a client meets them.
 *  Use this when you need to VALIDATE a key; use disciplineLabel() to show it. */
export const DISCIPLINES = ["doctor", "dietitian", "trainer", "coach", "psychologist"] as const;
