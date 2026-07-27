// The WHOLE journey for a client's primary active package — not just onboarding.
// Turns aggregated signals into an ordered checklist covering the full lifecycle
// (blood → consults → deliverables → consolidated → sessions → calendar
// milestones), so the Journey dots reflect everything the package entails.

import { milestoneDates, cyclesFor } from "@/lib/comprehensive";

export type JStep = { label: string; done: boolean };

export type JourneySignals = {
  category: string;
  bloodRequested: boolean;
  bloodReceived: boolean;          // for the package's own panel
  doctorDone: boolean; dietDone: boolean; trainerDone: boolean;
  hasChart: boolean; dietExplained: boolean; hasWorkout: boolean; consolidated: boolean;
  blueprintGenerated: boolean;
  sessionsTotal: number; sessionsDone: number; sessionScheduled: boolean;
  startDate: string | null; endDate: string | null;
  appts: { type: string | null; date: string | null; status: string }[];
  today: string;
};

const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

export function buildFullJourney(s: JourneySignals): JStep[] {
  const sessTotal = s.sessionsTotal || 12;
  const sessDone = s.sessionsTotal > 0 && s.sessionsDone >= s.sessionsTotal;

  switch (s.category) {
    case "comprehensive": {
      const steps: JStep[] = [
        { label: "Blood panel requested", done: s.bloodRequested },
        { label: "Blood report received", done: s.bloodReceived },
        { label: "Doctor consultation", done: s.doctorDone },
        { label: "Diet consultation", done: s.dietDone },
        { label: "Fitness assessment", done: s.trainerDone },
        { label: "Diet chart drafted", done: s.hasChart },
        { label: "Diet chart explanation (Day 2)", done: s.dietExplained },
        { label: "Workout plan created", done: s.hasWorkout },
        { label: "Consolidated summary approved", done: s.consolidated },
        { label: `Strength sessions ${s.sessionsDone}/${sessTotal}`, done: sessDone },
      ];
      if (s.startDate) {
        const span = s.endDate ? Math.max(28, daysBetween(s.startDate, s.endDate)) : 28;
        for (const m of milestoneDates(s.startDate, cyclesFor(span))) {
          const done = s.appts.some((a) => a.type === m.apptType && a.date && a.date >= m.fromDate && (a.status === "completed" || a.status === "scheduled"));
          steps.push({ label: m.label, done });
        }
      }
      return steps;
    }
    case "training":
      return [
        { label: "Fitness assessment", done: s.trainerDone },
        { label: "Workout plan created", done: s.hasWorkout },
        { label: "Sessions scheduled", done: s.sessionScheduled },
        { label: `Strength sessions ${s.sessionsDone}/${sessTotal}`, done: sessDone },
      ];
    case "blueprint":
      return [
        { label: "Blood panel requested", done: s.bloodRequested },
        { label: "Blood report received", done: s.bloodReceived },
        { label: "Doctor consultation", done: s.doctorDone },
        { label: "Diet consultation", done: s.dietDone },
        { label: "Fitness assessment", done: s.trainerDone },
        { label: "BluePrint generated", done: s.blueprintGenerated },
      ];
    case "membership":
      return [{ label: "Membership active", done: true }];
    default:
      return [];
  }
}
