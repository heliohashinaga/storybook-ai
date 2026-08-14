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
 * Env → provider wiring (spec 006 / commit 5864dae): the per-agent provider
 * construction must inject `MODEL_TIMEOUT_MS`/`MODEL_MAX_ATTEMPTS` into the
 * real adapters as `timeoutMs`/`maxRetries`. The plumbing is intentional —
 * `getEnv()` is called lazily and the composite provider uses the same options
 * as the per-agent getters, so the seam factories (second argument) observe
 * the derived values without any live AI.
 *
 * The mapping is:
 * - `MODEL_TIMEOUT_MS`   → `timeoutMs` (only when explicitly set; unset keeps
 *   each adapter's documented default, e.g. image 120 s);
 * - `MODEL_MAX_ATTEMPTS` → `maxRetries = attempts - 1` (SDK retries after the
 *   first attempt, matching the total-attempt semantics of `agents/retry.ts`).
 */

const baseModels = {
  OPENROUTER_API_KEY: "sk-or-test",
  OPENCODE_GO_API_KEY: "sk-oc-test",
  PLANNER_MODEL: "opencode-go/qwen/qwen3.7-flash",
  WRITER_MODEL: "openrouter/qwen/qwen3.7-flash",
  MODERATOR_MODEL: "openrouter/safety/guard",
  ILLUSTRATOR_MODEL: "openrouter/qwen/qwen3_image",
  READER_MODEL: "openrouter/hexgrad/kokoro-82m",
  AI_NARRATION_ENABLED: "false",
  TTS_MODEL: "openrouter/hexgrad/kokoro-82m",
};

function setModels(overrides: Partial<typeof baseModels> = {}) {
  for (const [key, val] of Object.entries({ ...baseModels, ...overrides })) {
    process.env[key] = val;
  }
}

const input: ProviderStoryInput = {
  ageBand: "5-7",
  locale: "pt-BR",
  theme: "courage",
  sceneCount: 3,
};

// Re-usable stub so the seam's returned provider is never hit (options capture).
const stubProvider = (title: string) => ({
  async generateStory(_: ProviderStoryInput): Promise<GeneratedStoryCandidate> {
    return {
      title,
      scenes: [{ ordinal: 1, title: "S", body: "B", illustrationPrompt: "P" }],
    };
  },
  async moderateText(_: string): Promise<ModerationDecision> {
    return { safe: true };
  },
  async moderateImage(_: string): Promise<ModerationDecision> {
    return { safe: true };
  },
});

function spySeams() {
  const storyOptions: StoryProviderOptions[] = [];
  const illustrationOptions: IllustrationProviderOptions[] = [];
  // Record what the production runtime actually passes so assertions read the
  // options handed to the adapter factories as calls happen.
  const storyFactory = vi.fn((route: Route, options: StoryProviderOptions = {}) => {
    void route;
    storyOptions.push(options);
    return () => stubProvider("opencode-story");
  });
  const illustrationFactory = vi.fn((route: Route, options: IllustrationProviderOptions = {}) => {
    void route;
    illustrationOptions.push(options);
    return () => Promise.resolve({ dataUri: "data:image/webp;base64,img" });
  });
  const seams: RealAdapterSeams = { storyProviderFactory: storyFactory, illustrationFactory };
  return { seams, storyOptions, illustrationOptions };
}

async function load() {
  vi.resetModules();
  const { createRealRuntime } =
    (await import("../../src/features/story-generation/server/generation-runtime")) as typeof import("../../src/features/story-generation/server/generation-runtime");
  return { createRealRuntime };
}

describe("MODEL_TIMEOUT_MS / MODEL_MAX_ATTEMPTS → provider wiring", () => {
  beforeEach(() => {
    delete process.env.STORIES_TEST_MODE;
    for (const key of [
      "OPENROUTER_API_KEY",
      "OPENCODE_GO_API_KEY",
      "PLANNER_MODEL",
      "WRITER_MODEL",
      "MODERATOR_MODEL",
      "ILLUSTRATOR_MODEL",
      "MODEL_TIMEOUT_MS",
      "MODEL_MAX_ATTEMPTS",
    ] as const) {
      delete process.env[key];
    }
  });

  it("injects MODEL_TIMEOUT_MS and MODEL_MAX_ATTEMPTS as timeoutMs/maxRetries on per-agent providers", async () => {
    setModels();
    process.env.MODEL_TIMEOUT_MS = "30000";
    process.env.MODEL_MAX_ATTEMPTS = "3";
    const { createRealRuntime } = await load();
    const { seams, storyOptions } = spySeams();
    const runtime = createRealRuntime(seams);

    await runtime.plannerProvider.generateStory(input);
    await runtime.writerProvider.generateStory(input);
    await runtime.moderatorProvider.moderateText("content");

    // Every per-agent provider is built through the seam with the env-derived deps.
    expect(storyOptions).toEqual([
      { timeoutMs: 30000, maxRetries: 2 },
      { timeoutMs: 30000, maxRetries: 2 },
      { timeoutMs: 30000, maxRetries: 2 },
    ]);
  });

  it("maps MODEL_MAX_ATTEMPTS total attempts to maxRetries = attempts - 1", async () => {
    setModels();
    process.env.MODEL_MAX_ATTEMPTS = "2"; // 2 total attempts ⇒ 1 retry
    const { createRealRuntime } = await load();
    const { seams, storyOptions } = spySeams();
    const runtime = createRealRuntime(seams);

    await runtime.plannerProvider.generateStory(input);
    expect(storyOptions).toEqual([{ maxRetries: 1 }]);
  });

  it("injects MODEL_TIMEOUT_MS into the real illustrator options", async () => {
    setModels();
    process.env.MODEL_TIMEOUT_MS = "60000";
    const { createRealRuntime } = await load();
    const { seams, illustrationOptions } = spySeams();
    const runtime = createRealRuntime(seams);

    await runtime.illustrate("a scene");
    expect(illustrationOptions).toEqual([{ timeoutMs: 60000 }]);
  });

  it("leaves adapter defaults untouched when the env knobs are unset", async () => {
    setModels();
    const { createRealRuntime } = await load();
    const { seams, storyOptions, illustrationOptions } = spySeams();
    const runtime = createRealRuntime(seams);

    await runtime.plannerProvider.generateStory(input);
    await runtime.illustrate("a scene");

    // The production runtime passes empty options so each adapter falls back to
    // its own documented default (text 60 s, image 120 s, SDK maxRetries 2).
    expect(illustrationOptions).toEqual([{}]);
    expect(storyOptions).toEqual([{}]);
  });

  it("does not inject maxRetries for illustration (retries are set-level)", async () => {
    setModels();
    process.env.MODEL_MAX_ATTEMPTS = "4";
    process.env.MODEL_TIMEOUT_MS = "45000";
    const { createRealRuntime } = await load();
    const { seams, illustrationOptions } = spySeams();
    const runtime = createRealRuntime(seams);

    await runtime.illustrate("a scene");
    // Illustration only honors the timeout, not retries.
    expect(illustrationOptions).toEqual([{ timeoutMs: 45000 }]);
  });
});
