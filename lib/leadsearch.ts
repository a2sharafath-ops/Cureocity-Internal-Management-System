// Matching a lead by what the front desk actually types.
//
// Two very different inputs land in the same box. A name is a loose substring
// match. A phone number is not: the same number is written a dozen ways —
// "+91 98471 23456", "098471-23456", "9847123456" — and the caller ID the FDE
// is reading off a handset rarely matches the format stored on the row. So
// phones are compared as digits only, and on the last 10 of them, which is the
// part that actually identifies an Indian subscriber.

export type Searchable = {
  name: string;
  phone: string | null;
};

const digits = (s: string) => s.replace(/\D+/g, "");

/** Last 10 digits — drops +91, 0-prefixes and any punctuation. */
export function phoneKey(s: string | null | undefined): string {
  const d = digits(String(s ?? ""));
  return d.length > 10 ? d.slice(-10) : d;
}

/**
 * True when the query looks like someone typing a phone number rather than a
 * name. Deliberately requires 3+ digits: a single stray digit in "Anu 2" would
 * otherwise flip the whole query into phone mode and match nothing.
 */
export function looksNumeric(q: string): boolean {
  return digits(q).length >= 3 && !/[a-z]/i.test(q);
}

export function matchesLeadQuery(lead: Searchable, query: string): boolean {
  const q = query.trim();
  if (!q) return true;

  if (looksNumeric(q)) {
    const needle = phoneKey(q);
    if (!needle) return false;
    // Substring, not equality — the FDE often has only the last 4 or 5 digits
    // from a missed call.
    return phoneKey(lead.phone).includes(needle);
  }

  const needle = q.toLowerCase();
  // A name query still checks the phone, so a pasted "+91-98471 23456" that
  // trips the letter test (it can't) or a mixed query still finds the row.
  return (
    lead.name.toLowerCase().includes(needle) ||
    (lead.phone ?? "").toLowerCase().includes(needle)
  );
}
