import { describe, expect, it } from "vitest";
import { generateStory } from "../../src/features/story-generation/server/generate-story";

describe("generate-story — provider boundary", () => {
  it("throws when neither a provider nor a per-agent planner provider is given", async () => {
    await expect(
      generateStory({
        input,
        illustrate: async () => ({ dataUri: "data:image/webp;base64,AA==" }),
      })
    ).rejects.toThrow("generateStory requires a provider (single or per-agent).");
  });
});

import type {
  GeneratedStoryCandidate,
  ModerationDecision,
  ProviderStoryInput,
  StoryGenerationProvider,
} from "../../src/features/story-generation/server/story-generation-provider";

/**
 * SC-006 — **no partial story** (spec 005, T014b).
 *
 * When the image-routed provider fails (e.g. `unavailable`) *while* the
 * text/moderation side succeeds, the orchestrator must return a typed HTTP
 * error and **never** a story with a partial/incomplete illustration set.
 * This pins that invariant deterministically: a fake provider whose
 * moderation + text generation succeed but whose `illustrate` always rejects
 * must surface `generation_unavailable` (and, via the route, HTTP 502) — with
 * zillions of per-set retries exhausted rather than a half-illustrated story.
 */

const input: ProviderStoryInput = {
  ageBand: "5-7",
  locale: "pt-BR",
  theme: "courage",
  sceneCount: 3,
};

const safe: ModerationDecision = { safe: true };

/** A provider whose text + moderation succeed but illustration always fails. */
function makeTextOkImageFailingProvider(): StoryGenerationProvider {
  const candidate: GeneratedStoryCandidate = {
    title: "A estrelinha e o mar",
    scenes: [1, 2, 3].map((ordinal) => ({
      ordinal,
      title: `Cena ${ordinal}`,
      body: `Texto da cena ${ordinal}.`,
      illustrationPrompt: `Ilustração da cena ${ordinal}.`,
    })),
  };
  return {
    generateStory: async (): Promise<GeneratedStoryCandidate> => candidate,
    moderateText: async (): Promise<ModerationDecision> => safe,
    moderateImage: async (): Promise<ModerationDecision> => safe,
  };
}

describe("no-partial-story invariant (SC-006, T014b)", () => {
  it("returns generation_unavailable (never a partial story) when illustration fails after a safe story", async () => {
    const provider = makeTextOkImageFailingProvider();
    const failingIllustrate = (): Promise<{ dataUri: string }> => {
      throw new Error("image provider unavailable");
    };

    const result = await generateStory({
      input,
      provider,
      illustrate: failingIllustrate,
      imageRetries: 2, // exercise the bounded whole-set retry exhaust path
      illustrationConcurrency: 2,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      // Typed, localized, safe HTTP-mapped error — never a story payload.
      expect(result.error.code).toBe("generation_unavailable");
      expect(result.error).not.toHaveProperty("title");
      expect(result.error).not.toHaveProperty("scenes");
    }
  });

  it("never returns a scene with an empty/missing illustrationDataUri when the set failed", async () => {
    const provider = makeTextOkImageFailingProvider();
    // Simulate a provider returning invalid (non-WebP / oversized) output on
    // every retry — the set stays incomplete and must not slip through.
    const invalidIllustrate = async (): Promise<{ dataUri: string }> => ({
      dataUri: "not-a-data-uri",
    });

    const result = await generateStory({
      input,
      provider,
      illustrate: invalidIllustrate,
      imageRetries: 1,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("generation_unavailable");
    }
    // There is no `ok: true` story branch here, so no partial set can exist.
    if ("story" in result) {
      throw new Error("a failed illustration set must not produce a story");
    }
  });

  it("succeeds with a full illustration set when the image provider works", async () => {
    const provider = makeTextOkImageFailingProvider();
    const goodIllustrate = async (): Promise<{ dataUri: string }> => ({
      dataUri: "data:image/webp;base64,QUJDRA==",
    });

    const result = await generateStory({
      input,
      provider,
      illustrate: goodIllustrate,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.story.sceneCount).toBe(3);
      expect(result.story.scenes).toHaveLength(3);
      for (const scene of result.story.scenes) {
        expect(scene.illustrationDataUri).toMatch(/^data:image\/webp;base64,/);
      }
    }
  });
});
