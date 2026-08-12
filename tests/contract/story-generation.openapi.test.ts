import { describe, expect, it } from "vitest";
import {
  generateRequestSchema,
  storyResponseSchema,
  safeErrorSchema,
  type GeneratedStory,
} from "../../src/features/story-generation/server/schemas";
import {
  invalidInput,
  unsupportedLocale,
  unsafeUnrecoverable,
  rateLimited,
  generationUnavailable,
  generationTimeout,
  toErrorJson,
} from "../../src/lib/http-errors";

/**
 * Contract test for `POST /api/stories` against
 * `specs/001-personalized-story-generation/contracts/story-generation.openapi.yaml`.
 *
 * This test locks the wire contract encoded in the Phase 2 Zod schemas and
 * `http-errors` primitives: only the three allow-listed request fields; a
 * strict three-scene response with WebP data-URI illustrations; the
 * `Cache-Control: no-store` response header; and typed 400/422/429/502/504
 * error bodies with a stable `code` + localized `messageKey` + `retryable`.
 *
 * Route-level HTTP assertions (real status codes and headers from the handler)
 * live in `tests/contract/stories-route.test.ts` (T028), which asserts
 * `Cache-Control: no-store` on success and every error response.
 */

const request = { ageBand: "5-7", locale: "pt-BR", theme: "courage" } as const;

const webpDataUri = "data:image/webp;base64,UklGRlIAAABXRUJQVlA4";

function validScene(ordinal: number) {
  return {
    ordinal,
    title: `Scene ${ordinal}`,
    body: `Body text for scene ${ordinal}.`,
    illustrationDataUri: webpDataUri,
    altText: `Alt text for scene ${ordinal}.`,
  };
}

function validStory(): GeneratedStory {
  return {
    locale: "pt-BR",
    ageBand: "5-7",
    theme: "courage",
    sceneCount: 3,
    safetyDecision: "approved",
    title: "A pequena aventura na ponte",
    scenes: [validScene(1), validScene(2), validScene(3)],
  };
}

describe("POST /api/stories — request contract (GenerateStoryRequest)", () => {
  it("accepts exactly the three allow-listed fields", () => {
    expect(generateRequestSchema.safeParse(request).success).toBe(true);
  });

  it.each([
    ["2-4", "pt-BR", "courage"],
    ["5-7", "pt-BR", "friendship"],
    ["8-9", "en", "kindness"],
  ] as const)("accepts ageBand %s / locale %s / theme %s", (ageBand, locale, theme) => {
    expect(generateRequestSchema.safeParse({ ageBand, locale, theme }).success).toBe(true);
  });

  it("rejects a name or any other direct-identifier field", () => {
    const result = generateRequestSchema.safeParse({ ...request, name: "Luna" });
    expect(result.success).toBe(false);
  });

  it("rejects any unknown field (strict object)", () => {
    expect(generateRequestSchema.safeParse({ ...request, exactAge: 6 }).success).toBe(false);
  });

  it("rejects a missing field", () => {
    const missingTheme = { ageBand: request.ageBand, locale: request.locale } as const;
    expect(generateRequestSchema.safeParse(missingTheme).success).toBe(false);
  });

  it("rejects out-of-range enum values", () => {
    expect(generateRequestSchema.safeParse({ ...request, ageBand: "0-1" }).success).toBe(false);
    expect(generateRequestSchema.safeParse({ ...request, locale: "fr" }).success).toBe(false);
    expect(generateRequestSchema.safeParse({ ...request, theme: "honesty" }).success).toBe(false);
  });
});

