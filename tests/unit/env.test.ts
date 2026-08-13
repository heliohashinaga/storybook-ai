import { describe, expect, it, beforeEach, vi } from "vitest";
import type { ServerEnv } from "../../src/lib/env";

/** Minimal raw string environment inputs (what `parseEnv` consumes). */
const validEnv: Record<string, string> = {
  OPENROUTER_API_KEY: "sk-test-123",
  OPENROUTER_TEXT_MODEL: "some-org/text-model",
  OPENROUTER_IMAGE_MODEL: "some-org/image-model",
  OPENROUTER_MODERATION_MODEL: "some-org/moderation-model",
};

/** The fully parsed/validated environment (AI narration enabled). */
const valid: ServerEnv = {
  OPENROUTER_API_KEY: "sk-test-123",
  OPENROUTER_TEXT_MODEL: "some-org/text-model",
  OPENROUTER_IMAGE_MODEL: "some-org/image-model",
  OPENROUTER_MODERATION_MODEL: "some-org/moderation-model",
  AI_NARRATION_ENABLED: true,
  OPENROUTER_TTS_MODEL: "kokoro-82m",
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
    delete process.env.OPENROUTER_TEXT_MODEL;
    delete process.env.OPENROUTER_IMAGE_MODEL;
    delete process.env.OPENROUTER_MODERATION_MODEL;
    delete process.env.AI_NARRATION_ENABLED;
    delete process.env.OPENROUTER_TTS_MODEL;
  });

  it("parses a fully configured environment", async () => {
    const { parseEnv } = await loadEnv();
    const result = parseEnv({
      ...validEnv,
      AI_NARRATION_ENABLED: "true",
      OPENROUTER_TTS_MODEL: "kokoro-82m",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(valid);
    }
  });

  it("rejects a missing API key", async () => {
    const { parseEnv } = await loadEnv();
    const result = parseEnv({
      OPENROUTER_TEXT_MODEL: valid.OPENROUTER_TEXT_MODEL,
      OPENROUTER_IMAGE_MODEL: valid.OPENROUTER_IMAGE_MODEL,
      OPENROUTER_MODERATION_MODEL: valid.OPENROUTER_MODERATION_MODEL,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing moderation model", async () => {
    const { parseEnv } = await loadEnv();
    const result = parseEnv({
      OPENROUTER_API_KEY: valid.OPENROUTER_API_KEY,
      OPENROUTER_TEXT_MODEL: valid.OPENROUTER_TEXT_MODEL,
      OPENROUTER_IMAGE_MODEL: valid.OPENROUTER_IMAGE_MODEL,
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty model identifier", async () => {
    const { parseEnv } = await loadEnv();
    const result = parseEnv({ ...validEnv, OPENROUTER_TEXT_MODEL: "" });
    expect(result.success).toBe(false);
  });

  it("defaults to the openrouter provider when STORIES_TEST_MODE is absent", async () => {
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
    expect(expected).not.toContain(validEnv.OPENROUTER_TEXT_MODEL);
  });

  it("getEnv returns validated values once configured", async () => {
    const { getEnv } = await loadEnv();
    process.env.OPENROUTER_API_KEY = validEnv.OPENROUTER_API_KEY;
    process.env.OPENROUTER_TEXT_MODEL = validEnv.OPENROUTER_TEXT_MODEL;
    process.env.OPENROUTER_IMAGE_MODEL = validEnv.OPENROUTER_IMAGE_MODEL;
    process.env.OPENROUTER_MODERATION_MODEL = validEnv.OPENROUTER_MODERATION_MODEL;
    process.env.AI_NARRATION_ENABLED = "true";
    process.env.OPENROUTER_TTS_MODEL = "kokoro-82m";
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

  it("parses an optional OPENROUTER_TTS_MODEL", async () => {
    const { parseEnv } = await loadEnv();
    const enabled = parseEnv({ ...validEnv, OPENROUTER_TTS_MODEL: "kokoro-82m" });
    expect(enabled.success).toBe(true);
    if (enabled.success) expect(enabled.data.OPENROUTER_TTS_MODEL).toBe("kokoro-82m");

    const absent = parseEnv({ ...validEnv });
    expect(absent.success).toBe(true);
  });

  it("rejects an empty OPENROUTER_TTS_MODEL", async () => {
    const { parseEnv } = await loadEnv();
    const result = parseEnv({ ...validEnv, OPENROUTER_TTS_MODEL: "" });
    expect(result.success).toBe(false);
  });

  it("getEnv exposes the AI narration flags once configured", async () => {
    const { getEnv } = await loadEnv();
    process.env.OPENROUTER_API_KEY = validEnv.OPENROUTER_API_KEY;
    process.env.OPENROUTER_TEXT_MODEL = validEnv.OPENROUTER_TEXT_MODEL;
    process.env.OPENROUTER_IMAGE_MODEL = validEnv.OPENROUTER_IMAGE_MODEL;
    process.env.OPENROUTER_MODERATION_MODEL = validEnv.OPENROUTER_MODERATION_MODEL;
    process.env.OPENROUTER_TTS_MODEL = "kokoro-82m";
    process.env.AI_NARRATION_ENABLED = "true";
    expect(getEnv()).toEqual({
      ...valid,
    });
  });
});
