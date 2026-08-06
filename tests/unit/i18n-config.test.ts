import { describe, expect, it } from "vitest";
import { getMessages } from "../../src/i18n/config";
import ptBR from "../../src/features/story-request/locales/pt-BR.json";
import {
  invalidInput,
  unsupportedLocale,
  unsafeUnrecoverable,
  rateLimited,
  generationUnavailable,
  generationTimeout,
} from "../../src/lib/http-errors";

describe("i18n message catalog", () => {
  it("returns the pt-BR baseline catalog for the default locale", () => {
    expect(getMessages("pt-BR")).toBe(ptBR);
  });

  it("falls back to pt-BR catalog when a catalog is not yet localised", () => {
    // English catalogs land in Phase 6 (US4); until then en falls back safely.
    expect(getMessages("en")).toBe(ptBR);
  });

  it("contains every messageKey referenced by the typed HTTP errors", () => {
    const catalog = ptBR as unknown as Record<string, unknown>;
    const keys = [
      invalidInput,
      unsupportedLocale,
      unsafeUnrecoverable,
      rateLimited,
      generationUnavailable,
      generationTimeout,
    ].map((e) => e.messageKey);

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

  it("exposes the baseline form and progress strings", () => {
    const story = ptBR.story as Record<string, Record<string, unknown>>;
    expect(story.form?.submit).toBe("Criar história");
    expect(story.progress?.generating).toBeTypeOf("string");
  });
});
