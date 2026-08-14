import { describe, expect, it } from "vitest";
import { writeStory } from "../../../../src/features/story-generation/server/agents/writer";
import type {
  JobContext,
  Outline,
} from "../../../../src/features/story-generation/server/agents/types";
import { createFakeProvider } from "../../../fixtures/story-generation/provider-fixtures";

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

describe("writer agent", () => {
  it("writes a story with contiguous scene ordinals matching the outline", async () => {
    const fake = createFakeProvider({ scenario: "safe" });
    const result = await writeStory(ctx(), outline(3), { provider: fake.provider });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.scenes).toHaveLength(3);
      expect(result.value.scenes.map((s) => s.ordinal)).toEqual([1, 2, 3]);
      expect(result.value.scenes[0]!.body.length).toBeGreaterThan(0);
      expect(result.value.title.length).toBeGreaterThan(0);
    }
    expect(fake.generateCalls).toBe(1);
  });

  it("returns an Err on outline/candidate scene-count mismatch", async () => {
    const fake = createFakeProvider({ scenario: "safe" });
    const result = await writeStory(ctx(), outline(4), { provider: fake.provider });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.stage).toBe("write");
  });

  it("returns a transient Err on provider failure", async () => {
    const fake = createFakeProvider({ scenario: "unavailable" });
    const result = await writeStory(ctx(), outline(3), { provider: fake.provider });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.transient).toBe(true);
  });
});
