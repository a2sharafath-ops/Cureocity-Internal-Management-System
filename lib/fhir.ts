// Minimal FHIR R4 Bundle builder — converts a patient's EMR into an
// interoperability-friendly document. Not a certified FHIR server; it produces
// a standards-shaped Bundle suitable for export / downstream ingestion.

type Client = { id: string; name: string; gender: string | null; dob: string | null; phone: string | null; email: string | null };
type Problem = { id: string; description: string; code: string | null; status: string; onset_date: string | null };
type Allergy = { id: string; substance: string; reaction: string | null; severity: string };
type Med = { id: string; name: string; dose: string | null; frequency: string | null; status: string };
type Vital = { id: string; date: string; systolic: number | null; diastolic: number | null; pulse: number | null; temp_c: number | null; spo2: number | null; weight: number | null };

function nameParts(full: string) {
  const parts = full.trim().split(/\s+/);
  const family = parts.length > 1 ? parts[parts.length - 1] : "";
  const given = parts.length > 1 ? parts.slice(0, -1) : parts;
  return { family, given };
}

export function buildFhirBundle(
  client: Client,
  problems: Problem[],
  allergies: Allergy[],
  meds: Med[],
  vitals: Vital[],
) {
  const patientRef = `Patient/${client.id}`;
  const { family, given } = nameParts(client.name);
  const entries: unknown[] = [];

  entries.push({
    resource: {
      resourceType: "Patient",
      id: client.id,
      name: [{ use: "official", family, given }],
      gender: (client.gender ?? "unknown").toLowerCase(),
      birthDate: client.dob ?? undefined,
      telecom: [
        client.phone ? { system: "phone", value: client.phone } : null,
        client.email ? { system: "email", value: client.email } : null,
      ].filter(Boolean),
    },
  });

  for (const p of problems) {
    entries.push({
      resource: {
        resourceType: "Condition",
        id: p.id,
        clinicalStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-clinical", code: p.status === "resolved" ? "resolved" : "active" }] },
        code: { text: p.description, coding: p.code ? [{ system: "http://hl7.org/fhir/sid/icd-10", code: p.code, display: p.description }] : undefined },
        subject: { reference: patientRef },
        onsetDateTime: p.onset_date ?? undefined,
      },
    });
  }

  for (const a of allergies) {
    entries.push({
      resource: {
        resourceType: "AllergyIntolerance",
        id: a.id,
        criticality: a.severity === "severe" ? "high" : a.severity === "mild" ? "low" : undefined,
        code: { text: a.substance },
        patient: { reference: patientRef },
        reaction: a.reaction ? [{ manifestation: [{ text: a.reaction }] }] : undefined,
      },
    });
  }

  for (const m of meds) {
    entries.push({
      resource: {
        resourceType: "MedicationStatement",
        id: m.id,
        status: m.status === "stopped" ? "stopped" : "active",
        medicationCodeableConcept: { text: m.name },
        subject: { reference: patientRef },
        dosage: (m.dose || m.frequency) ? [{ text: [m.dose, m.frequency].filter(Boolean).join(" ") }] : undefined,
      },
    });
  }

  for (const v of vitals) {
    const comps: unknown[] = [];
    if (v.systolic != null) comps.push({ code: { text: "Systolic BP" }, valueQuantity: { value: v.systolic, unit: "mmHg" } });
    if (v.diastolic != null) comps.push({ code: { text: "Diastolic BP" }, valueQuantity: { value: v.diastolic, unit: "mmHg" } });
    if (v.pulse != null) comps.push({ code: { text: "Heart rate" }, valueQuantity: { value: v.pulse, unit: "bpm" } });
    if (v.temp_c != null) comps.push({ code: { text: "Body temperature" }, valueQuantity: { value: v.temp_c, unit: "Cel" } });
    if (v.spo2 != null) comps.push({ code: { text: "SpO2" }, valueQuantity: { value: v.spo2, unit: "%" } });
    if (v.weight != null) comps.push({ code: { text: "Body weight" }, valueQuantity: { value: v.weight, unit: "kg" } });
    if (comps.length === 0) continue;
    entries.push({
      resource: {
        resourceType: "Observation",
        id: v.id,
        status: "final",
        category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "vital-signs" }] }],
        code: { text: "Vital signs panel" },
        subject: { reference: patientRef },
        effectiveDateTime: v.date,
        component: comps,
      },
    });
  }

  return {
    resourceType: "Bundle",
    type: "collection",
    timestamp: new Date().toISOString(),
    entry: entries,
  };
}