describe("POST /api/stories — response contract (GeneratedStory)", () => {
  it("accepts a valid three-scene story", () => {
    expect(storyResponseSchema.safeParse(validStory()).success).toBe(true);
  });

  it("accepts 3–5 scenes and rejects out-of-range counts", () => {
    const two = validStory();
    two.scenes = [validScene(1), validScene(2)];
    two.sceneCount = 2;
    const four = validStory();
    four.scenes = [validScene(1), validScene(2), validScene(3), validScene(4)];
    four.sceneCount = 4;
    const six = validStory();
    six.scenes = [
      validScene(1),
      validScene(2),
      validScene(3),
      validScene(4),
      validScene(5),
      validScene(6),
    ];
    six.sceneCount = 6;
    expect(storyResponseSchema.safeParse(two).success).toBe(false);
    expect(storyResponseSchema.safeParse(four).success).toBe(true);
    expect(storyResponseSchema.safeParse(six).success).toBe(false);
  });

  it("requires WebP data-URI illustrations (no object-store URL or raw bytes)", () => {
    const story = validStory();
    const [firstScene] = story.scenes;
    if (!firstScene) throw new Error("expected a scene");
    firstScene.illustrationDataUri = "https://cdn.example.com/img/1.webp";
    const result = storyResponseSchema.safeParse(story);
    expect(result.success).toBe(false);
  });

  it("accepts both safetyDecision values and rejects unknown ones", () => {
    const regenerated = validStory();
    regenerated.safetyDecision = "regenerated";
    expect(storyResponseSchema.safeParse(regenerated).success).toBe(true);
    const invalid = { ...validStory(), safetyDecision: "unsafe" } as unknown as GeneratedStory;
    expect(storyResponseSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects an unknown or direct-identifier response field (strict object)", () => {
    expect(storyResponseSchema.safeParse({ ...validStory(), childName: "Luna" }).success).toBe(
      false
    );
  });

  it("validates same-family theme/ageBand/locale enums on the response", () => {
    const story = { ...validStory(), theme: "honesty" } as unknown as GeneratedStory;
    expect(storyResponseSchema.safeParse(story).success).toBe(false);
  });
});

describe("POST /api/stories — error contract (GenerationError + status codes)", () => {
  // Truth table straight from the OpenAPI response map.
  const statusMap: ReadonlyArray<[number, typeof invalidInput | typeof rateLimited]> = [
    [400, invalidInput],
    [422, unsafeUnrecoverable],
    [429, rateLimited],
    [502, generationUnavailable],
    [504, generationTimeout],
  ];

  it.each(statusMap)("maps HTTP %s to the correct error primitive", (status, error) => {
    expect(error.status).toBe(status);
  });

  it("maps 422 unsupported locale to the correct code", () => {
    expect(unsupportedLocale.status).toBe(422);
    expect(unsupportedLocale.code).toBe("unsupported_locale");
  });

  it("marks field-level/validate errors as non-retryable and provider errors as retryable", () => {
    expect(invalidInput.retryable).toBe(false);
    expect(unsupportedLocale.retryable).toBe(false);
    expect(unsafeUnrecoverable.retryable).toBe(true);
    expect(rateLimited.retryable).toBe(true);
    expect(generationUnavailable.retryable).toBe(true);
    expect(generationTimeout.retryable).toBe(true);
  });

  it("renders a wire-safe body with code + messageKey + retryable only", () => {
    expect(toErrorJson(invalidInput)).toEqual({
      code: "invalid_input",
      messageKey: "story.error.invalidInput",
      retryable: false,
    });
  });

  describe.each([
    ["400", invalidInput],
    ["422", unsafeUnrecoverable],
    ["429", rateLimited],
    ["502", generationUnavailable],
    ["504", generationTimeout],
  ] as const)("HTTP %s error body", (_status, error) => {
    it("matches the safeErrorSchema wire shape", () => {
      expect(safeErrorSchema.safeParse(toErrorJson(error)).success).toBe(true);
    });

    it("never leaks a raw provider message", () => {
      const body = toErrorJson(error);
      expect(JSON.stringify(body)).not.toMatch(/provider|openai|status|stack|undefined/i);
    });
  });
});

describe("POST /api/stories — response header contract", () => {
  it("has retryable=true on the 429 so the client knows it may retry after cooling off", () => {
    expect(rateLimited.retryable).toBe(true);
  });
});
