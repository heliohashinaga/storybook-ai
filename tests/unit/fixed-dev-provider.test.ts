import { describe, expect, it, vi } from "vitest";
import {
  createFixedDevProvider,
  createFakePhasedDelay,
  createFixedDevIllustration,
  FIXED_ILLUSTRATION_DATA_URI,
  UNSAFE_MARKER,
} from "../../src/features/story-generation/server/fixed-dev-provider";
import type { FakeLoadPhase } from "../../src/features/story-generation/server/fixed-dev-provider";
import type { ProviderStoryInput } from "../../src/features/story-generation/server/story-generation-provider";

/** Detachable, instant fake-load provider so a story build runs synchronously. */
const noopProvider = createFixedDevProvider({
  wait: async () => {},
  reset: () => {},
} as ReturnType<typeof createFakePhasedDelay>);

const input: ProviderStoryInput = {
  ageBand: "5-7",
  locale: "pt-BR",
  theme: "friendship",
  sceneCount: 5,
};

describe("createFixedDevProvider — deterministic fake story generation", () => {
  it("builds a 5-scene story with the requested count and valid ordinals", async () => {
    const story = await noopProvider.generateStory(input);
    expect(story.title).toBeTruthy();
    expect(story.scenes).toHaveLength(5);
    expect(story.scenes.map((s) => s.ordinal)).toEqual([1, 2, 3, 4, 5]);
    // The catalog (spec 012) is active for this grid: illustrationPrompt is a catalog
    // marker the dev illustrator resolves to the captured WebP per scene.
    expect(story.scenes[4]!.illustrationPrompt).toMatch(/^catalog:\/\//);
    for (const scene of story.scenes) {
      expect(scene.body.length).toBeGreaterThan(0);
      expect(scene.illustrationPrompt.length).toBeGreaterThan(0);
    }
  });

  it("builds exactly 3 scenes when that is all that is requested", async () => {
    const story = await noopProvider.generateStory({ ...input, sceneCount: 3 });
    expect(story.scenes).toHaveLength(3);
    expect(story.scenes.map((s) => s.ordinal)).toEqual([1, 2, 3]);
  });

  it("localizes the opening scene for the en locale", async () => {
    const story = await noopProvider.generateStory({ ...input, locale: "en" });
    expect(story.scenes[0]!.body.length).toBeGreaterThan(0);
    expect(story.scenes[0]!.illustrationPrompt).toMatch(/^catalog:\/\//);
  });

  it("moderates image prompts: flags unsafe, approves safe text and images", async () => {
    expect(await noopProvider.moderateImage(`${UNSAFE_MARKER} illustration`)).toEqual({
      safe: false,
      reason: expect.any(String),
    });
    expect(await noopProvider.moderateImage("a calm meadow at dusk")).toEqual({ safe: true });
    expect(await noopProvider.moderateText("a friendly conversation about courage")).toEqual({
      safe: true,
    });
  });

  it("exports a deterministic webp illustration data URI for fake readers", async () => {
    expect(FIXED_ILLUSTRATION_DATA_URI).toMatch(/^data:image\/webp;base64,/);
  });

  it("resets the paid-phase tracker so each generation re-pays the fake load (UX-012)", async () => {
    // Regression: the dev provider used to share one `paid` Set across requests,
    // so the 2nd generation skipped the delay and completed in ~0ms (no progress
    // UI). reset() on generateStory must make every generation re-delay.
    const pays: FakeLoadPhase[] = [];
    const phaseDelay = createFakePhasedDelay(async (phase) => {
      pays.push(phase);
    });
    const provider = createFixedDevProvider(phaseDelay);
    const input: ProviderStoryInput = {
      ageBand: "5-7",
      locale: "pt-BR",
      theme: "courage",
      sceneCount: 3,
    };
    await provider.generateStory(input);
    await provider.generateStory(input);
    // Each generation must re-pay the write phase (reset works). Without the
    // fix, generation 2 would skip the delay entirely (5-gen count of 1).
    expect(pays.filter((p) => p === "write").length).toBe(2);
  });

  it("produces a fixed illustration set through the injectable delay", async () => {
    const illustrate = createFixedDevIllustration({
      wait: async () => {},
      reset: () => {},
    } as ReturnType<typeof createFakePhasedDelay>);
    const result = await illustrate("a non-catalog prompt");
    expect(result).toEqual({ dataUri: FIXED_ILLUSTRATION_DATA_URI });
  });

  it("awaits the env-driven fake delay when not running under the test env", async () => {
    // The no-op test guard short-circuits in the normal suite; here we force
    // the real dev path with an isolated env override and fake timers.
    vi.useFakeTimers();
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("STORY_FAKE_STEP_DELAY_MS", "1");
    const impl = createFixedDevProvider(); // default → real fakeModeDelay
    const p = impl.generateStory(input);

    await vi.runOnlyPendingTimersAsync();
    const story = await p;

    expect(story.scenes).toHaveLength(5);
    vi.useRealTimers();

    // A non-numeric/<=0 delay falls back to an immediate resolve (no timer).
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("STORY_FAKE_STEP_DELAY_MS", "oops");
    const instantImpl = createFixedDevProvider();
    await expect(instantImpl.generateStory(input)).resolves.toMatchObject({
      scenes: expect.any(Array),
    });
  });
});
