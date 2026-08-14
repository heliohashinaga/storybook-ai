import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  GeneratedStoryCandidate,
  ModerationDecision,
  ProviderStoryInput,
} from "../../src/features/story-generation/server/story-generation-provider";
import type { Route } from "../../src/features/story-generation/server/provider-routing";
import type {
  IllustrationProviderOptions,
  RealAdapterSeams,
  StoryProviderOptions,
} from "../../src/features/story-generation/server/generation-runtime";

/**
 * Deterministic **capability routing** test for the production dual runtime
 * (spec 005 US1, T012/T013). Browser E2E runs with `STORIES_TEST_MODE=fake`,
 * which short-circuits real routing, so this test pins the actual production
 * routing by injecting spy adapter seams into `createRealRuntime` while a real,
 * fully-configured per-capability env is present:
 *
 * - the composite `provider` routes text to the `TEXT_MODEL` prefix provider and
 *   moderation to the `MODERATION_MODEL` prefix provider;
 * - `illustrate` routes image to the `IMAGE_MODEL` prefix provider, covering the
 *   inverse cases (image→`opencode-go` and text→`openrouter`);
 * - fake `STORIES_TEST_MODE` still selects the deterministic offline provider.
 *
 * The env module caches its validation result, so each test resets modules and
 * re-imports so a fresh `getEnv()` sees the new `*_MODEL` values.
 */

const envKey = (value: {
  PLANNER_MODEL: string;
  MODERATOR_MODEL: string;
  ILLUSTRATOR_MODEL: string;
}) => {
  process.env.OPENROUTER_API_KEY = "sk-or-test";
  process.env.OPENCODE_GO_API_KEY = "sk-oc-test";
  process.env.PLANNER_MODEL = value.PLANNER_MODEL;
  process.env.WRITER_MODEL = "opencode-go/qwen/qwen3.7-flash";
  process.env.MODERATOR_MODEL = value.MODERATOR_MODEL;
  process.env.ILLUSTRATOR_MODEL = value.ILLUSTRATOR_MODEL;
  process.env.READER_MODEL = "openrouter/hexgrad/kokoro-82m";
};

const input: ProviderStoryInput = {
  ageBand: "5-7",
  locale: "pt-BR",
  theme: "courage",
  sceneCount: 3,
};

interface FakeStoryProvider {
  generateStory: (input: ProviderStoryInput) => Promise<GeneratedStoryCandidate>;
  moderateText: (text: string) => Promise<ModerationDecision>;
  moderateImage: (prompt: string) => Promise<ModerationDecision>;
}

function spySeams() {
  const storyFactory = vi.fn(
    (route: Route, _options: StoryProviderOptions = {}) =>
      () =>
        route.provider === "opencode-go"
          ? fakeProvider("opencode-story")
          : fakeProvider("openrouter-story")
  );
  const illustrationFactory = vi.fn(
    (route: Route, _options: IllustrationProviderOptions = {}) =>
      () =>
        Promise.resolve({
          dataUri:
            route.provider === "opencode-go"
              ? "data:image/webp;base64,opencode-img"
              : "data:image/webp;base64,openrouter-img",
        })
  );
  const seams: RealAdapterSeams = { storyProviderFactory: storyFactory, illustrationFactory };
  return { seams, storyFactory, illustrationFactory };
}

function fakeProvider(title: string): FakeStoryProvider {
  return {
    generateStory: vi.fn(async (): Promise<GeneratedStoryCandidate> => ({
      title,
      scenes: [{ ordinal: 1, title: "S", body: "B", illustrationPrompt: "P" }],
    })),
    moderateText: vi.fn(async (_t: string): Promise<ModerationDecision> => ({ safe: true })),
    moderateImage: vi.fn(async (_p: string): Promise<ModerationDecision> => ({ safe: true })),
  };
}

async function load() {
  vi.resetModules();
  const { createRealRuntime } =
    (await import("../../src/features/story-generation/server/generation-runtime")) as typeof import("../../src/features/story-generation/server/generation-runtime");
  return { createRealRuntime };
}

