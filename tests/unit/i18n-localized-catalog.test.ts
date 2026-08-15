import { describe, expect, it } from "vitest";
import { getMessages } from "../../src/i18n/config";
import { routing } from "../../src/i18n/routing";
import ptBR from "../../src/features/story-request/locales/pt-BR.json";
import en from "../../src/features/story-request/locales/en.json";
import ptBRNarration from "../../src/features/story-read-aloud/locales/pt-BR.json";
import enNarration from "../../src/features/story-read-aloud/locales/en.json";

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

/** Merge feature catalogs exactly like i18n/config does, for structural checks. */
function deepMerge<TBase, TExtra>(base: TBase, extra: TExtra): TBase & TExtra {
  if (
    base &&
    extra &&
    typeof base === "object" &&
    typeof extra === "object" &&
    !Array.isArray(base) &&
    !Array.isArray(extra)
  ) {
    const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
    for (const [key, value] of Object.entries(extra as Record<string, unknown>)) {
      const existing = (base as Record<string, unknown>)[key];
      out[key] =
        existing !== undefined && value && typeof existing === "object" && typeof value === "object"
          ? deepMerge(existing, value)
          : value;
    }
    return out as TBase & TExtra;
  }
  return extra as TBase & TExtra;
}

const mergedPt = deepMerge(ptBR, ptBRNarration);
const mergedEn = deepMerge(en, enNarration);

describe("i18n message catalog (EN + pt-BR)", () => {
  it("exposes a complete catalog (base + narration) for every supported locale", () => {
    for (const locale of routing.locales) {
      const catalog = getMessages(locale);
      expect(catalog).toBeDefined();
      expect(catalog.story.narration).toBeDefined();
    }
  });

  it("pt-BR and en catalogs share the exact same key structure", () => {
    const ptPaths = leafPaths(mergedPt).sort();
    const enPaths = leafPaths(mergedEn).sort();
    expect(enPaths).toEqual(ptPaths);
  });

  it("defaults to the en baseline when locale is absent or unsupported", () => {
    const base = getMessages();
    expect(base.story.form.submit).toBe("Create story");
    expect(base.story.narration.reading).toBeTypeOf("string");
    expect(getMessages("es" as never).story.form.submit).toBe("Create story");
  });

  it("returns the English catalog for the en locale", () => {
    expect(getMessages("en").story.narration.reading).toBe("Reading the scene with an AI voice");
  });

  it("en catalog is genuinely translated (not a copy of pt-BR)", () => {
    const story = getMessages("en").story as unknown as Record<string, Record<string, unknown>>;
    expect(story.form?.submit).not.toBe(ptBR.story.form.submit);
    expect(story.form?.submit).toBeTypeOf("string");
    expect(story.reader?.sceneLabel).toBeTypeOf("string");
    expect(story.narration?.reading).not.toBe(ptBRNarration.story.narration.reading);
  });

  it("contains every messageKey referenced by the typed HTTP errors (en)", () => {
    const catalog = getMessages("en") as unknown as Record<string, unknown>;
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
