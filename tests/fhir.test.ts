import { describe, it, expect } from "vitest";
import { buildFhirBundle } from "@/lib/fhir";

const client = { id: "c-1", name: "Alex Mercer", gender: "Male", dob: "1990-01-01", phone: "12345", email: "a@b.co" };

describe("buildFhirBundle", () => {
  it("produces a Bundle with a Patient resource", () => {
    const b = buildFhirBundle(client, [], [], [], []);
    expect(b.resourceType).toBe("Bundle");
    expect(b.entry.length).toBe(1);
    const patient = (b.entry[0] as { resource: { resourceType: string; name: { family: string; given: string[] }[] } }).resource;
    expect(patient.resourceType).toBe("Patient");
    expect(patient.name[0].family).toBe("Mercer");
    expect(patient.name[0].given).toEqual(["Alex"]);
  });

  it("maps problems, allergies, meds and vitals to resources", () => {
    const b = buildFhirBundle(
      client,
      [{ id: "p1", description: "Hypertension", code: "I10", status: "active", onset_date: "2020-01-01" }],
      [{ id: "a1", substance: "Penicillin", reaction: "rash", severity: "severe" }],
      [{ id: "m1", name: "Amlodipine", dose: "5mg", frequency: "OD", status: "active" }],
      [{ id: "v1", date: "2026-07-17", systolic: 120, diastolic: 80, pulse: 70, temp_c: 36.6, spo2: 98, weight: 72 }],
    );
    const types = b.entry.map((e) => (e as { resource: { resourceType: string } }).resource.resourceType);
    expect(types).toContain("Condition");
    expect(types).toContain("AllergyIntolerance");
    expect(types).toContain("MedicationStatement");
    expect(types).toContain("Observation");
    expect(b.entry.length).toBe(5);
  });

  it("skips vitals with no measured components", () => {
    const b = buildFhirBundle(client, [], [], [], [{ id: "v2", date: "2026-07-17", systolic: null, diastolic: null, pulse: null, temp_c: null, spo2: null, weight: null }]);
    expect(b.entry.length).toBe(1); // Patient only
  });
});
