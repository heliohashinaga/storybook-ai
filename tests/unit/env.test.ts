import { describe, expect, it, beforeEach, vi } from "vitest";
import type { ServerEnv } from "../../src/lib/env";

const valid: ServerEnv = {
  OPENROUTER_API_KEY: "sk-test-123",
  OPENROUTER_TEXT_MODEL: "some-org/text-model",
  OPENROUTER_IMAGE_MODEL: "some-org/image-model",
  OPENROUTER_MODERATION_MODEL: "some-org/moderation-model",
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
  });

  it("parses a fully configured environment", async () => {
    const { parseEnv } = await loadEnv();
    const result = parseEnv({ ...valid });
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
    const result = parseEnv({ ...valid, OPENROUTER_TEXT_MODEL: "" });
    expect(result.success).toBe(false);
  });

  it("defaults to the openrouter provider when STORIES_PROVIDER is absent", async () => {
    const { parseEnv } = await loadEnv();
    const result = parseEnv({ ...valid });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.STORIES_PROVIDER).toBeUndefined();
  });

  it("accepts the fake provider selector as an optional override", async () => {
    const { parseEnv } = await loadEnv();
    const result = parseEnv({ ...valid, STORIES_PROVIDER: "fake" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.STORIES_PROVIDER).toBe("fake");
  });

  it("rejects an unknown STORIES_PROVIDER value", async () => {
    const { parseEnv } = await loadEnv();
    const result = parseEnv({ ...valid, STORIES_PROVIDER: "bad" });
    expect(result.success).toBe(false);
  });

  it("getEnv throws a safe generic error that does not leak a config value", async () => {
    const { getEnv } = await loadEnv();
    expect(() => getEnv()).toThrow(
      "Server environment is missing required provider configuration."
    );
    // The generic message must never embed any environment value.
    const expected = "Server environment is missing required provider configuration.";
    expect(expected).not.toContain(valid.OPENROUTER_API_KEY);
    expect(expected).not.toContain(valid.OPENROUTER_TEXT_MODEL);
  });

  it("getEnv returns validated values once configured", async () => {
    const { getEnv } = await loadEnv();
    process.env.OPENROUTER_API_KEY = valid.OPENROUTER_API_KEY;
    process.env.OPENROUTER_TEXT_MODEL = valid.OPENROUTER_TEXT_MODEL;
    process.env.OPENROUTER_IMAGE_MODEL = valid.OPENROUTER_IMAGE_MODEL;
    process.env.OPENROUTER_MODERATION_MODEL = valid.OPENROUTER_MODERATION_MODEL;
    expect(getEnv()).toEqual(valid);
  });
});
