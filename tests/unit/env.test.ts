import { describe, expect, it, beforeEach, vi } from "vitest";
import type { ServerEnv } from "../../src/lib/env";

/** Minimal raw string environment inputs (using the new per-agent schema, spec 006). */
const validEnv: Record<string, string> = {
  OPENROUTER_API_KEY: "sk-test-123",
  OPENCODE_GO_API_KEY: "sk-opencode-test-456",
  PLANNER_MODEL: "opencode-go/qwen/qwen3.7-flash",
  WRITER_MODEL: "openrouter/qwen/qwen3.7-flash",
  MODERATOR_MODEL: "openrouter/qwen/qwen3.7-flash",
  ILLUSTRATOR_MODEL: "openrouter/qwen/qwen3.7-flash",
  READER_MODEL: "openrouter/qwen/qwen3.7-flash",
};

/** The fully parsed/validated environment (AI narration enabled). */
const valid: ServerEnv = {
  OPENROUTER_API_KEY: "sk-test-123",
  OPENCODE_GO_API_KEY: "sk-opencode-test-456",
  PLANNER_MODEL: "opencode-go/qwen/qwen3.7-flash",
  WRITER_MODEL: "openrouter/qwen/qwen3.7-flash",
  MODERATOR_MODEL: "openrouter/qwen/qwen3.7-flash",
  ILLUSTRATOR_MODEL: "openrouter/qwen/qwen3.7-flash",
  READER_MODEL: "openrouter/qwen/qwen3.7-flash",
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
    for (const key of Object.keys(validEnv)) {
      delete process.env[key];
    }
    delete process.env.AI_NARRATION_ENABLED;
    delete process.env.TTS_MODEL;
    delete process.env.MODEL_TIMEOUT_MS;
    delete process.env.MODEL_MAX_ATTEMPTS;
    delete process.env.PIPELINE_TIMEOUT_MS;
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

  it("accepts either provider as the prefix for any agent model (generic binding)", async () => {
    const { parseEnv } = await loadEnv();
    const result = parseEnv({
      ...validEnv,
      PLANNER_MODEL: "openrouter/qwen/qwen3.7-flash",
      MODERATOR_MODEL: "opencode-go/qwen/qwen3.7-flash",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a legacy OPENROUTER_* model variable", async () => {
    const { parseEnv } = await loadEnv();
    const result = parseEnv({
      ...validEnv,
      OPENROUTER_TEXT_MODEL: "some-org/text-model",
    } as Record<string, string>);
    expect(result.success).toBe(false);
  });

  it("rejects a missing OpenRouter API key", async () => {
    const { parseEnv } = await loadEnv();
    const env: Record<string, string> = {
      ...validEnv,
    };
    delete env.OPENROUTER_API_KEY;
    const result = parseEnv(env);
    expect(result.success).toBe(false);
  });

  it("rejects a missing OpenCode API key", async () => {
    const { parseEnv } = await loadEnv();
    const env: Record<string, string> = {
      ...validEnv,
    };
    delete env.OPENCODE_GO_API_KEY;
    const result = parseEnv(env);
    expect(result.success).toBe(false);
  });

  it("rejects a missing PLANNER_MODEL", async () => {
    const { parseEnv } = await loadEnv();
    const env: Record<string, string> = { ...validEnv };
    delete env.PLANNER_MODEL;
    const result = parseEnv(env);
    expect(result.success).toBe(false);
  });

  it("rejects a missing MODERATOR_MODEL", async () => {
    const { parseEnv } = await loadEnv();
    const env: Record<string, string> = { ...validEnv };
    delete env.MODERATOR_MODEL;
    const result = parseEnv(env);
    expect(result.success).toBe(false);
  });

  it("rejects an empty model identifier", async () => {
    const { parseEnv } = await loadEnv();
    const result = parseEnv({ ...validEnv, PLANNER_MODEL: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a model without a provider prefix (never silent)", async () => {
    const { parseEnv } = await loadEnv();
    const result = parseEnv({ ...validEnv, ILLUSTRATOR_MODEL: "qwen/qwen3.7-flash" });
    expect(result.success).toBe(false);
  });

  it("rejects a model with an unknown provider prefix (never silent)", async () => {
    const { parseEnv } = await loadEnv();
    const result = parseEnv({
      ...validEnv,
      MODERATOR_MODEL: "unknown-provider/qwen/qwen3.7-flash",
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
    const expected = "Server environment is missing required provider configuration.";
    expect(expected).not.toContain(validEnv.OPENROUTER_API_KEY);
    expect(expected).not.toContain(validEnv.OPENCODE_GO_API_KEY);
    expect(expected).not.toContain(validEnv.PLANNER_MODEL);
  });

  it("getEnv returns validated values once configured", async () => {
    const { getEnv } = await loadEnv();
    for (const [key, value] of Object.entries(validEnv)) {
      process.env[key] = value;
    }
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
  });

  it("rejects an empty TTS_MODEL", async () => {
    const { parseEnv } = await loadEnv();
    const result = parseEnv({ ...validEnv, TTS_MODEL: "" });
    expect(result.success).toBe(false);
  });

  it("getEnv exposes the AI narration flags once configured", async () => {
    const { getEnv } = await loadEnv();
    for (const [key, value] of Object.entries(validEnv)) {
      process.env[key] = value;
    }
    process.env.TTS_MODEL = "kokoro-82m";
    process.env.AI_NARRATION_ENABLED = "true";
    expect(getEnv()).toEqual({
      ...valid,
    });
  });

  it("accepts optional timeout/attempts/pipeline knobs (coerced to numbers)", async () => {
    const { parseEnv } = await loadEnv();
    const result = parseEnv({
      ...validEnv,
      MODEL_TIMEOUT_MS: "30000",
      MODEL_MAX_ATTEMPTS: "2",
      PIPELINE_TIMEOUT_MS: "120000",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.MODEL_TIMEOUT_MS).toBe(30000);
      expect(result.data.MODEL_MAX_ATTEMPTS).toBe(2);
      expect(result.data.PIPELINE_TIMEOUT_MS).toBe(120000);
    }
  });

  it("rejects a non-numeric timeout/attempts knob (fail-fast, never silent)", async () => {
    const { parseEnv } = await loadEnv();
    const timeout = parseEnv({ ...validEnv, MODEL_TIMEOUT_MS: "fast" });
    expect(timeout.success).toBe(false);
    const attempts = parseEnv({ ...validEnv, MODEL_MAX_ATTEMPTS: "many" });
    expect(attempts.success).toBe(false);
    const pipeline = parseEnv({ ...validEnv, PIPELINE_TIMEOUT_MS: "-5" });
    expect(pipeline.success).toBe(false);
  });
});
