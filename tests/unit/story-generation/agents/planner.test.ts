import { describe, expect, it } from "vitest";
import {
  planStory,
  providerInputFor,
  purposeFor,
} from "../../../../src/features/story-generation/server/agents/planner";
import type { JobContext } from "../../../../src/features/story-generation/server/agents/types";
import type { ModeratedStoryCandidate } from "../../../../src/features/story-generation/server/safety-pipeline";
import { buildSafeCandidate } from "../../../fixtures/story-generation/provider-fixtures";

function ctx(overrides: Partial<JobContext> = {}): JobContext {
  return {
    ageBand: "5-7",
    locale: "pt-BR",
    theme: "friendship",
    sceneCountRequested: 3,
    generationToken: "token",
    ...overrides,
  };
}

function approved(sceneCount: number): ModeratedStoryCandidate {
  const base = buildSafeCandidate({
    ageBand: "5-7",
    locale: "pt-BR",
    theme: "friendship",
    sceneCount,
  });
  return { ...base, safetyDecision: "approved" };
}

describe("planner agent", () => {
  it("produces an outline with one scene pSer scene countRequested", () => {
    const result = planStory(ctx({ sceneCountRequested: 4 }), approved(4));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.scenes).toHaveLength(4);
      const first = result.value.scenes[0]!;
      const last = result.value.scenes[3]!;
      expect(first.index).toBe(1);
      expect(last.index).toBe(4);
      expect(first.purpose).toBe("scene-1-friendship");
    }
  });

  it("returns an Err when the approved candidate has too few scenes", () => {
    const result = planStory(ctx({ sceneCountRequested: 3 }), approved(2));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.stage).toBe("plan");
    }
  });

  it("returns an Err when the scene count mismatches the request", () => {
    const result = planStory(ctx({ sceneCountRequested: 5 }), approved(3));
    expect(result.ok).toBe(false);
  });

  it("purposeFor is theme-aligned and identifier-free", () => {
    expect(purposeFor(ctx({ theme: "courage" }), 2)).toBe("scene-2-bravery");
    expect(purposeFor(ctx({ theme: "kindness" }), 1)).toBe("scene-1-kindness");
  });

  it("providerInputFor only exposes anonymous fields", () => {
    const input = providerInputFor(ctx());
    expect(input).toEqual({ ageBand: "5-7", locale: "pt-BR", theme: "friendship", sceneCount: 3 });
    expect(input).not.toHaveProperty("name");
    expect(input).not.toHaveProperty("age");
  });
});
