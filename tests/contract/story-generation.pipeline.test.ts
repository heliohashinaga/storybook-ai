import { describe, expect, it, vi } from "vitest";
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
 * T014 — pipeline contract: end-to-end multi-agent behavior through the
 * public `generateStory` entry. Verifies the Coordinator assembles a complete,
 * validated story only when the whole pipeline (safety gate → plan → write →
 * illustrate) succeeds.
 */
describe("multi-agent pipeline contract (T014)", () => {
  it("returns a complete story with an illustration per scene", async () => {
    const fake = createFakeProvider({ scenario: "safe" });
    const result = await generateStory({
      input,
      provider: fake.provider,
      illustrate: async () => ({ dataUri: WEBP }),
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.story.sceneCount).toBe(3);
      expect(result.story.scenes).toHaveLength(3);
      for (const scene of result.story.scenes) {
        expect(scene.illustrationDataUri.startsWith("data:image/webp;base64,")).toBe(true);
      }
    }
  });

  it("propagates a transient generation_unavailable error on provider failure", async () => {
    const fake = createFakeProvider({ scenario: "unavailable" });
    const result = await generateStory({
      input,
      provider: fake.provider,
      illustrate: async () => ({ dataUri: WEBP }),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("generation_unavailable");
  });

  it("never returns a partial illustration set", async () => {
    const fake = createFakeProvider({ scenario: "safe" });
    const result = await generateStory({
      input,
      provider: fake.provider,
      illustrate: async () => {
        throw new Error("image down");
      },
      imageRetries: 1,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("generation_unavailable");
  });

  it("does not issue illustration prompts when the narrative is unsafe (no partial work)", async () => {
    const fake = createFakeProvider({ scenario: "double-unsafe" });
    const illustrate = vi.fn(async () => ({ dataUri: WEBP }));
    const result = await generateStory({ input, provider: fake.provider, illustrate });
    expect(result.ok).toBe(false);
    expect(illustrate).not.toHaveBeenCalled();
  });
});
