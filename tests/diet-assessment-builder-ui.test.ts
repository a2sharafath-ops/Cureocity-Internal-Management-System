import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import DietAssessmentBuilder from "../components/DietAssessmentBuilder";
import type { Assessment } from "../lib/diet-assessment";

const assessment: Assessment = {
  consulted_on: "2026-08-14",
  dietitian: "Afya",
  medical_history: null,
  existing_condition: "Pre-Diabetes",
  medications: [],
  allergies: null,
  family_history: null,
  occupation: "Engineer",
  daily_activity: null,
  exercise: [],
  sleep_hours: null,
  sleep_quality: null,
  stress_level: null,
  gut_health: null,
  weight_change: null,
  region: null,
  shift_pattern: null,
  outside_meals: null,
  diet_type: null,
  food_allergies: null,
  food_dislikes: null,
  supplements: null,
  height: 169,
  weight: 64,
  bmi: 22.4,
  bmr: 1576,
  tee: null,
  muscle_mass: 25.8,
  fat_mass: 17.9,
  body_fat: 28,
  visceral_fat: 10,
  waist_hip: null,
  primary_goals: "Fat loss and reverse Pre-Diabetes",
  target_weight: null,
  timeline_weeks: null,
  objectives: null,
  meal_frequency: null,
  meals_per_day: null,
  snacking: null,
  hydration: null,
  notes: null,
};

describe("diet-assessment builder hierarchy", () => {
  it("prioritizes readiness and presents the assessment as ordered collapsible steps", () => {
    const html = renderToStaticMarkup(React.createElement(DietAssessmentBuilder, {
      id: "assessment-1",
      clientId: "client-1",
      clientName: "Test Client",
      status: "draft",
      version: 1,
      canReview: false,
      sharedAt: null,
      initial: { ...assessment, dob: "1990-01-01", gender: "female", issued_on: "2026-08-14" },
      pdf: { ready: false, missing: [] },
    }));

    expect(html).toContain("Dietary assessment summary");
    expect(html).toContain("1 required check remaining");
    expect(html).toContain("Assessment workflow");
    expect(html).toContain("Consultation &amp; medical context");
    expect(html).toContain("Lifestyle &amp; activity");
    expect(html).toContain("Measurements &amp; energy");
    expect(html).toContain("Clinical notes");
    expect(html).toContain("Activity required");
    expect(html).toContain('open=""');
  });
});
