import { describe, it, expect } from "vitest";
import { leadScore, leadProduct } from "@/lib/leadscore";

describe("leadScore", () => {
  it("returns null for a lead with no signals", () => {
    expect(leadScore({}).total).toBeNull();
    expect(leadScore({}).tier).toBeNull();
  });

  it("sums the 7 signal weights and buckets HOT", () => {
    const r = leadScore({
      interest: "Personal Training", urgency: "Strong - wants to start now", history: "Had PT before",
      goals: "Specific weight loss target", location: "Within 3 km (Panampally/Kadavanthra)",
      budget: "Doesnt ask price first - quality focused", profession: "Doctor/Medical",
    });
    expect(r.total).toBe(25 + 20 + 15 + 15 + 10 + 10 + 5); // 100
    expect(r.tier).toBe("HOT");
  });

  it("buckets a low-signal lead COLD", () => {
    const r = leadScore({ interest: "Not Sure", urgency: "No clear urgency", history: "Complete beginner", goals: "No specific goal" });
    expect(r.total).toBe(5 + 3 + 3 + 3); // 14
    expect(r.tier).toBe("COLD");
  });

  it("ignores unknown option values", () => {
    expect(leadScore({ interest: "Personal Training", urgency: "made up" }).total).toBe(25);
  });
});

describe("leadProduct", () => {
  it("maps interest & goals to a best-fit product", () => {
    expect(leadProduct({ interest: "Full Package (Medical+Diet+PT)" })).toBe("Complete Fitness Plan");
    expect(leadProduct({ interest: "Gym/Fitness", goals: "Manage health condition (diabetes/BP etc)" })).toBe("Complete Fitness Plan");
    expect(leadProduct({ interest: "Personal Training" })).toBe("Personal Training");
    expect(leadProduct({ interest: "Diet/Nutrition" })).toBe("Diet Plan + App");
    expect(leadProduct({})).toBe("—");
  });
});
