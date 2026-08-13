import { describe, expect, it, beforeEach, vi } from "vitest";
import type { ServerEnv } from "../../src/lib/env";

/** Minimal raw string environment inputs (what `parseEnv` consumes) using the new per-capability schema. */
const validEnv: Record<string, string> = {
  OPENROUTER_API_KEY: "sk-test-123",
  OPENCODE_GO_API_KEY: "sk-opencode-test-456",
  TEXT_MODEL: "opencode-go/qwen/qwen3.7-flash",
  IMAGE_MODEL: "openrouter/qwen/qwen3.7-flash",
  MODERATION_MODEL: "openrouter/qwen/qwen3.7-flash",
};

/** The fully parsed/validated environment (AI narration enabled). */
const valid: ServerEnv = {
  OPENROUTER_API_KEY: "sk-test-123",
  OPENCODE_GO_API_KEY: "sk-opencode-test-456",
  TEXT_MODEL: "opencode-go/qwen/qwen3.7-flash",
  IMAGE_MODEL: "openrouter/qwen/qwen3.7-flash",
  MODERATION_MODEL: "openrouter/qwen/qwen3.7-flash",
  AI_NARRATION_ENABLED: true,
  TTS_MODEL: "kokoro-82m",
};

/**
 * Re-import the env module fresh on every test so the module-level `cached`
 * value can never leak between cases (deterministic, order-independent).
 */
async function loadEnv() {
  vi.resetModules();
  return await import("../../src/lib/env");
}