describe("createRealRuntime capability routing (route-selection)", () => {
  beforeEach(() => {
    delete process.env.STORIES_TEST_MODE;
    for (const key of [
      "OPENROUTER_API_KEY",
      "OPENCODE_GO_API_KEY",
      "PLANNER_MODEL",
      "WRITER_MODEL",
      "MODERATOR_MODEL",
      "ILLUSTRATOR_MODEL",
      "READER_MODEL",
      "AI_NARRATION_ENABLED",
      "TTS_MODEL",
    ] as const) {
      delete process.env[key];
    }
  });

  it("routes text to the PLANNER_MODEL prefix provider and moderation to the moderator prefix", async () => {
    envKey({
      PLANNER_MODEL: "opencode-go/qwen/qwen3.7-flash",
      MODERATOR_MODEL: "openrouter/safety/guard",
      ILLUSTRATOR_MODEL: "openrouter/qwen/qwen3_image",
    });
    const { createRealRuntime } = await load();
    const { seams, storyFactory } = spySeams();
    const runtime = createRealRuntime(seams);

    const story = await runtime.provider.generateStory(input);
    expect(storyFactory).toHaveBeenCalledWith(
      expect.objectContaining({ capability: "text", provider: "opencode-go" }),
      expect.objectContaining({})
    );
    expect(story.title).toBe("opencode-story");

    // Moderation → OpenRouter (a different route/provider from text).
    await runtime.provider.moderateText("review this text");
    await runtime.provider.moderateImage("an illustration prompt");
    expect(storyFactory).toHaveBeenCalledWith(
      expect.objectContaining({ capability: "moderation", provider: "openrouter" }),
      expect.objectContaining({})
    );
    expect(storyFactory).toHaveBeenCalledTimes(2);
  });

  it("routes image to the ILLUSTRATOR_MODEL prefix provider", async () => {
    envKey({
      PLANNER_MODEL: "opencode-go/qwen/qwen3.7-flash",
      MODERATOR_MODEL: "openrouter/safety/guard",
      ILLUSTRATOR_MODEL: "openrouter/qwen/qwen3_image",
    });
    const { createRealRuntime } = await load();
    const { seams, illustrationFactory } = spySeams();
    const runtime = createRealRuntime(seams);

    const illustration = await runtime.illustrate("scene prompt");
    expect(illustrationFactory).toHaveBeenCalledWith(
      expect.objectContaining({ capability: "image", provider: "openrouter" }),
      expect.objectContaining({})
    );
    expect(illustration.dataUri).toBe("data:image/webp;base64,openrouter-img");
  });

  it("routes image via the OpenCode illustrator for an opencode-go ILLUSTRATOR_MODEL (inverse)", async () => {
    envKey({
      PLANNER_MODEL: "openrouter/qwen/qwen3.7-flash",
      MODERATOR_MODEL: "opencode-go/safety/guard",
      ILLUSTRATOR_MODEL: "opencode-go/qwen/qwen3_image",
    });
    const { createRealRuntime } = await load();
    const { seams, illustrationFactory } = spySeams();
    const runtime = createRealRuntime(seams);

    const illustration = await runtime.illustrate("scene prompt");
    expect(illustrationFactory).toHaveBeenCalledWith(
      expect.objectContaining({ capability: "image", provider: "opencode-go" }),
      expect.objectContaining({})
    );
    expect(illustration.dataUri).toBe("data:image/webp;base64,opencode-img");
  });

  it("routes text via OpenRouter for an openrouter PLANNER_MODEL (inverse)", async () => {
    envKey({
      PLANNER_MODEL: "openrouter/qwen/qwen3.7-flash",
      MODERATOR_MODEL: "opencode-go/safety/guard",
      ILLUSTRATOR_MODEL: "openrouter/qwen/qwen3_image",
    });
    const { createRealRuntime } = await load();
    const { seams, storyFactory } = spySeams();
    const runtime = createRealRuntime(seams);

    const story = await runtime.provider.generateStory(input);
    expect(storyFactory).toHaveBeenCalledWith(
      expect.objectContaining({ capability: "text", provider: "openrouter" }),
      expect.objectContaining({})
    );
    expect(story.title).toBe("openrouter-story");
  });

  it("keeps the deterministic offline provider under STORIES_TEST_MODE=fake", async () => {
    process.env.STORIES_TEST_MODE = "fake";
    // Env is deliberately incomplete (no models/keys) — fake mode must not
    // require provider credentials.
    const { createRealRuntime } = await load();
    const runtime = createRealRuntime();
    const story = await runtime.provider.generateStory({
      ...input,
      locale: "pt-BR",
      sceneCount: 3,
    });
    expect(story.scenes).toHaveLength(3);
    const illustration = await runtime.illustrate("any");
    expect(illustration.dataUri).toMatch(/^data:image\/webp;base64,/);

    // Per-agent getters also resolve to the shared fake in fake mode (no
    // credentials required, no per-agent construction).
    await expect(
      runtime.plannerProvider.generateStory({ ...input, sceneCount: 3 })
    ).resolves.toBeDefined();
    await expect(
      runtime.writerProvider.generateStory({ ...input, sceneCount: 3 })
    ).resolves.toBeDefined();
    await expect(runtime.moderatorProvider.moderateText("ok")).resolves.toEqual({ safe: true });
  });

  it("builds each per-agent provider lazily from its own *_MODEL (spec 006)", async () => {
    envKey({
      PLANNER_MODEL: "opencode-go/qwen/qwen3.7-flash",
      MODERATOR_MODEL: "openrouter/safety/guard",
      ILLUSTRATOR_MODEL: "openrouter/qwen/qwen3_image",
    });
    const { createRealRuntime } = await load();
    const { seams, storyFactory } = spySeams();
    const runtime = createRealRuntime(seams);

    // Planner provider → text routed from PLANNER_MODEL (opencode-go).
    await runtime.plannerProvider.generateStory(input);
    expect(storyFactory).toHaveBeenCalledWith(
      expect.objectContaining({ capability: "text", provider: "opencode-go" }),
      expect.objectContaining({})
    );

    // Writer provider → text routed from WRITER_MODEL (opencode-go).
    await runtime.writerProvider.generateStory(input);
    expect(storyFactory).toHaveBeenCalledWith(
      expect.objectContaining({ capability: "text", provider: "opencode-go" }),
      expect.objectContaining({})
    );

    // Moderator provider → moderation routed from MODERATOR_MODEL (openrouter).
    await runtime.moderatorProvider.moderateText("content");
    expect(storyFactory).toHaveBeenCalledWith(
      expect.objectContaining({ capability: "moderation", provider: "openrouter" }),
      expect.objectContaining({})
    );
  });
});
