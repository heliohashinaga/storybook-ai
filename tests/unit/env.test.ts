import { describe, expect, it, beforeEach, vi } from "vitest";
import type { ServerEnv } from "../../src/lib/env";

const valid: ServerEnv = {
  OPENAI_API_KEY: "sk-test-123",
  OPENAI_TEXT_MODEL: "gpt-4o-mini",
  OPENAI_IMAGE_MODEL: "dall-e-3",
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
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_TEXT_MODEL;
    delete process.env.OPENAI_IMAGE_MODEL;
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
      OPENAI_TEXT_MODEL: valid.OPENAI_TEXT_MODEL,
      OPENAI_IMAGE_MODEL: valid.OPENAI_IMAGE_MODEL,
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty model identifier", async () => {
    const { parseEnv } = await loadEnv();
    const result = parseEnv({ ...valid, OPENAI_TEXT_MODEL: "" });
    expect(result.success).toBe(false);
  });

  it("getEnv throws a safe generic error that does not leak a config value", async () => {
    const { getEnv } = await loadEnv();
    expect(() => getEnv()).toThrow(
      "Server environment is missing required provider configuration."
    );
    // The generic message must never embed any environment value.
    const expected = "Server environment is missing required provider configuration.";
    expect(expected).not.toContain(valid.OPENAI_API_KEY);
    expect(expected).not.toContain(valid.OPENAI_TEXT_MODEL);
    expect(expected).not.toContain(valid.OPENAI_IMAGE_MODEL);
  });

  it("getEnv returns validated values once configured", async () => {
    const { getEnv } = await loadEnv();
    process.env.OPENAI_API_KEY = valid.OPENAI_API_KEY;
    process.env.OPENAI_TEXT_MODEL = valid.OPENAI_TEXT_MODEL;
    process.env.OPENAI_IMAGE_MODEL = valid.OPENAI_IMAGE_MODEL;
    expect(getEnv()).toEqual(valid);
  });
});
