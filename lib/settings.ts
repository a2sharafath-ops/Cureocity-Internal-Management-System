// App-wide editable settings — branding + document templates. One JSON row in
// app_settings (publicly readable). getAppSettings() merges saved values over
// the defaults so callers always get a complete object.

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type AppSettings = {
  brand: {
    logo: string;        // data URL or path; "" → static fallback
    color: string;       // primary brand colour (hex)
    font: string;        // CSS font-family stack; "" → system default
  };
  letterhead: {
    name: string;
    addr1: string;
    addr2: string;
    phone: string;
    email: string;
    website: string;
  };
  consult: {
    signoffCompany: string;    // sign-off company line
    initialClosing: string;    // closing paragraph for the initial consult letter
    followupClosing: string;   // closing paragraph for the follow-up consult letter
  };
  diet: {
    footerNote: string;        // note printed on the diet-chart PDF
    defaultRows: string[];     // default meal-row labels in the chart builder
  };
  rx: {
    header: string;            // prescription header line
    footer: string;            // prescription footer line
  };
  /**
   * Printable sheet designs. Each document type gets a full-page artwork you
   * upload (A4 portrait), plus the safe area to keep text out of it. Margins
   * are in millimetres so they match what a designer works in.
   *
   * `bg` is a public URL in the `branding` bucket, not a data URL: an A4
   * background base64-inlined into app_settings would be megabytes on a row
   * that is read on nearly every page, including sign-in.
   */
  docs: {
    rx: DocSheet;
    lab: DocSheet;
    /** Flowing documents — see DocSheet.cover for why these differ. */
    plan: DocSheet;      // customised diet plan
    summary: DocSheet;   // consultation summary
    assess: DocSheet;    // dietary assessment summary
  };
};

export type DocSheet = {
  /**
   * The CONTINUATION frame — letterhead, border, footer — repeated on every
   * page. "" falls back to a plain letterhead built from the details above.
   */
  bg: string;
  /**
   * Artwork for page one only, used by documents whose length depends on their
   * content: a diet plan runs seven pages for one client and fifteen for
   * another, so a single fixed design cannot carry the whole thing. The cover
   * is fixed and prints as-is; the pages after it flow inside `bg`.
   *
   * Empty for the prescription and lab sheets, which are one page with known
   * zones and need only `bg`.
   */
  cover?: string;
  top: number;       // mm of artwork to keep clear at the top (the letterhead)
  bottom: number;    // mm to keep clear at the bottom (footer / signature band)
  side: number;      // mm left/right
};

export const DEFAULT_SETTINGS: AppSettings = {
  brand: { logo: "", color: "#e11f34", font: "" },
  letterhead: {
    name: "Cureocity Healthtech",
    addr1: "Door 56, RCC Building, G-355,",
    addr2: "Panambilly Nagar, Kochi - 682036.",
    phone: "+91 90480 03375",
    email: "info@cureocity.in",
    website: "www.cureocity.in",
  },
  consult: {
    signoffCompany: "Cureocity HealthTech LLP",
    initialClosing: "",
    followupClosing: "",
  },
  diet: {
    footerNote: "",
    defaultRows: ["Early Morning", "Breakfast", "Mid-Morning", "Lunch", "Evening", "Dinner"],
  },
  rx: {
    header: "Cureocity HealthTech LLP · Kochi",
    footer: "This prescription is issued as part of your Cureocity care plan.",
  },
  // Defaults suit a typical printed letterhead: ~45 mm of masthead, ~30 mm of
  // footer. With no artwork uploaded these are also sensible plain margins.
  docs: {
    rx: { bg: "", top: 45, bottom: 30, side: 18 },
    lab: { bg: "", top: 45, bottom: 30, side: 18 },
    // The flowing documents carry their own cover page, so their continuation
    // frame needs far less headroom — no masthead is repeated.
    plan: { bg: "", cover: "", top: 22, bottom: 20, side: 14 },
    summary: { bg: "", cover: "", top: 45, bottom: 30, side: 18 },
    assess: { bg: "", cover: "", top: 22, bottom: 20, side: 14 },
  },
};

// Deep-merge saved data over defaults (one level per section is enough here).
function merge(saved: Partial<AppSettings> | null | undefined): AppSettings {
  const s = saved ?? {};
  return {
    brand: { ...DEFAULT_SETTINGS.brand, ...(s.brand ?? {}) },
    letterhead: { ...DEFAULT_SETTINGS.letterhead, ...(s.letterhead ?? {}) },
    consult: { ...DEFAULT_SETTINGS.consult, ...(s.consult ?? {}) },
    diet: { ...DEFAULT_SETTINGS.diet, ...(s.diet ?? {}), defaultRows: (s.diet?.defaultRows?.length ? s.diet.defaultRows : DEFAULT_SETTINGS.diet.defaultRows) },
    rx: { ...DEFAULT_SETTINGS.rx, ...(s.rx ?? {}) },
    docs: {
      rx: { ...DEFAULT_SETTINGS.docs.rx, ...(s.docs?.rx ?? {}) },
      lab: { ...DEFAULT_SETTINGS.docs.lab, ...(s.docs?.lab ?? {}) },
      plan: { ...DEFAULT_SETTINGS.docs.plan, ...(s.docs?.plan ?? {}) },
      summary: { ...DEFAULT_SETTINGS.docs.summary, ...(s.docs?.summary ?? {}) },
      assess: { ...DEFAULT_SETTINGS.docs.assess, ...(s.docs?.assess ?? {}) },
    },
  };
}

export const getAppSettings = cache(async (): Promise<AppSettings> => {
  try {
    const supabase = createClient();
    const { data } = await supabase.from("app_settings").select("data").eq("id", 1).maybeSingle();
    return merge((data as { data?: Partial<AppSettings> } | null)?.data);
  } catch {
    return DEFAULT_SETTINGS;
  }
});

/** The brand logo to show, falling back to the bundled mark. */
export function brandLogo(s: AppSettings): string {
  return s.brand.logo?.trim() || "/cureocity-mark.png?v=2";
}
