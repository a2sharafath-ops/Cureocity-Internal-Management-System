import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { normalisePhone, templateFor, watiReadiness } from "@/lib/wati";

describe("normalisePhone", () => {
  it("accepts the forms a real number arrives in", () => {
    for (const raw of ["+919645999972", "919645999972", "9645999972", "09645999972", "+91 96459 99972", "0091 96459 99972", "96459-99972"]) {
      expect(normalisePhone(raw)).toBe("919645999972");
    }
  });

  it("refuses a 10-digit number that isn't a mobile", () => {
    // Indian mobiles start 6–9. A landline would consume a template send and
    // deliver nothing.
    expect(normalisePhone("2345678901")).toBeNull();
    expect(normalisePhone("0123456789")).toBeNull();
  });

  it("refuses anything too short or too long to be a number", () => {
    for (const raw of ["", "   ", "12345", "9876", "1234567890123456789"]) {
      expect(normalisePhone(raw)).toBeNull();
    }
  });

  it("refuses null and undefined without throwing", () => {
    expect(normalisePhone(null)).toBeNull();
    expect(normalisePhone(undefined)).toBeNull();
  });

  it("leaves a genuine foreign number in international form", () => {
    expect(normalisePhone("+971501234567")).toBe("971501234567");
    expect(normalisePhone("+14155552671")).toBe("14155552671");
  });

  it("strips text a person typed alongside the number", () => {
    expect(normalisePhone("Ph: +91 96459 99972 (mob)")).toBe("919645999972");
  });
});

describe("templateFor", () => {
  const keys = ["WATI_TEMPLATE_PLAN", "WATI_TEMPLATE_RX", "WATI_TEMPLATE_LAB", "WATI_TEMPLATE_SUMMARY"];
  let saved: Record<string, string | undefined>;
  beforeEach(() => { saved = Object.fromEntries(keys.map((k) => [k, process.env[k]])); for (const k of keys) delete process.env[k]; });
  afterEach(() => { for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } });

  it("falls back to the documented names", () => {
    expect(templateFor("plan")).toBe("diet_plan_ready");
    expect(templateFor("rx")).toBe("prescription_ready");
    expect(templateFor("lab")).toBe("lab_request_ready");
    expect(templateFor("summary")).toBe("consultation_summary_ready");
  });

  it("lets the environment override, so a rename in Wati needs no deploy", () => {
    process.env.WATI_TEMPLATE_PLAN = "cureocity_diet_v2";
    expect(templateFor("plan")).toBe("cureocity_diet_v2");
  });

  it("returns empty for a document with no template", () => {
    expect(templateFor("nonsense")).toBe("");
  });
});

describe("watiReadiness", () => {
  let saved: Record<string, string | undefined>;
  beforeEach(() => {
    saved = { WATI_API_ENDPOINT: process.env.WATI_API_ENDPOINT, WATI_ACCESS_TOKEN: process.env.WATI_ACCESS_TOKEN };
    delete process.env.WATI_API_ENDPOINT; delete process.env.WATI_ACCESS_TOKEN;
  });
  afterEach(() => { for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } });

  it("names exactly what is missing", () => {
    const r = watiReadiness();
    expect(r.ready).toBe(false);
    expect(r.missing).toContain("WATI_API_ENDPOINT");
    expect(r.missing).toContain("WATI_ACCESS_TOKEN");
  });

  it("is ready once both are set", () => {
    process.env.WATI_API_ENDPOINT = "https://live.wati.io";
    process.env.WATI_ACCESS_TOKEN = "Bearer x";
    expect(watiReadiness().ready).toBe(true);
  });
});
