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
