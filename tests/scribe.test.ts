import { describe, it, expect } from "vitest";
import { appendPhrase, clockText } from "@/lib/scribe";

describe("appendPhrase", () => {
  it("capitalises the opening phrase", () => {
    expect(appendPhrase("", "she reports fatigue")).toBe("She reports fatigue");
  });

  it("continues an unfinished sentence with a single space", () => {
    expect(appendPhrase("She reports fatigue", "since March")).toBe("She reports fatigue since March");
  });

  it("starts a new sentence after terminal punctuation", () => {
    expect(appendPhrase("She reports fatigue.", "sleep is broken")).toBe("She reports fatigue. Sleep is broken");
  });

  it("never leaves doubled spaces", () => {
    const out = appendPhrase("BP is high   ", "  and rising ");
    expect(out).toBe("BP is high and rising");
    expect(out).not.toMatch(/ {2}/);
  });

  it("ignores an empty or whitespace phrase", () => {
    expect(appendPhrase("Existing note", "   ")).toBe("Existing note");
    expect(appendPhrase("Existing note", "")).toBe("Existing note");
  });

  it("handles ? and ! as sentence ends too", () => {
    expect(appendPhrase("Any chest pain?", "no")).toBe("Any chest pain? No");
    expect(appendPhrase("Stop!", "she said")).toBe("Stop! She said");
  });
});

describe("clockText", () => {
  it("pads to mm:ss", () => {
    expect(clockText(0)).toBe("00:00");
    expect(clockText(9)).toBe("00:09");
    expect(clockText(61)).toBe("01:01");
    expect(clockText(3599)).toBe("59:59");
  });
  it("keeps counting past an hour rather than wrapping", () => {
    expect(clockText(3600)).toBe("60:00");
  });
});
