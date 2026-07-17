// Lightweight prescribing decision-support data. Not a substitute for a real
// drug database — a curated demonstration set of common, well-known interactions
// and drug-class hints. Matching is case-insensitive substring on generic names.

export type Interaction = { a: string; b: string; severity: "severe" | "moderate"; note: string };

export const INTERACTIONS: Interaction[] = [
  { a: "warfarin", b: "aspirin",      severity: "severe",   note: "Greatly increased bleeding risk." },
  { a: "warfarin", b: "ibuprofen",    severity: "severe",   note: "Increased bleeding risk (NSAID + anticoagulant)." },
  { a: "warfarin", b: "naproxen",     severity: "severe",   note: "Increased bleeding risk (NSAID + anticoagulant)." },
  { a: "warfarin", b: "amiodarone",   severity: "severe",   note: "Amiodarone potentiates warfarin — monitor INR." },
  { a: "warfarin", b: "fluconazole",  severity: "moderate", note: "Raises INR — bleeding risk." },
  { a: "clopidogrel", b: "omeprazole",severity: "moderate", note: "Omeprazole reduces clopidogrel activation." },
  { a: "simvastatin", b: "clarithromycin", severity: "severe", note: "Myopathy / rhabdomyolysis risk." },
  { a: "simvastatin", b: "amlodipine", severity: "moderate", note: "Limit simvastatin to 20 mg with amlodipine." },
  { a: "atorvastatin", b: "clarithromycin", severity: "moderate", note: "Increased statin levels — myopathy risk." },
  { a: "metformin", b: "contrast",    severity: "moderate", note: "Hold around iodinated contrast (lactic acidosis)." },
  { a: "lisinopril", b: "spironolactone", severity: "moderate", note: "Hyperkalemia risk — monitor potassium." },
  { a: "lisinopril", b: "potassium",  severity: "moderate", note: "Hyperkalemia risk." },
  { a: "ibuprofen", b: "lisinopril",  severity: "moderate", note: "NSAIDs blunt ACE-inhibitor effect; renal risk." },
  { a: "tramadol", b: "sertraline",   severity: "severe",   note: "Serotonin syndrome risk." },
  { a: "tramadol", b: "fluoxetine",   severity: "severe",   note: "Serotonin syndrome risk." },
  { a: "sertraline", b: "fluoxetine", severity: "severe",   note: "Additive serotonergic effect." },
  { a: "methotrexate", b: "trimethoprim", severity: "severe", note: "Bone-marrow suppression risk." },
  { a: "digoxin", b: "amiodarone",    severity: "moderate", note: "Amiodarone raises digoxin levels." },
  { a: "ciprofloxacin", b: "tizanidine", severity: "severe", note: "Markedly increased tizanidine levels." },
  { a: "azithromycin", b: "amiodarone", severity: "severe", note: "Additive QT prolongation." },
];

const norm = (s: string) => s.toLowerCase();

export type Flag = { severity: "severe" | "moderate"; text: string };

/** Screen a list of drug names against each other for known interactions. */
export function screenInteractions(drugs: string[]): Flag[] {
  const names = drugs.map(norm).filter(Boolean);
  const flags: Flag[] = [];
  for (const it of INTERACTIONS) {
    const hasA = names.some((n) => n.includes(it.a));
    const hasB = names.some((n) => n.includes(it.b));
    if (hasA && hasB) flags.push({ severity: it.severity, text: `${cap(it.a)} + ${cap(it.b)}: ${it.note}` });
  }
  return flags;
}

/** Screen drugs against the patient's recorded allergy substances. */
export function screenAllergies(drugs: string[], allergySubstances: string[]): Flag[] {
  const flags: Flag[] = [];
  const allergies = allergySubstances.map(norm).filter(Boolean);
  for (const d of drugs) {
    const dn = norm(d);
    for (const al of allergies) {
      if (al.length >= 3 && (dn.includes(al) || al.includes(dn))) {
        flags.push({ severity: "severe", text: `Allergy alert: patient is allergic to ${al} — prescribing ${d}.` });
      }
    }
  }
  return flags;
}

export function screenAll(drugs: string[], allergySubstances: string[]): Flag[] {
  return [...screenAllergies(drugs, allergySubstances), ...screenInteractions(drugs)];
}

function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }
