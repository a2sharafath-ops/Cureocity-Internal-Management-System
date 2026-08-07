import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { printClient } from "@/lib/print-access";
import { IST } from "@/lib/datetime";
import { getAppSettings, brandLogo } from "@/lib/settings";
import PrintTrigger from "@/components/PrintTrigger";
import { parseNotes } from "@/lib/diet-plan";
import type { Assessment } from "@/lib/diet-assessment";

export const dynamic = "force-dynamic";

// Branded PDF for the Dietary Assessment Summary — the companion document to
// the customised diet plan (app/diet-plan/[id]/print). Same construction as
// that sibling: full-bleed A4, @page margin 0, an uploaded cover/frame from
// settings with a built-in fallback, printClient() for the token-aware read,
// PrintTrigger for the button.
//
// Unlike the diet plan (one coral cover + one dark body), the assessment's
// real document alternates colour blocks section by section — white, coral,
// white, coral, black, black, white, white — and that alternation is the
// design, not a stylistic flourish. Page 1 is a fixed white cover (fields,
// not colour); everything after it is one flowing column of coloured
// sections, each avoiding a page break inside itself but not forced onto its
// own page — exactly like the original printed document, where a section can
// end partway down a page and the next colour starts right under it.
//
// Access: same shape as every other print page. The diet_assessments_client
// RLS policy already encodes "published AND shared" — an unauthorized row
// simply doesn't come back, and we 404. The token seam (lib/pdf.ts DocKind)
// has no "assessment" kind yet, so this reuses "summary" per the seam owner's
// note — a UUID-bound token minted for "summary" cannot practically collide
// with another document's id, and widening the seam is a separate change.
export default async function DietAssessmentPrintPage(
  props: { params: Promise<{ id: string }>; searchParams: Promise<{ auto?: string; doc_token?: string }> }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const supabase = await printClient("assess", params.id, searchParams.doc_token);

  const { data } = await supabase
    .from("diet_assessments")
    .select(`
      id, status, issued_on, created_at,
      consulted_on, dietitian, medical_history, existing_condition, medications, allergies, family_history,
      occupation, daily_activity, exercise, sleep_hours, sleep_quality, stress_level, gut_health, weight_change,
      diet_type, food_allergies, food_dislikes, supplements,
      height, weight, bmi, bmr, tee, muscle_mass, fat_mass, body_fat, visceral_fat, waist_hip,
      primary_goals, target_weight, timeline_weeks, objectives,
      meal_frequency, meals_per_day, snacking, hydration, notes,
      clients(name, code, dob, gender, phone, email, address)
    `)
    .eq("id", params.id)
    .maybeSingle();
  if (!data) notFound();

  const a = data as unknown as Assessment & {
    id: string; issued_on: string | null; created_at: string;
    clients: { name: string; code: string | null; dob: string | null; gender: string | null; phone: string | null; email: string | null; address: string | null } | null;
  };

  const settings = await getAppSettings();
  const logo = brandLogo(settings);
  const docAssess = settings.docs.assess;
  const hasCover = !!docAssess.cover?.trim();
  const hasFrame = !!docAssess.bg?.trim();

  const client = a.clients;
  const clientName = client?.name ?? "Client";
  const clientCode = client?.code ?? "—";
  const issuedDate = a.issued_on ? ddmmyyyyFromDateOnly(a.issued_on) : ddmmyyyyFromTimestamp(a.created_at);
  const consultedOn = a.consulted_on ? ddmmyyyyFromDateOnly(a.consulted_on) : "--";

  const medicationRows = (a.medications ?? []).map((m) => [m.medication?.trim() || "--", m.notes?.trim() || "--"]);
  const exerciseRows = (a.exercise ?? []).map((e) => [e.type?.trim() || "--", e.frequency?.trim() || "--", e.duration?.trim() || "--"]);
  const sleepRows = a.sleep_hours?.trim() || a.sleep_quality?.trim() ? [[a.sleep_hours?.trim() || "--", a.sleep_quality?.trim() || "--"]] : [];

  // Generous full-bleed padding when the section runs edge to edge (no
  // uploaded frame); tighter padding when a frame is present, since the
  // frame's own top/side/bottom margins already reserve the page's clear
  // area and the sections sit inside that, not the raw page.
  const sectionPad = hasFrame ? "14mm 12mm" : "24mm 18mm";

  const Page1 = (
    <div className="page1" style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 34 }}>
        <div style={{ width: 34, height: 34, borderRadius: 8, background: "#fff", border: "1px solid #f0f0f0", display: "grid", placeItems: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} alt="Cureocity" style={{ maxWidth: 24, maxHeight: 24, display: "block" }} />
        </div>
        <span style={{ fontSize: 19, fontWeight: 800, letterSpacing: "-.3px", color: "#111" }}>Cureocity</span>
      </div>

      <div style={{ fontSize: 34, fontWeight: 300, lineHeight: 1.22, color: "#111", marginBottom: 26 }}>
        <div>{clientName}&apos;s</div>
        <div>Dietary Assessment</div>
        <div>Summary</div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#111" }}>ID : {clientCode}</div>
        <div style={{ border: `1.5px solid ${CORAL}`, color: CORAL, borderRadius: 999, padding: "6px 18px", fontSize: 12, fontWeight: 700 }}>
          Issued Date: {issuedDate}
        </div>
      </div>

      <div style={{ height: 1, background: "#e5e7eb", marginBottom: 28 }} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "22px 30px" }}>
        <Field label="Name" value={client?.name} tone={ON_WHITE} />
        <Field label="Date of Birth" value={client?.dob} tone={ON_WHITE} />
        <Field label="Gender" value={client?.gender} tone={ON_WHITE} />
        <Field label="Contact No." value={client?.phone} tone={ON_WHITE} />
        <Field label="Email" value={client?.email} tone={ON_WHITE} />
        <Field label="Address" value={client?.address} tone={ON_WHITE} />
      </div>
    </div>
  );

  const bodyContent = (
    <div style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* ---------------- Initial Consultation Details (CORAL) ---------------- */}
      <Section bg={CORAL} pad={sectionPad}>
        <Heading color="#fff">Initial Consultation Details</Heading>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 4 }}>
          <Field label="Date of consultation" value={consultedOn} tone={ON_CORAL} />
          <Field label="Dietitian's ID" value={a.dietitian} tone={ON_CORAL} />
        </div>
        <Rule color="rgba(255,255,255,.35)" />
        <div style={{ display: "grid", gap: 16, marginBottom: 18 }}>
          <Field label="Medical history" value={a.medical_history} tone={ON_CORAL} pre />
          <Field label="Existing condition" value={a.existing_condition} tone={ON_CORAL} pre />
        </div>
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".6px", textTransform: "uppercase", color: ON_CORAL.label, marginBottom: 6 }}>
            Medications
          </div>
          <Table head={["Medication", "Notes"]} rows={medicationRows} headBg="rgba(255,255,255,.9)" headColor={CORAL} />
        </div>
        <div style={{ display: "grid", gap: 16 }}>
          <Field label="Allergies" value={a.allergies} tone={ON_CORAL} pre />
          <Field label="Family history" value={a.family_history} tone={ON_CORAL} pre />
        </div>
      </Section>

      {/* ---------------- Lifestyle Assessment (WHITE) ---------------- */}
      <Section bg="#fff" pad={sectionPad}>
        <Heading color="#111">Lifestyle Assessment</Heading>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 20 }}>
          <Field label="Occupation" value={a.occupation} tone={ON_WHITE} />
          <Field label="Daily activity" value={a.daily_activity} tone={ON_WHITE} />
        </div>

        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".6px", textTransform: "uppercase", color: ON_WHITE.label, marginBottom: 6 }}>
          Exercise routine
        </div>
        <div style={{ marginBottom: 20 }}>
          <Table head={["Type", "Frequency", "Duration"]} rows={exerciseRows} headBg="#e5e7eb" headColor="#374151" />
        </div>

        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".6px", textTransform: "uppercase", color: ON_WHITE.label, marginBottom: 6 }}>
          Sleep patterns
        </div>
        <div style={{ marginBottom: 22 }}>
          <Table head={["Hours", "Quality"]} rows={sleepRows} headBg="#e5e7eb" headColor="#374151" />
        </div>

        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".6px", textTransform: "uppercase", color: ON_WHITE.label, marginBottom: 8 }}>
          Stress level
        </div>
        <div style={{ marginBottom: 20 }}>
          <StressRow label="Low" selected={a.stress_level === "low"} />
          <StressRow label="Medium" selected={a.stress_level === "medium"} />
          <StressRow label="High" selected={a.stress_level === "high"} />
        </div>

        <div style={{ display: "grid", gap: 16 }}>
          <Field label="Gut health" value={a.gut_health} tone={ON_WHITE} pre />
          <Field label="Recent weight loss or weight gain" value={a.weight_change} tone={ON_WHITE} pre />
        </div>
      </Section>

      {/* ---------------- Dietary preference (CORAL) ---------------- */}
      <Section bg={CORAL} pad={sectionPad}>
        <Heading color="#fff">Dietary preference</Heading>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <Field label="Diet type" value={a.diet_type} tone={ON_CORAL} />
          <Field label="Food allergies" value={a.food_allergies} tone={ON_CORAL} />
          <Field label="Food dislikes" value={a.food_dislikes} tone={ON_CORAL} />
          <Field label="Supplements" value={a.supplements} tone={ON_CORAL} />
        </div>
      </Section>

      {/* ---------------- Current Health Status (BLACK) ---------------- */}
      <Section bg={BLACK} pad={sectionPad}>
        <Heading color="#fff">Current Health Status</Heading>
        <DarkPill label="Height (cm)" value={fmtNum(a.height)} />
        <DarkPill label="Weight (kg)" value={fmtNum(a.weight)} />
        <DarkPill label="BMI (kg/m²)" value={fmtNum(a.bmi)} />
        <DarkPill label="BMR (kcal)" value={fmtNum(a.bmr)} />
        <DarkPill label="TEE (kcal)" value={fmtNum(a.tee)} />
        <DarkPill label="Skeletal Muscle Mass (kg)" value={fmtNum(a.muscle_mass)} />
        <DarkPill label="Body fat mass (Kg)" value={fmtNum(a.fat_mass)} />
        <DarkPill label="Percentage body fat (%)" value={fmtNum(a.body_fat)} />
        <DarkPill label="Visceral fat" value={fmtNum(a.visceral_fat)} />
        <DarkPill label="Waist hip ratio" value={fmtNum(a.waist_hip)} />
      </Section>

      {/* ---------------- Health and Fitness Goal (BLACK, continued) ---------------- */}
      <Section bg={BLACK} pad={sectionPad}>
        <Rule color="rgba(255,255,255,.35)" />
        <Heading color="#fff">Health and Fitness Goal</Heading>
        <div style={{ marginBottom: 18 }}>
          <Field label="Primary goals" value={a.primary_goals} tone={ON_BLACK} pre />
        </div>
        <DarkPill label="Target Weight" value={a.target_weight != null ? `${a.target_weight} kg` : "-- kg"} />
        <DarkPill label="Timeline" value={a.timeline_weeks != null ? `${a.timeline_weeks} weeks` : "-- weeks"} />
        <div style={{ marginTop: 14 }}>
          <Field label="Specific objectives" value={a.objectives} tone={ON_BLACK} pre />
        </div>
      </Section>

      {/* ---------------- Dietary intake assessment (WHITE) ---------------- */}
      <Section bg="#fff" pad={sectionPad}>
        <Heading color="#111">Dietary intake assessment</Heading>
        <LightPill label="Meal frequency" value={a.meal_frequency?.trim() || "--"} />
        <LightPill label="No. of meals" value={a.meals_per_day?.trim() || "--"} />
        <div style={{ marginTop: 16, marginBottom: 16 }}>
          <Field label="Snacking habits / cravings" value={a.snacking} tone={ON_WHITE} pre />
        </div>
        <LightPill label="Hydration status" value={a.hydration?.trim() || "--"} />
      </Section>

      {/* ---------------- Notes (WHITE, final) ---------------- */}
      <Section bg="#fff" pad={sectionPad}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "1px", marginBottom: 12, color: "#111" }}>NOTES</div>
        {/* Same structured rendering as the diet plan's notes page — headings,
            numbered steps and bullets survive instead of flattening into one
            pre-wrapped block. See parseNotes in lib/diet-plan.ts. */}
        <div style={{ fontSize: 12.5, lineHeight: 1.65, color: "#333" }}>
          {a.notes?.trim() ? parseNotes(a.notes).map((l, i) =>
            l.kind === "blank" ? <div key={i} style={{ height: 9 }} />
            : l.kind === "heading" ? <div key={i} style={{ fontWeight: 800, color: "#111", marginTop: i ? 12 : 0, marginBottom: 3 }}>{l.text}</div>
            : l.kind === "item" ? (
              <div key={i} style={{ display: "flex", gap: 8, paddingLeft: 4, marginBottom: 2 }}>
                <span style={{ color: CORAL, flexShrink: 0 }}>•</span><span>{l.text}</span>
              </div>
            ) : <div key={i} style={{ marginBottom: 2 }}>{l.text}</div>,
          ) : <span style={{ color: "#9ca3af", fontStyle: "italic" }}>No notes recorded.</span>}
        </div>
      </Section>
    </div>
  );

  return (
    <div style={{ background: "#e5e5e5" }}>
      <style>{`
        @page { size: A4; margin: 0; }
        html, body { margin: 0; padding: 0; }
        * { box-sizing: border-box; }
        @media print {
          .no-print { display: none !important; }
          .page1, .body-wrap { box-shadow: none !important; margin: 0 !important; }
        }
        @media screen {
          .page1, .body-wrap { box-shadow: 0 2px 18px rgba(0,0,0,.25); margin: 0 auto 16px; }
        }
        .page1 { position: relative; width: 210mm; min-height: 297mm; padding: 26mm 18mm; background: #fff; color: #111; page-break-after: always; break-after: page; }
        .body-wrap { position: relative; width: 210mm; }
        .doc-section { page-break-inside: avoid; break-inside: avoid; }
        /* Uploaded page frame for the flowing sections — repeats on every
           printed page behind the content, same pattern as the diet plan's
           .plan-bg / SheetPage. */
        .assess-bg { position: fixed; inset: 0; width: 210mm; height: 297mm; left: 50%; transform: translateX(-50%); object-fit: cover; z-index: 0; }
        @media screen { .assess-bg { position: absolute; transform: none; left: 0; } }
      `}</style>

      <div className="no-print" style={{ display: "flex", justifyContent: "center", padding: "14px 10px" }}>
        <PrintTrigger auto={searchParams?.auto === "1"} />
      </div>

      {/* ---------------- Page 1 ---------------- */}
      {hasCover ? (
        // Uploaded cover art, full-bleed at A4 — replaces the built-in white
        // front page entirely. The white front page remains the fallback.
        (<div className="page1" style={{ padding: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={docAssess.cover} alt="" style={{ position: "absolute", inset: 0, width: "210mm", height: "297mm", objectFit: "cover", display: "block" }} />
        </div>)
      ) : Page1}

      {/* ---------------- Remaining sections ---------------- */}
      <div className="body-wrap">
        {hasFrame && (
          // eslint-disable-next-line @next/next/no-img-element
          (<img src={docAssess.bg} alt="" className="assess-bg" />)
        )}
        <div style={hasFrame ? { position: "relative", zIndex: 1, padding: `${docAssess.top}mm ${docAssess.side}mm ${docAssess.bottom}mm` } : undefined}>
          {bodyContent}
        </div>
      </div>
    </div>
  );
}

const CORAL = "#F14A55";
const BLACK = "#0d0d0d";

const ON_WHITE = { label: "#9ca3af", value: "#111" };
const ON_CORAL = { label: "rgba(255,255,255,.75)", value: "#fff" };
const ON_BLACK = { label: "rgba(255,255,255,.55)", value: "#fff" };

function fmtNum(v: number | null | undefined): string {
  return v === null || v === undefined ? "--" : String(v);
}

function Section({ bg, pad, children }: { bg: string; pad: string; children: ReactNode }) {
  const color = bg === "#fff" ? "#111" : "#fff";
  return (
    <div className="doc-section" style={{ background: bg, color, padding: pad }}>
      {children}
    </div>
  );
}

function Heading({ children, color }: { children: ReactNode; color: string }) {
  return <div style={{ fontSize: 22, fontWeight: 300, color, marginBottom: 20 }}>{children}</div>;
}

function Rule({ color }: { color: string }) {
  return <div style={{ height: 1, background: color, margin: "16px 0 20px" }} />;
}

function Field({ label, value, tone, pre }: {
  label: string; value: string | number | null | undefined; tone: { label: string; value: string }; pre?: boolean;
}) {
  const text = value === null || value === undefined || String(value).trim() === "" ? "--" : String(value);
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".6px", textTransform: "uppercase", color: tone.label, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: tone.value, lineHeight: 1.55, whiteSpace: pre ? "pre-wrap" : "normal" }}>{text}</div>
    </div>
  );
}

