import { describe, expect, it } from "vitest";
import { generateStory } from "../../src/features/story-generation/server/generate-story";
import type { ProviderStoryInput } from "../../src/features/story-generation/server/story-generation-provider";
import { createFakeProvider } from "../fixtures/story-generation/provider-fixtures";

const WEBP = "data:image/webp;base64,QUJDRA==";

const input: ProviderStoryInput = {
  ageBand: "5-7",
  locale: "pt-BR",
  theme: "courage",
  sceneCount: 3,
};

/**
 * T015 — throttling / retry: the pipeline uses a *bounded* retry for transient
 * stage failures (default 2 attempts) and never retries forever. A provider
 * that keeps failing must not exceed the bounded attempt count.
 */
describe("pipeline throttling + retry (T015)", () => {
  it("bounded retries never exceed the documented max attempts", async () => {
    const fake = createFakeProvider({ scenario: "unavailable" });
    const result = await generateStory({
      input,
      provider: fake.provider,
      illustrate: async () => ({ dataUri: WEBP }),
    });
    expect(result.ok).toBe(false);
    // The safety gate observes at most the bounded attempt count (default 2).
    expect(fake.generateCalls).toBeLessThanOrEqual(2);
  });
});
