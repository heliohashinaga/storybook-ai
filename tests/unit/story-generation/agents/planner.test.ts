import { describe, expect, it } from "vitest";
import {
  planStory,
  providerInputFor,
  purposeFor,
} from "../../../../src/features/story-generation/server/agents/planner";
import type { JobContext } from "../../../../src/features/story-generation/server/agents/types";
import { createFakeProvider } from "../../../fixtures/story-generation/provider-fixtures";

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

describe("planner agent", () => {
  it("plans an outline by calling its own provider (genuine planning)", async () => {
    const fake = createFakeProvider({ scenario: "safe" });
    const result = await planStory(ctx({ sceneCountRequested: 4 }), {
      provider: fake.provider,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.scenes).toHaveLength(4);
      expect(result.value.scenes[0]!.index).toBe(1);
      expect(result.value.scenes[3]!.index).toBe(4);
      expect(result.value.scenes[0]!.purpose).toBe("scene-1-friendship");
    }
    expect(fake.generateCalls).toBe(1);
  });

  it("returns an Err when the provider returns too few scenes", async () => {
    const fake = createFakeProvider({ scenario: "invalid" });
    const result = await planStory(ctx({ sceneCountRequested: 3 }), {
      provider: fake.provider,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.stage).toBe("plan");
  });

  it("returns an Err when the scene count mismatches the request", async () => {
    const fake = createFakeProvider({ scenario: "invalid" });
    const result = await planStory(ctx({ sceneCountRequested: 5 }), {
      provider: fake.provider,
    });
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
