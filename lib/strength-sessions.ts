export type StrengthSessionRow = {
  client_id: string;
  trainer_id: string;
  seq: number;
  date: string;
  hour: number;
  status: "scheduled";
};

const COHORT_DAYS = {
  monday: [1, 3, 5],
  tuesday: [2, 4, 6],
} as const;

/** Builds 12 one-hour sessions in the client's Monday/Wednesday/Friday or Tuesday/Thursday/Saturday cohort. */
export function buildStrengthSessions(clientId: string, trainerId: string, hour: number, startISO: string, count: number): StrengthSessionRow[] {
  const date = new Date(`${startISO}T00:00:00Z`);
  const startDay = date.getUTCDay();
  if (startDay === 0) throw new Error("Strength sessions are not available on Sunday.");
  const cohort = startDay % 2 === 1 ? COHORT_DAYS.monday : COHORT_DAYS.tuesday;
  const rows: StrengthSessionRow[] = [];
  while (rows.length < count) {
    if (cohort.includes(date.getUTCDay() as 1 | 2 | 3 | 4 | 5 | 6)) {
      rows.push({ client_id: clientId, trainer_id: trainerId, seq: rows.length + 1, date: date.toISOString().slice(0, 10), hour, status: "scheduled" });
    }
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return rows;
}
