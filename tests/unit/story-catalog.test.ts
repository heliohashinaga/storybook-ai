import { describe, expect, it } from "vitest";

import {
  defaultLocale,
  localeCatalog,
  resolveLocale,
  themeCatalog,
} from "../../src/lib/story-catalog";

describe("story-catalog locales", () => {
  it("exposes a deterministic catalog covering every supported locale", () => {
    const values = localeCatalog.map((entry) => entry.value);
    expect(values).toEqual(["pt-BR", "en"]);
    expect(new Set(values).size).toBe(values.length);
  });

  it("gives every locale entry a label for display", () => {
    for (const entry of localeCatalog) {
      expect(entry.label).toBeTypeOf("string");
      expect(entry.label.length).toBeGreaterThan(0);
    }
  });

  it("defaults to pt-BR as the primary locale", () => {
    expect(defaultLocale).toBe("pt-BR");
  });
});

describe("story-catalog themes", () => {
  it("exposes a deterministic catalog covering every supported theme", () => {
    const values = themeCatalog.map((entry) => entry.value);
    expect(values).toEqual(["courage", "friendship", "kindness"]);
    expect(new Set(values).size).toBe(values.length);
  });

  it("gives every theme entry label and description metadata", () => {
    for (const entry of themeCatalog) {
      expect(entry.label).toBeTypeOf("string");
      expect(entry.label.length).toBeGreaterThan(0);
      expect(entry.description).toBeTypeOf("string");
      expect(entry.description.length).toBeGreaterThan(0);
    }
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
