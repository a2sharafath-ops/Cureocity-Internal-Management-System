// Date-of-birth parsing and age.
//
// DOB is stored as free text because the intake kiosk collects it as DD/MM/YYYY
// (see /intake). `new Date("22/07/1988")` returns Invalid Date, because JS reads
// slash-separated dates as American MM/DD/YYYY — so every client born after the
// 12th of a month showed a blank age, and those born before it were silently
// parsed with the day and month swapped. Parse explicitly instead.

/** Parse DD/MM/YYYY, DD-MM-YYYY or ISO YYYY-MM-DD into a UTC date. */
export function parseDob(dob: string | null | undefined): Date | null {
  if (!dob || typeof dob !== "string") return null;
  const s = dob.trim();
  if (!s) return null;

  let y: number, m: number, d: number;

  const iso = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  const dmy = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);

  if (iso) {
    [, y, m, d] = iso.map(Number) as unknown as [unknown, number, number, number];
  } else if (dmy) {
    [, d, m, y] = dmy.map(Number) as unknown as [unknown, number, number, number];
  } else {
    return null;
  }

  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  // reject impossible dates that JS would roll over (31 Feb -> 3 Mar)
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return date;
}

/** Whole years since birth, counted on the calendar rather than by 365.25-day blocks. */
export function ageFromDob(dob: string | null | undefined, now: Date = new Date()): number | null {
  const b = parseDob(dob);
  if (!b) return null;

  let age = now.getUTCFullYear() - b.getUTCFullYear();
  const m = now.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < b.getUTCDate())) age--;

  if (age < 0 || age > 130) return null;
  return age;
}

/** ISO YYYY-MM-DD, for FHIR birthDate and anything else expecting a real date. */
export function dobToISO(dob: string | null | undefined): string | null {
  const d = parseDob(dob);
  return d ? d.toISOString().slice(0, 10) : null;
}
