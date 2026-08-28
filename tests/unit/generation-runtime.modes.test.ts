import { describe, expect, it, beforeEach, vi } from "vitest";

/**
 * Mode/constructor coverage for the generation runtime (spec 015).
 *
 * These constructors are the public entry points that select the demo vs
 * playground runtime and the deterministic vs real provider. They must be
 * covered directly (not only transitively through the API route module) so the
 * per-file branch-coverage gate stays green even when the route module is not
 * imported by a given test file.
 */

async function load() {
  vi.resetModules();
  return (await import("../../src/features/story-generation/server/generation-runtime")) as typeof import("../../src/features/story-generation/server/generation-runtime");
}

describe("generation runtime mode constructors", () => {
  beforeEach(() => {
    delete process.env.STORIES_TEST_MODE;
  });

  it("createRuntimeForMode('demo') uses the deterministic offline provider", async () => {
    const { createRuntimeForMode } = await load();
    const runtime = createRuntimeForMode("demo");
    expect(typeof runtime.provider.generateStory).toBe("function");
    // Demo mode is always the fixed fake provider — no credentials required.
    const story = await runtime.provider.generateStory({
      ageBand: "5-7",
      locale: "pt-BR",
      theme: "courage",
      sceneCount: 3,
    });
    expect(story.scenes).toHaveLength(3);
  });

  it("createRuntimeForMode('playground') builds the real composite provider", async () => {
    const { createRuntimeForMode } = await load();
    const runtime = createRuntimeForMode("playground");
    expect(typeof runtime.provider.generateStory).toBe("function");
    expect(runtime.rateLimiter).toBeDefined();
    expect(runtime.salt).toBeTruthy();
  });

  it("createDemoRuntime() is the always-offline demo runtime", async () => {
    const { createDemoRuntime } = await load();
    const runtime = createDemoRuntime();
    const story = await runtime.provider.generateStory({
      ageBand: "5-7",
      locale: "pt-BR",
      theme: "courage",
      sceneCount: 3,
    });
    expect(story.scenes).toHaveLength(3);
  });

  it("resolveGenerationMode derives mode per request (anonymous→demo, auth→playground, fake forces demo)", async () => {
    const { resolveGenerationMode } = await load();
    expect(resolveGenerationMode(false)).toBe("demo");
    expect(resolveGenerationMode(true)).toBe("playground");
    process.env.STORIES_TEST_MODE = "fake";
    expect(resolveGenerationMode(true)).toBe("demo");
    expect(resolveGenerationMode(false)).toBe("demo");
  });
});
