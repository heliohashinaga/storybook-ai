import { describe, expect, it } from "vitest";
import { getMessages } from "../../src/i18n/config";
import ptBR from "../../src/features/story-request/locales/pt-BR.json";
import ptBRNarration from "../../src/features/story-read-aloud/locales/pt-BR.json";
import {
  invalidInput,
  unsupportedLocale,
  unsafeUnrecoverable,
  rateLimited,
  generationUnavailable,
  generationTimeout,
} from "../../src/lib/http-errors";

describe("i18n message catalog", () => {
  it("returns the pt-BR baseline catalog with narration keys merged", () => {
    const catalog = getMessages();
    // The base story-request strings are present.
    expect(catalog.story.form.submit).toBe("Criar história");
    // The story-read-aloud narration namespace is merged in.
    expect(catalog.story.narration.reading).toBe("Lendo a cena com voz de IA");
    expect(ptBRNarration).toBeDefined();
  });

  it("contains every messageKey referenced by the typed HTTP errors", () => {
    const catalog = getMessages() as unknown as Record<string, unknown>;
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
