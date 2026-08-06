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

  it("defaults to pt-BR as the primary locale", () => {
    expect(defaultLocale).toBe("pt-BR");
  });
});

describe("story-catalog themes", () => {
  it("is derived from themeValues (single source of truth, no drift)", () => {
    expect(themeCatalog.map((entry) => entry.value)).toEqual([...themeValues]);
  });

  it("exposes a deterministic catalog covering every supported theme", () => {
    const values = themeCatalog.map((entry) => entry.value);
    expect(values).toEqual(["courage", "friendship", "kindness"]);
    expect(new Set(values).size).toBe(values.length);
  });

  it("gives every theme entry exact label and description metadata", () => {
    const byValue = Object.fromEntries(themeCatalog.map((entry) => [entry.value, entry]));
    expect(byValue).toEqual({
      courage: {
        value: "courage",
        label: "Courage",
        description: "Overcoming fear and doing the right thing.",
      },
      friendship: {
        value: "friendship",
        label: "Friendship",
        description: "Kindness, sharing, and being a good friend.",
      },
      kindness: {
        value: "kindness",
        label: "Kindness",
        description: "Caring for others and lending a hand.",
      },
    });
  });
});

describe("resolveLocale", () => {
  it("resolves an explicit supported locale to itself", () => {
    expect(resolveLocale("pt-BR")).toBe("pt-BR");
    expect(resolveLocale("en")).toBe("en");
  });

  it("defaults an unknown/unsupported locale to pt-BR", () => {
    expect(resolveLocale("fr")).toBe("pt-BR");
  });

  it("defaults an unspecified locale to pt-BR", () => {
    expect(resolveLocale(undefined)).toBe("pt-BR");
  });
});
