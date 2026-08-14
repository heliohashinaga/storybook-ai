import { describe, expect, it } from "vitest";
import { moderateStory } from "../../../../src/features/story-generation/server/agents/moderator";
import type {
  JobContext,
  WrittenScene,
  WrittenStory,
} from "../../../../src/features/story-generation/server/agents/types";
import { createFakeProvider } from "../../../fixtures/story-generation/provider-fixtures";

function ctx(): JobContext {
  return {
    ageBand: "5-7",
    locale: "pt-BR",
    theme: "courage",
    sceneCountRequested: 3,
    generationToken: "token",
  };
}

function mkWritten(overrides: Partial<WrittenScene> = {}): WrittenStory {
  const bodyTexts: (string | undefined)[] = [
    overrides.body ?? "A brave little fox explored the forest.",
    "She found a hidden path.",
    "At the end she smiled, knowing she was safe.",
  ];
  return {
    title: "A Brave Journey",
    scenes: [1, 2, 3].map((i) => ({
      ordinal: i,
      title: `Scene ${i}`,
      body: bodyTexts[i - 1] ?? `Scene ${i} body`,
      illustrationPrompt: `watercolor scene ${i}`,
    })),
  };
}

describe("moderator agent", () => {
  it("approves a safe narrative", async () => {
    const fake = createFakeProvider({ scenario: "safe" });
    const result = await moderateStory(ctx(), mkWritten(), { provider: fake.provider });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.scenes).toHaveLength(3);
    }
  });

  it("returns unsafe_unrecoverable when content stays unsafe after regeneration", async () => {
    const fake = createFakeProvider({ scenario: "double-unsafe" });
    const result = await moderateStory(ctx(), mkWritten({ body: "unsafecontent text" }), {
      provider: fake.provider,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.transient).toBe(false);
      expect(result.errorCode).toBe("unsafe_unrecoverable");
    }
  });
});
