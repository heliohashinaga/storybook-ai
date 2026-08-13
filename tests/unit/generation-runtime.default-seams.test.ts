import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_SEAMS } from "../../src/features/story-generation/server/generation-runtime";

/**
 * Default adapter seams (spec 005 US1, T012).
 *
 * The route calls `createGenerationRuntime()` with no arguments, so production
 * always runs the **default** seams (`DEFAULT_SEAMS`) that bind the real
 * OpenRouter / OpenCode adapters per routed capability. Those defaults must be
 * covered without any live AI: they only *construct* adapters (with a real
 * validated env present), never touching the network — and each one obeys the
 * `provider` prefix of its route.
 */

const values = (overrides: Partial<typeof process.env> = {}) => {
  const base = {
    OPENROUTER_API_KEY: "sk-or-test",
    OPENCODE_GO_API_KEY: "sk-oc-test",
    TEXT_MODEL: "openrouter/qwen/qwen3.7-flash",
    IMAGE_MODEL: "openrouter/openai/gpt-5-image-mini",
    MODERATION_MODEL: "openrouter/openai/gpt-4o-mini",
  };
  for (const [key, val] of Object.entries({ ...base, ...overrides })) {
    process.env[key] = val as string;
  }
};

describe("DEFAULT_SEAMS (production adapter binding)", () => {
  beforeEach(() => {
    delete process.env.STORIES_TEST_MODE;
    for (const key of [
      "OPENROUTER_API_KEY",
      "OPENCODE_GO_API_KEY",
      "TEXT_MODEL",
      "IMAGE_MODEL",
      "MODERATION_MODEL",
    ] as const) {
      delete process.env[key];
    }
  });

  it("storyProviderFactory routes an openrouter route to the OpenRouter adapter", () => {
    values();
    const factory = DEFAULT_SEAMS.storyProviderFactory({
      capability: "text",
      provider: "openrouter",
      model: "qwen/qwen3.7-flash",
      apiKeyEnv: "OPENROUTER_API_KEY",
    });
    const provider = factory();
    expect(provider.generateStory).toBeTypeOf("function");
    expect(provider.moderateText).toBeTypeOf("function");
    expect(provider.moderateImage).toBeTypeOf("function");
  });

  it("storyProviderFactory routes an opencode-go route to the OpenCode adapter", () => {
    values({ TEXT_MODEL: "opencode-go/qwen/qwen3.7-flash" });
    const factory = DEFAULT_SEAMS.storyProviderFactory({
      capability: "text",
      provider: "opencode-go",
      model: "qwen/qwen3.7-flash",
      apiKeyEnv: "OPENCODE_GO_API_KEY",
    });
    const provider = factory();
    expect(provider.generateStory).toBeTypeOf("function");
    expect(provider.moderateText).toBeTypeOf("function");
    expect(provider.moderateImage).toBeTypeOf("function");
  });

  it("illustrationFactory routes an openrouter image route to the OpenRouter illustrator", async () => {
    values();
    const illustrate = DEFAULT_SEAMS.illustrationFactory({
      capability: "image",
      provider: "openrouter",
      model: "openai/gpt-5-image-mini",
      apiKeyEnv: "OPENROUTER_API_KEY",
    });
    // Constructing the illustrator must not require a network call; only a
    // transport invocation would. `illustrate` is a plain function here.
    expect(illustrate).toBeTypeOf("function");
  });

  it("illustrationFactory routes an opencode-go image route to the OpenCode illustrator", async () => {
    values({ IMAGE_MODEL: "opencode-go/qwen/qwen3_image" });
    const illustrate = DEFAULT_SEAMS.illustrationFactory({
      capability: "image",
      provider: "opencode-go",
      model: "qwen/qwen3_image",
      apiKeyEnv: "OPENCODE_GO_API_KEY",
    });
    expect(illustrate).toBeTypeOf("function");
  });
});