/** A rounded pill split into two halves — a white label half and a black
 *  value half with a white border, so it reads against the black section it
 *  lives in. Reused for the health-status figures and the two goal pills. */
function DarkPill({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", borderRadius: 999, overflow: "hidden", marginBottom: 10, fontSize: 12.5 }}>
      <div style={{ flex: 1, background: "#fff", color: BLACK, fontWeight: 700, padding: "9px 18px" }}>{label}</div>
      <div style={{ flex: 1, background: BLACK, color: "#fff", fontWeight: 700, padding: "9px 18px", border: "1px solid #fff", borderLeft: "none" }}>{value}</div>
    </div>
  );
}

/** The same split-pill idea in a light grey register, for the dietary-intake
 *  fields on the white section. */
function LightPill({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", borderRadius: 999, overflow: "hidden", marginBottom: 10, fontSize: 12.5 }}>
      <div style={{ flex: 1, background: "#f3f4f6", color: "#374151", fontWeight: 700, padding: "9px 18px" }}>{label}</div>
      <div style={{ flex: 1, background: "#e5e7eb", color: "#111", fontWeight: 700, padding: "9px 18px" }}>{value}</div>
    </div>
  );
}

/** One of the three stress-level checkbox rows. The selected level reads as a
 *  ticked, coral-outlined, highlighted row; the other two are empty boxes. */
