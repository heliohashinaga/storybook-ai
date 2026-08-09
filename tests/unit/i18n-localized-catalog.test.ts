import { describe, expect, it } from "vitest";
import { getMessages } from "../../src/i18n/config";
import { routing } from "../../src/i18n/routing";
import ptBR from "../../src/features/story-request/locales/pt-BR.json";
import en from "../../src/features/story-request/locales/en.json";

/** Recursively collect the full leaf-key path set of a catalog. */
function leafPaths(node: unknown, prefix = ""): string[] {
  if (!node || typeof node !== "object") return [prefix];
  const paths: string[] = [];
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object") {
      paths.push(...leafPaths(value, path));
    } else {
      paths.push(path);
    }
  }
  return paths;
}

describe("i18n message catalog (EN + pt-BR)", () => {
  it("exposes a complete English catalog for every supported locale", () => {
    for (const locale of routing.locales) {
      expect(getMessages(locale)).toBeDefined();
    }
  });

  it("pt-BR and en catalogs share the exact same key structure", () => {
    const ptPaths = leafPaths(ptBR).sort();
    const enPaths = leafPaths(en).sort();
    expect(enPaths).toEqual(ptPaths);
  });

  it("defaults to the pt-BR baseline when locale is absent or unsupported", () => {
    expect(getMessages()).toBe(ptBR);
    expect(getMessages("pt-BR")).toBe(ptBR);
    expect(getMessages("es" as never)).toBe(ptBR);
  });

  it("returns the English catalog for the en locale", () => {
    expect(getMessages("en")).toBe(en);
  });

  it("en catalog is genuinely translated (not a copy of pt-BR)", () => {
    const story = en.story as Record<string, Record<string, unknown>>;
    expect(story.form?.submit).not.toBe(ptBR.story.form.submit);
    expect(story.form?.submit).toBeTypeOf("string");
    expect(story.reader?.sceneLabel).toBeTypeOf("string");
  });

  it("contains every messageKey referenced by the typed HTTP errors (en)", () => {
    const catalog = en as unknown as Record<string, unknown>;
    const keys = [
      "story.error.invalidInput",
      "story.error.unsupportedLocale",
      "story.error.safeAlternativeUnavailable",
      "story.error.tryAgainLater",
      "story.error.generationUnavailable",
      "story.error.generationTimeout",
    ];
    const atPath = (path: string): unknown =>
      path.split(".").reduce<unknown>((acc, part) => {
        if (acc && typeof acc === "object") {
          return (acc as Record<string, unknown>)[part];
        }
        return undefined;
      }, catalog);
    for (const key of keys) {
      expect(atPath(key)).toBeTypeOf("string");
    }
  });
});
