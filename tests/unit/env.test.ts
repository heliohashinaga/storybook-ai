import { describe, expect, it, beforeEach } from "vitest";
import { parseEnv, getEnv } from "../../src/lib/env";

describe("env server validation", () => {
  const valid = {
    OPENAI_API_KEY: "sk-test-123",
    OPENAI_TEXT_MODEL: "gpt-4o-mini",
    OPENAI_IMAGE_MODEL: "dall-e-3",
  };

  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_TEXT_MODEL;
    delete process.env.OPENAI_IMAGE_MODEL;
  });

  it("parses a fully configured environment", () => {
    const result = parseEnv({ ...valid });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(valid);
    }
  });

  it("rejects a missing API key", () => {
    const result = parseEnv({ OPENAI_TEXT_MODEL: valid.OPENAI_TEXT_MODEL, OPENAI_IMAGE_MODEL: valid.OPENAI_IMAGE_MODEL });
    expect(result.success).toBe(false);
  });

  it("rejects an empty model identifier", () => {
    const result = parseEnv({ ...valid, OPENAI_TEXT_MODEL: "" });
    expect(result.success).toBe(false);
  });

  it("getEnv throws a safe generic error when required vars are missing", () => {
    expect(() => getEnv()).toThrow();
  });

  it("getEnv returns validated values once configured", () => {
    process.env.OPENAI_API_KEY = valid.OPENAI_API_KEY;
    process.env.OPENAI_TEXT_MODEL = valid.OPENAI_TEXT_MODEL;
    process.env.OPENAI_IMAGE_MODEL = valid.OPENAI_IMAGE_MODEL;
    expect(getEnv()).toEqual(valid);
  });
});
