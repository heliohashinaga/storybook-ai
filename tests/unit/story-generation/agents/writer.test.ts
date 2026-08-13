import { describe, expect, it } from "vitest";
import { writeStory } from "../../../../src/features/story-generation/server/agents/writer";
import type {
  JobContext,
  Outline,
} from "../../../../src/features/story-generation/server/agents/types";
import type { ModeratedStoryCandidate } from "../../../../src/features/story-generation/server/safety-pipeline";
import { buildSafeCandidate } from "../../../fixtures/story-generation/provider-fixtures";

function ctx(): JobContext {
  return {
    ageBand: "8-9",
    locale: "en",
    theme: "courage",
    sceneCountRequested: 3,
    generationToken: "token",
  };
}

function outline(sceneCount: number): Outline {
  return {
    scenes: Array.from({ length: sceneCount }, (_, i) => ({
      index: i + 1,
      purpose: `scene-${i + 1}-bravery`,
    })),
  };
}

function approved(sceneCount: number): ModeratedStoryCandidate {
  const base = buildSafeCandidate({
    ageBand: "8-9",
    locale: "en",
    theme: "courage",
    sceneCount,
  });
  return { ...base, safetyDecision: "approved" };
}

describe("writer agent", () => {
  it("writes a story with contiguous scene ordinals matching the outline", () => {
    const result = writeStory(ctx(), outline(3), approved(3));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.scenes).toHaveLength(3);
      expect(result.value.scenes.map((s) => s.ordinal)).toEqual([1, 2, 3]);
      const first = result.value.scenes[0]!;
      expect(first.body.length).toBeGreaterThan(0);
      expect(first.illustrationPrompt.length).toBeGreaterThan(0);
      expect(result.value.title.length).toBeGreaterThan(0);
    }
  });

  it("returns an Err on outline/candidate scene-count mismatch", () => {
    const result = writeStory(ctx(), outline(3), approved(4));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.stage).toBe("write");
  });

  it("returns an Err when the approved narrative is malformed", () => {
    const result = writeStory(ctx(), outline(3), {
      title: "",
      scenes: [],
      safetyDecision: "approved",
    });
    expect(result.ok).toBe(false);
  });
});
