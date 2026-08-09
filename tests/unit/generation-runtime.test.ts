import { describe, expect, it, beforeEach, vi } from "vitest";

/**
 * Generation-runtime provider selection. The runtime picks between the
 * deterministic fake provider (e2e/visual/dev) and the production OpenRouter
 * provider based solely on the `STORIES_PROVIDER` env selector, so tests may
 * pin the wiring without needing any live AI or provider credentials.
 */
async function loadRuntime() {
  vi.resetModules();
  return await import("../../src/features/story-generation/server/generation-runtime");
}

describe("createGenerationRuntime provider selection", () => {
  beforeEach(() => {
    delete process.env.STORIES_PROVIDER;
  });

  it("selects the deterministic fixed provider when STORIES_PROVIDER=fake", async () => {
    process.env.STORIES_PROVIDER = "fake";
    const runtime = (await loadRuntime()).createGenerationRuntime();
    // The fake provider returns a fixed, safe, anonymous pt-BR story.
    const story = await runtime.provider.generateStory({
      ageBand: "5-7",
      locale: "pt-BR",
      theme: "courage",
    });
    expect(story.scenes).toHaveLength(3);
    expect(JSON.stringify(story)).not.toMatch(/"name"/i);
    // Fake illustration is a valid WebP data URI, deterministic per scene.
    const illustration = await runtime.illustrate("any prompt");
    expect(illustration.dataUri).toMatch(/^data:image\/webp;base64,/);
  });

  it("selects an English story from the fixed provider when locale=en (US4)", async () => {
    process.env.STORIES_PROVIDER = "fake";
    const runtime = (await loadRuntime()).createGenerationRuntime();
    const story = await runtime.provider.generateStory({
      ageBand: "8-12",
      locale: "en",
      theme: "friendship",
    });
    expect(story.scenes).toHaveLength(3);
    expect(story.title).toMatch(/star/i);
    expect(story.scenes[0]!.title).toMatch(/scene/i);
    expect(JSON.stringify(story)).not.toMatch(/estrelinha/i);
    expect(JSON.stringify(story)).not.toMatch(/[áàâãçéêíóôõúü]/i);
  });

  it("selects the real OpenRouter provider by default", async () => {
    const runtime = (await loadRuntime()).createGenerationRuntime();
    // Can't inspect the private closure, so assert the rate limiter + salt
    // seams are present and provider adapters exist (providers are lazily
    // built so no credentials are required at construction time).
    expect(runtime.rateLimiter).toBeDefined();
    expect(runtime.salt).toBeTruthy();
    expect(typeof runtime.provider.generateStory).toBe("function");
    expect(typeof runtime.illustrate).toBe("function");
  });
});
