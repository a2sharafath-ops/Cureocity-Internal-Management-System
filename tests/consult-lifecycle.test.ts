import { describe, it, expect } from "vitest";
import { deletable, statusAfterUndo, CANCELLED } from "@/lib/consult-lifecycle";

const empty = {
  status: "scheduled",
  summary: null,
  aiSummary: null,
  answers: null,
  flags: null,
  draft: null,
  orderCount: 0,
  prescriptionCount: 0,
};

describe("deletable", () => {
  it("allows an untouched booking to be destroyed", () => {
    expect(deletable(empty)).toEqual({ deletable: true });
  });

  it("refuses anything that has been completed, even if every field is blank", () => {
    // A completed consultation is an encounter that happened. The record that
    // it took place is itself clinical history.
    const v = deletable({ ...empty, status: "completed" });
    expect(v.deletable).toBe(false);
    expect(v).toHaveProperty("reason");
  });

  it("refuses once a summary has been written", () => {
    expect(deletable({ ...empty, summary: "Seen, well." }).deletable).toBe(false);
  });

  it("treats whitespace as no summary — an empty textarea is not content", () => {
    expect(deletable({ ...empty, summary: "   \n " }).deletable).toBe(true);
  });

  it("refuses once the questionnaire has been answered", () => {
    expect(deletable({ ...empty, answers: [["Q", "A"]] }).deletable).toBe(false);
  });

  it("ignores an empty answers array — the column is initialised, not used", () => {
    expect(deletable({ ...empty, answers: [] }).deletable).toBe(true);
  });

  it("refuses when flags were raised", () => {
    expect(deletable({ ...empty, flags: [{ text: "BP high", severity: "warning" }] }).deletable).toBe(false);
  });

  it("refuses when the console autosaved real work", () => {
    expect(deletable({ ...empty, draft: { vitals: { systolic: "120" } } }).deletable).toBe(false);
    expect(deletable({ ...empty, draft: { rx: { drug: "Metformin" } } }).deletable).toBe(false);
    expect(deletable({ ...empty, draft: { transcript: "patient reports..." } }).deletable).toBe(false);
  });

  it("ignores an autosaved draft that holds nothing but defaults", () => {
    // The console autosaves the moment it opens, so a consultation nobody typed
    // into still gets {"order":{"priority":"routine"},"vitals":{}}. Treating
    // that as work made the very row people want deleted undeletable.
    expect(deletable({ ...empty, draft: { order: { priority: "routine" }, vitals: {} } }).deletable).toBe(true);
    expect(deletable({ ...empty, draft: {} }).deletable).toBe(true);
    expect(deletable({ ...empty, draft: { vitals: {}, rx: {}, order: {} } }).deletable).toBe(true);
    expect(deletable({ ...empty, draft: { transcript: "   " } }).deletable).toBe(true);
  });

  it("a typed lab test still counts, even alongside the default priority", () => {
    expect(deletable({ ...empty, draft: { order: { priority: "routine", test: "HbA1c" } } }).deletable).toBe(false);
  });

  it("refuses when lab orders point at it, and says how many", () => {
    const v = deletable({ ...empty, orderCount: 2 });
    expect(v.deletable).toBe(false);
    if (!v.deletable) expect(v.reason).toContain("2 lab orders");
  });

  it("refuses when a prescription points at it, singular", () => {
    const v = deletable({ ...empty, prescriptionCount: 1 });
    expect(v.deletable).toBe(false);
    if (!v.deletable) expect(v.reason).toContain("1 prescription ");
  });

  it("does not treat a cancelled-but-empty row as undeletable", () => {
    // Cancel first, change your mind, delete — a reasonable path for a row
    // that never held anything.
    expect(deletable({ ...empty, status: CANCELLED }).deletable).toBe(true);
  });
});

describe("statusAfterUndo", () => {
  it("returns a never-completed consultation to scheduled", () => {
    expect(statusAfterUndo(null)).toBe("scheduled");
  });

  it("returns a completed one to completed, so undo doesn't reopen finished work", () => {
    expect(statusAfterUndo("2026-08-07T06:13:20.904Z")).toBe("completed");
  });
});
