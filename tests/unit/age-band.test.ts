import { describe, expect, it } from "vitest";

import { deriveAgeBand } from "../../src/features/story-request/client/age-band";

describe("deriveAgeBand", () => {
  it("maps the 2-4 band", () => {
    for (const age of [2, 3, 4]) {
      expect(deriveAgeBand(age)).toBe("2-4");
    }
  });

  it("maps the 5-7 band", () => {
    for (const age of [5, 6, 7]) {
      expect(deriveAgeBand(age)).toBe("5-7");
    }
  });

  it("maps the 8-9 band", () => {
    for (const age of [8, 9]) {
      expect(deriveAgeBand(age)).toBe("8-9");
    }
  });

  it("handles every band boundary edge", () => {
    expect(deriveAgeBand(2)).toBe("2-4");
    expect(deriveAgeBand(4)).toBe("2-4");
    expect(deriveAgeBand(5)).toBe("5-7");
    expect(deriveAgeBand(7)).toBe("5-7");
    expect(deriveAgeBand(8)).toBe("8-9");
    expect(deriveAgeBand(9)).toBe("8-9");
  });

  it("rejects ages outside 2-9", () => {
    for (const age of [0, 1, 10, 11, 12, 13, 99, -1]) {
      expect(() => deriveAgeBand(age)).toThrow();
    }
  });

  it("rejects non-integer ages", () => {
    expect(() => deriveAgeBand(1.5)).toThrow();
    expect(() => deriveAgeBand(Number.NaN)).toThrow();
  });
});
