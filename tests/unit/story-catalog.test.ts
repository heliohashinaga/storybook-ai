import { describe, expect, it } from "vitest";

import {
  localeValues,
  themeValues,
} from "../../src/features/story-request/client/story-preferences-schema";
import {
  defaultLocale,
  localeCatalog,
  resolveLocale,
  themeCatalog,
} from "../../src/lib/story-catalog";

describe("story-catalog locales", () => {
  it("is derived from localeValues (single source of truth, no drift)", () => {
    expect(localeCatalog.map((entry) => entry.value)).toEqual([...localeValues]);
  });

  it("exposes a deterministic catalog covering every supported locale", () => {
    const values = localeCatalog.map((entry) => entry.value);
    expect(values).toEqual(["pt-BR", "en"]);
    expect(new Set(values).size).toBe(values.length);
  });

  it("gives every locale entry its exact display label", () => {
    const labels = Object.fromEntries(localeCatalog.map((entry) => [entry.value, entry.label]));
    expect(labels).toEqual({
      "pt-BR": "Português (Brasil)",
      en: "English",
    });
  });

  it("defaults to en as the primary locale", () => {
    expect(defaultLocale).toBe("en");
  });
});

describe("story-catalog themes", () => {
  it("is derived from themeValues (single source of truth, no drift)", () => {
    expect(themeCatalog.map((entry) => entry.value)).toEqual([...themeValues]);
  });

  it("exposes a deterministic catalog covering every supported theme", () => {
    const values = themeCatalog.map((entry) => entry.value);
    expect(values).toEqual([
      "courage",
      "friendship",
      "kindness",
      "curiosity",
      "perseverance",
      "empathy",
    ]);
    expect(new Set(values).size).toBe(values.length);
  });

  it("gives every theme entry exact label, description and emoji metadata", () => {
    const byValue = Object.fromEntries(themeCatalog.map((entry) => [entry.value, entry]));
    expect(byValue).toEqual({
      courage: {
        value: "courage",
        label: "Courage",
        description: "Overcoming fear and doing the right thing.",
        emoji: "🦁",
      },
      friendship: {
        value: "friendship",
        label: "Friendship",
        description: "Kindness, sharing, and being a good friend.",
        emoji: "🤝",
      },
      kindness: {
        value: "kindness",
        label: "Kindness",
        description: "Caring for others and lending a hand.",
        emoji: "💛",
      },
      curiosity: {
        value: "curiosity",
        label: "Curiosity",
        description: "Asking questions and discovering the unknown.",
        emoji: "🔍",
      },
      perseverance: {
        value: "perseverance",
        label: "Perseverance",
        description: "Trying again and never giving up.",
        emoji: "💪",
      },
      empathy: {
        value: "empathy",
        label: "Empathy",
        description: "Understanding how others feel.",
        emoji: "🌱",
      },
    });
  });
});

describe("resolveLocale", () => {
  it("resolves an explicit supported locale to itself", () => {
    expect(resolveLocale("pt-BR")).toBe("pt-BR");
    expect(resolveLocale("en")).toBe("en");
  });

  it("defaults an unknown/unsupported locale to en", () => {
    expect(resolveLocale("fr")).toBe("en");
  });

  it("defaults an unspecified locale to en", () => {
    expect(resolveLocale(undefined)).toBe("en");
  });
});