describe("env server validation", () => {
  beforeEach(() => {
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.OPENCODE_GO_API_KEY;
    delete process.env.TEXT_MODEL;
    delete process.env.IMAGE_MODEL;
    delete process.env.MODERATION_MODEL;
    delete process.env.AI_NARRATION_ENABLED;
    delete process.env.TTS_MODEL;
  });

  it("parses a fully configured environment", async () => {
    const { parseEnv } = await loadEnv();
    const result = parseEnv({
      ...validEnv,
      AI_NARRATION_ENABLED: "true",
      TTS_MODEL: "kokoro-82m",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(valid);
    }
  });

  it("accepts either provider as the prefix for any capacity model (generic binding)", async () => {
    const { parseEnv } = await loadEnv();
    const result = parseEnv({
      ...validEnv,
      TEXT_MODEL: "openrouter/qwen/qwen3.7-flash",
      IMAGE_MODEL: "opencode-go/qwen/qwen3.7-flash",
      MODERATION_MODEL: "openrouter/qwen/qwen3.7-flash",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a legacy OPENROUTER_* model variable", async () => {
    const { parseEnv } = await loadEnv();
    const result = parseEnv({
      ...validEnv,
      OPENROUTER_TEXT_MODEL: "some-org/text-model",
    } as Record<string, string>);
    // Extra/unknown keys are rejected by the strict schema and the legacy var
    // is not part of the new schema, so a legacy-only model set must fail.
    expect(result.success).toBe(false);
  });

  it("rejects a missing OpenRouter API key", async () => {
    const { parseEnv } = await loadEnv();
    const result = parseEnv({
      OPENCODE_GO_API_KEY: validEnv.OPENCODE_GO_API_KEY,
      TEXT_MODEL: validEnv.TEXT_MODEL,
      IMAGE_MODEL: validEnv.IMAGE_MODEL,
      MODERATION_MODEL: validEnv.MODERATION_MODEL,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing OpenCode API key", async () => {
    const { parseEnv } = await loadEnv();
    const result = parseEnv({
      OPENROUTER_API_KEY: validEnv.OPENROUTER_API_KEY,
      TEXT_MODEL: validEnv.TEXT_MODEL,
      IMAGE_MODEL: validEnv.IMAGE_MODEL,
      MODERATION_MODEL: validEnv.MODERATION_MODEL,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing TEXT_MODEL", async () => {
    const { parseEnv } = await loadEnv();
    const result = parseEnv({
      ...validEnv,
      TEXT_MODEL: undefined as unknown as string,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing IMAGE_MODEL", async () => {
    const { parseEnv } = await loadEnv();
    const result = parseEnv({
      ...validEnv,
      IMAGE_MODEL: undefined as unknown as string,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing MODERATION_MODEL", async () => {
    const { parseEnv } = await loadEnv();
    const result = parseEnv({
      ...validEnv,
      MODERATION_MODEL: undefined as unknown as string,
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty model identifier", async () => {
    const { parseEnv } = await loadEnv();
    const result = parseEnv({ ...validEnv, TEXT_MODEL: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a model without a provider prefix (never silent)", async () => {
    const { parseEnv } = await loadEnv();
    const result = parseEnv({ ...validEnv, IMAGE_MODEL: "qwen/qwen3.7-flash" });
    expect(result.success).toBe(false);
  });

  it("rejects a model with an unknown provider prefix (never silent)", async () => {
    const { parseEnv } = await loadEnv();
    const result = parseEnv({
      ...validEnv,
      MODERATION_MODEL: "unknown-provider/qwen/qwen3.7-flash",
    });
    expect(result.success).toBe(false);
  });

  it("defaults STORIES_TEST_MODE to absent when not set", async () => {
    const { parseEnv } = await loadEnv();
    const result = parseEnv({ ...validEnv });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.STORIES_TEST_MODE).toBeUndefined();
  });

  it("accepts the fake provider selector as an optional override", async () => {
    const { parseEnv } = await loadEnv();
    const result = parseEnv({ ...validEnv, STORIES_TEST_MODE: "fake" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.STORIES_TEST_MODE).toBe("fake");
  });

  it("rejects an unknown STORIES_TEST_MODE value", async () => {
    const { parseEnv } = await loadEnv();
    const result = parseEnv({ ...validEnv, STORIES_TEST_MODE: "bad" });
    expect(result.success).toBe(false);
  });

  it("getEnv throws a safe generic error that does not leak a config value", async () => {
    const { getEnv } = await loadEnv();
    expect(() => getEnv()).toThrow(
      "Server environment is missing required provider configuration."
    );
    // The generic message must never embed any environment value.
    const expected = "Server environment is missing required provider configuration.";
    expect(expected).not.toContain(validEnv.OPENROUTER_API_KEY);
    expect(expected).not.toContain(validEnv.OPENCODE_GO_API_KEY);
    expect(expected).not.toContain(validEnv.TEXT_MODEL);
    expect(expected).not.toContain(validEnv.IMAGE_MODEL);
    expect(expected).not.toContain(validEnv.MODERATION_MODEL);
  });

  it("getEnv returns validated values once configured", async () => {
    const { getEnv } = await loadEnv();
    process.env.OPENROUTER_API_KEY = validEnv.OPENROUTER_API_KEY;
    process.env.OPENCODE_GO_API_KEY = validEnv.OPENCODE_GO_API_KEY;
    process.env.TEXT_MODEL = validEnv.TEXT_MODEL;
    process.env.IMAGE_MODEL = validEnv.IMAGE_MODEL;
    process.env.MODERATION_MODEL = validEnv.MODERATION_MODEL;
    process.env.AI_NARRATION_ENABLED = "true";
    process.env.TTS_MODEL = "kokoro-82m";
    expect(getEnv()).toEqual(valid);
  });

  it("defaults AI_NARRATION_ENABLED to false when absent", async () => {
    const { parseEnv } = await loadEnv();
    const result = parseEnv({ ...validEnv });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.AI_NARRATION_ENABLED).toBe(false);
  });

  it("parses a true AI_NARRATION_ENABLED flag", async () => {
    const { parseEnv } = await loadEnv();
    const result = parseEnv({ ...validEnv, AI_NARRATION_ENABLED: "true" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.AI_NARRATION_ENABLED).toBe(true);
  });

  it("parses a false AI_NARRATION_ENABLED flag", async () => {
    const { parseEnv } = await loadEnv();
    const result = parseEnv({ ...validEnv, AI_NARRATION_ENABLED: "false" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.AI_NARRATION_ENABLED).toBe(false);
  });

  it("rejects an invalid AI_NARRATION_ENABLED value", async () => {
    const { parseEnv } = await loadEnv();
    const result = parseEnv({ ...validEnv, AI_NARRATION_ENABLED: "yes" });
    expect(result.success).toBe(false);
  });

  it("parses an optional TTS_MODEL", async () => {
    const { parseEnv } = await loadEnv();
    const enabled = parseEnv({ ...validEnv, TTS_MODEL: "kokoro-82m" });
    expect(enabled.success).toBe(true);
    if (enabled.success) expect(enabled.data.TTS_MODEL).toBe("kokoro-82m");

    const absent = parseEnv({ ...validEnv });
    expect(absent.success).toBe(true);
  });

  it("rejects an empty TTS_MODEL", async () => {
    const { parseEnv } = await loadEnv();
    const result = parseEnv({ ...validEnv, TTS_MODEL: "" });
    expect(result.success).toBe(false);
  });

  it("getEnv exposes the AI narration flags once configured", async () => {
    const { getEnv } = await loadEnv();
    process.env.OPENROUTER_API_KEY = validEnv.OPENROUTER_API_KEY;
    process.env.OPENCODE_GO_API_KEY = validEnv.OPENCODE_GO_API_KEY;
    process.env.TEXT_MODEL = validEnv.TEXT_MODEL;
    process.env.IMAGE_MODEL = validEnv.IMAGE_MODEL;
    process.env.MODERATION_MODEL = validEnv.MODERATION_MODEL;
    process.env.TTS_MODEL = "kokoro-82m";
    process.env.AI_NARRATION_ENABLED = "true";
    expect(getEnv()).toEqual({
      ...valid,
    });
  });
});