function StressRow({ label, selected }: { label: string; selected: boolean }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", borderRadius: 8, marginBottom: 6,
      border: selected ? `1.5px solid ${CORAL}` : "1px solid #e5e7eb",
      background: selected ? "rgba(241,74,85,.08)" : "transparent",
    }}>
      <div style={{
        width: 16, height: 16, borderRadius: 4, flexShrink: 0, display: "grid", placeItems: "center",
        border: `1.5px solid ${selected ? CORAL : "#9ca3af"}`, background: selected ? CORAL : "transparent",
      }}>
        {selected && <span style={{ color: "#fff", fontSize: 10, fontWeight: 900, lineHeight: 1 }}>✓</span>}
      </div>
      <span style={{ fontSize: 13, fontWeight: selected ? 700 : 500, color: "#111" }}>{label}</span>
    </div>
  );
}

function Table({ head, rows, headBg, headColor }: {
  head: string[]; rows: (string | number | null)[][]; headBg: string; headColor: string;
}) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5, background: "#fff", borderRadius: 6, overflow: "hidden" }}>
      <thead>
        <tr>
          {head.map((h) => (
            <th key={h} style={{
              textAlign: "left", padding: "8px 10px", background: headBg, color: headColor,
              fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".4px",
            }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr><td colSpan={head.length} style={{ padding: "10px 10px", color: "#9ca3af", fontStyle: "italic", textAlign: "center" }}>--</td></tr>
        ) : rows.map((r, i) => (
          <tr key={i} style={{ background: i % 2 === 0 ? "#ffffff" : "#f7f7f7" }}>
            {r.map((c, j) => (
              <td key={j} style={{ padding: "8px 10px", color: "#111", borderBottom: "1px solid #eee" }}>{c ?? "--"}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** "YYYY-MM-DD" (a plain date column, not a timestamp) → "DD-MM-YYYY". No
 *  timezone conversion — the value is already a clinic-local calendar date. */
function ddmmyyyyFromDateOnly(d: string): string {
  const [y, m, day] = d.split("-");
  return `${day}-${m}-${y}`;
}

/** timestamptz → "DD-MM-YYYY" in clinic-local time. Used as a fallback only
 *  when an assessment has no `issued_on` set. */
function ddmmyyyyFromTimestamp(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: IST }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("day")}-${get("month")}-${get("year")}`;
}
