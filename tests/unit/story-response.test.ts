import { describe, expect, it } from "vitest";
import {
  generateRequestSchema,
  storyResponseSchema,
} from "../../src/features/story-generation/server/schemas";

const request = { ageBand: "5-7", locale: "pt-BR", theme: "courage" } as const;

const dataUri = "data:image/webp;base64,AAAA";

function validScene(ordinal: number) {
  return {
    ordinal,
    title: `Scene ${ordinal}`,
    body: `Body text for scene ${ordinal}.`,
    illustrationDataUri: dataUri,
    altText: `Alt text for scene ${ordinal}.`,
  };
}

function validStory() {
  return {
    locale: "pt-BR",
    ageBand: "5-7",
    theme: "courage",
    safetyDecision: "approved",
    title: "A timely adventure",
    scenes: [validScene(1), validScene(2), validScene(3)],
  };
}

describe("GenerateStoryRequest schema", () => {
  it("accepts only ageBand, locale, and theme", () => {
    expect(generateRequestSchema.safeParse(request).success).toBe(true);
  });

  it("rejects an unknown or direct-identifier field such as name", () => {
    const result = generateRequestSchema.safeParse({ ...request, name: "Luna" });
    expect(result.success).toBe(false);
  });

  it("rejects an unsupported theme and age band", () => {
    expect(generateRequestSchema.safeParse({ ...request, theme: "spooky" }).success).toBe(false);
    expect(generateRequestSchema.safeParse({ ...request, ageBand: "99" }).success).toBe(false);
  });
});

describe("three-scene safe story schema", () => {
  it("accepts a complete three-scene approved story", () => {
    expect(storyResponseSchema.safeParse(validStory()).success).toBe(true);
  });

  it("rejects a story that is not exactly three scenes", () => {
    const twoScenes = { ...validStory(), scenes: [validScene(1), validScene(2)] };
    expect(storyResponseSchema.safeParse(twoScenes).success).toBe(false);
  });

  it("rejects an unknown or direct-identifier field", () => {
    const withName = { ...validStory(), name: "Luna" };
    expect(storyResponseSchema.safeParse(withName).success).toBe(false);
  });

  it("rejects a scene whose illustration is not an optimized webp data URI", () => {
    const badScene = {
      ...validStory(),
      scenes: [
        validScene(1),
        validScene(2),
        { ...validScene(3), illustrationDataUri: "https://cdn.example.com/a.png" },
      ],
    };
    expect(storyResponseSchema.safeParse(badScene).success).toBe(false);
  });

  it("accepts a regenerated (safety-approved) story", () => {
    const regen = { ...validStory(), safetyDecision: "regenerated" };
    expect(storyResponseSchema.safeParse(regen).success).toBe(true);
  });
});
