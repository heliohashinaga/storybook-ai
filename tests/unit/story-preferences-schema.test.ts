import { describe, expect, it } from "vitest";

import { storyPreferencesSchema } from "../../src/features/story-request/client/story-preferences-schema";

describe("storyPreferencesSchema", () => {
  const valid = { age: 6, locale: "en", theme: "friendship" };

  it("accepts a valid preferences object", () => {
    expect(storyPreferencesSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts every allow-listed locale", () => {
    for (const locale of ["pt-BR", "en"]) {
      expect(storyPreferencesSchema.safeParse({ ...valid, locale }).success).toBe(true);
    }
  });

  it("accepts every allow-listed theme", () => {
    for (const theme of [
      "courage",
      "friendship",
      "kindness",
      "curiosity",
      "perseverance",
      "empathy",
    ]) {
      expect(storyPreferencesSchema.safeParse({ ...valid, theme }).success).toBe(true);
    }
  });

  it("rejects an invalid age", () => {
    for (const age of [1, 13, 0, -2, 1.5]) {
      expect(storyPreferencesSchema.safeParse({ ...valid, age }).success).toBe(false);
    }
  });

  it("rejects an invalid locale", () => {
    expect(storyPreferencesSchema.safeParse({ ...valid, locale: "fr" }).success).toBe(false);
  });

  it("rejects an invalid theme", () => {
    expect(storyPreferencesSchema.safeParse({ ...valid, theme: "magic" }).success).toBe(false);
  });

  it("rejects missing fields", () => {
    expect(storyPreferencesSchema.safeParse({}).success).toBe(false);
  });

  it("rejects a wrong-typed age", () => {
    expect(storyPreferencesSchema.safeParse({ ...valid, age: "6" }).success).toBe(false);
  });

  it("rejects a wrong-typed locale", () => {
    for (const locale of [123, null]) {
      expect(storyPreferencesSchema.safeParse({ ...valid, locale }).success).toBe(false);
    }
  });

  it("rejects a wrong-typed theme", () => {
    for (const theme of [456, null]) {
      expect(storyPreferencesSchema.safeParse({ ...valid, theme }).success).toBe(false);
    }
  });

  it("rejects any direct child identifier (anonymous by design)", () => {
    const withName = { ...valid, name: "Luna" };
    expect(storyPreferencesSchema.safeParse(withName).success).toBe(false);
  });
});
