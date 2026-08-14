import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import DietPlanBuilder from "../components/DietPlanBuilder";
import type { PlanMeal, PlanTargets } from "../lib/diet-plan";

const targets: PlanTargets = {
  kcal: 1800,
  carbohydrate: { min: null, max: null },
  protein: { min: null, max: null },
  fats: { min: null, max: null },
  fibre: { min: null, max: null },
  water: null,
};

const meals: PlanMeal[] = [
  {
    id: "meal-1", seq: 0, name: "Breakfast", time_from: "8:00 am", time_to: "8:30 am",
    note: null, conditional: false,
    options: [{
      id: "option-1", seq: 0, food_items: "Puttu and kadala", qty: "1 measured serving",
      kcal: 420, carb_g: 62, protein_g: 18, fat_g: 10, fibre_g: 9,
      micronutrients: "Iron, folate", components: [],
    }],
  },
  {
    id: "meal-2", seq: 1, name: "Lunch", time_from: "1:00 pm", time_to: "1:30 pm",
    note: null, conditional: false, options: [],
  },
];

describe("diet-plan builder hierarchy", () => {
  it("renders the prioritized workflow and collapses later meals by default", () => {
    const html = renderToStaticMarkup(React.createElement(DietPlanBuilder, {
      planId: "plan-1",
      clientName: "Test Client",
      status: "draft",
      version: 2,
      canReview: false,
      dishes: [],
      pdf: { ready: false, missing: [] },
      initial: {
        targets,
        meta: { allergies: null, notes: null, issued_on: "2026-08-10" },
        meals,
        sharedAt: null,
      },
    }));

    expect(html).toContain("Set the day&#x27;s targets");
    expect(html).toContain("Current day totals");
    expect(html).toContain("Review readiness");
    expect(html).toContain("Build the meal schedule");
    expect(html).toContain("1/4 options");
    expect(html).toContain("0/4 options");
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("Key micronutrients");
  });
});
