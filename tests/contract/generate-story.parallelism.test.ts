import { describe, expect, it } from "vitest";
import { generateStory } from "../../src/features/story-generation/server/generate-story";
import type { ProviderStoryInput } from "../../src/features/story-generation/server/story-generation-provider";
import { createFakeProvider } from "../fixtures/story-generation/provider-fixtures";

const WEBP = "data:image/webp;base64,QUJDRA==";

const input: ProviderStoryInput = {
  ageBand: "5-7",
  locale: "pt-BR",
  theme: "friendship",
  sceneCount: 5,
};

/**
 * T035 — parallelism: the multi-agent Coordinator orchestrates dependent
 * stages serially (safety gate → plan → write → illustrate) while a single
 * stage's illustration work runs with a *bounded* concurrency (ADR 0005). This
 * pins that parallelism never exceeds the configured limit.
 */
describe("pipeline parallelism (T035)", () => {
  it("limits concurrent illustration work to the configured concurrency", async () => {
    const fake = createFakeProvider({ scenario: "safe" });
    let inFlight = 0;
    let peak = 0;
    const illustrate = async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight -= 1;
      return { dataUri: WEBP };
    };

    const result = await generateStory({
      input,
      provider: fake.provider,
      illustrate,
      illustrationConcurrency: 1,
    });
    expect(result.ok).toBe(true);
    expect(peak).toBeLessThanOrEqual(1);
  });

  it("delivers all requested scenes even with a high concurrent illustration limit", async () => {
    const fake = createFakeProvider({ scenario: "safe" });
    const result = await generateStory({
      input,
      provider: fake.provider,
      illustrate: async () => ({ dataUri: WEBP }),
      illustrationConcurrency: 5,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.story.scenes).toHaveLength(5);
  });
});
