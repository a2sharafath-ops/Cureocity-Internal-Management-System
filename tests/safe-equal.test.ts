import { describe, it, expect } from "vitest";
import { safeEqual, bearerOk } from "@/lib/safe-equal";

// Three routes compared their shared secret with `===`, while two others did it
// properly. One helper now, used by all five.

describe("safeEqual", () => {
  it("accepts an exact match", () => {
    expect(safeEqual("s3cret-value", "s3cret-value")).toBe(true);
  });

  it("rejects a different value of the same length", () => {
    expect(safeEqual("s3cret-value", "s3cret-valuf")).toBe(false);
  });

  it("rejects a different length", () => {
    expect(safeEqual("short", "longer-secret")).toBe(false);
  });

  it("rejects a prefix — the case a timing attack builds towards", () => {
    expect(safeEqual("s3cret", "s3")).toBe(false);
  });

  it("treats two empty strings as equal, which is why callers must fail closed first", () => {
    expect(safeEqual("", "")).toBe(true);
  });
});

describe("bearerOk", () => {
  it("accepts the right header", () => {
    expect(bearerOk("Bearer abc123", "abc123")).toBe(true);
  });

  it("rejects the wrong token", () => {
    expect(bearerOk("Bearer nope", "abc123")).toBe(false);
  });

  it("rejects a missing header", () => {
    expect(bearerOk(null, "abc123")).toBe(false);
  });

  it("rejects the bare token without the Bearer prefix", () => {
    expect(bearerOk("abc123", "abc123")).toBe(false);
  });

  it("FAILS CLOSED when the secret isn't configured", () => {
    // The important one: an unset env var must not mean "let everyone in",
    // and must not mean "" === "" either.
    expect(bearerOk("Bearer anything", undefined)).toBe(false);
    expect(bearerOk(null, undefined)).toBe(false);
    expect(bearerOk("Bearer ", "")).toBe(false);
  });
});
