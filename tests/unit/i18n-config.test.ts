import { describe, expect, it } from "vitest";
import { getMessages } from "../../src/i18n/config";
import en from "../../src/features/story-request/locales/en.json";
import enNarration from "../../src/features/story-read-aloud/locales/en.json";
import {
  invalidInput,
  unsupportedLocale,
  unsafeUnrecoverable,
  rateLimited,
  generationUnavailable,
  generationTimeout,
} from "../../src/lib/http-errors";

describe("i18n message catalog", () => {
  it("returns the en baseline catalog with narration keys merged", () => {
    const catalog = getMessages();
    // The base story-request strings are present.
    expect(catalog.story.form.submit).toBe("Create story");
    // The story-read-aloud narration namespace is merged in.
    expect(catalog.story.narration.reading).toBe("Reading the scene with an AI voice");
    expect(enNarration).toBeDefined();
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
    const story = en.story as Record<string, Record<string, unknown>>;
    expect(story.form?.submit).toBe("Create story");
    expect(story.progress?.stagePlanning).toBeTypeOf("string");
    expect(story.progress?.stageWriting).toBeTypeOf("string");
    expect(story.progress?.stageIllustrating).toBeTypeOf("string");
  });
});
