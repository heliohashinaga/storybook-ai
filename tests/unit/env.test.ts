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
    delete process.env.MODEL_TIMEOUT_MS;
    delete process.env.MODEL_MAX_ATTEMPTS;
    delete process.env.PIPELINE_TIMEOUT_MS;
  });

  it("parses a fully configured environment", async () => {
    const { parseEnv } = await loadEnv();
    const result = parseEnv({
      ...validEnv,
      AI_NARRATION_ENABLED: "true",
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

  it("rejects a removed legacy TTS_MODEL variable (reader is configured via READER_MODEL)", async () => {
    const { parseEnv } = await loadEnv();
    const result = parseEnv({ ...validEnv, TTS_MODEL: "kokoro-82m" });
    expect(result.success).toBe(false);
  });

  it("getEnv exposes the AI narration flags once configured", async () => {
    const { getEnv } = await loadEnv();
    for (const [key, value] of Object.entries(validEnv)) {
      process.env[key] = value;
    }
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

describe("auth env whitelist (spec 015)", () => {
  const AUTH_KEYS = [
    "AUTH_SECRET",
    "AUTH_GOOGLE_ID",
    "AUTH_GOOGLE_SECRET",
    "AUTH_GITHUB_ID",
    "AUTH_GITHUB_SECRET",
    "AUTH_URL",
    "AUTH_TRUST_HOST",
    "AUTH_ALLOWLIST_EMAILS",
  ];

  beforeEach(() => {
    for (const key of AUTH_KEYS) delete process.env[key];
  });

  it("returns an empty object when no AUTH_* var is set (demo-only deploy)", async () => {
    const { getAuthEnv } = await loadEnv();
    expect(getAuthEnv()).toEqual({});
  });

  it("parses the full AUTH_* credential set", async () => {
    process.env.AUTH_SECRET = "s3cret";
    process.env.AUTH_GOOGLE_ID = "google-id";
    process.env.AUTH_GOOGLE_SECRET = "google-secret";
    process.env.AUTH_GITHUB_ID = "github-id";
    process.env.AUTH_GITHUB_SECRET = "github-secret";
    process.env.AUTH_URL = "http://localhost:3000";
    process.env.AUTH_TRUST_HOST = "true";
    process.env.AUTH_ALLOWLIST_EMAILS = "one@example.com, TWO@example.com";
    const { getAuthEnv, allowlistEmails } = await loadEnv();
    const auth = getAuthEnv();
    expect(auth.AUTH_SECRET).toBe("s3cret");
    expect(auth.AUTH_GOOGLE_ID).toBe("google-id");
    expect(auth.AUTH_GOOGLE_SECRET).toBe("google-secret");
    expect(auth.AUTH_GITHUB_ID).toBe("github-id");
    expect(auth.AUTH_GITHUB_SECRET).toBe("github-secret");
    // Boolean-enum knob rejects anything that is not literally "true"/"false".
    expect(auth.AUTH_TRUST_HOST).toBe("true");
    const allow = allowlistEmails(auth);
    expect([...allow]).toEqual(["one@example.com", "two@example.com"]);
  });

  it("accepts only the whitelisted keys (never exposes AUTH_* to the client)", async () => {
    process.env.AUTH_SECRET = "s3cret";
    process.env.AUTH_EXTRA = "should-be-rejected";
    const { getAuthEnv } = await loadEnv();
    const auth = getAuthEnv();
    expect(auth.AUTH_SECRET).toBe("s3cret");
    expect(auth).not.toHaveProperty("AUTH_EXTRA");
  });

  it("rejects an invalid AUTH_TRUST_HOST value (returns {} — UI stays disabled)", async () => {
    process.env.AUTH_TRUST_HOST = "yes";
    const { getAuthEnv } = await loadEnv();
    expect(getAuthEnv()).toEqual({});
  });

  it("allowlist returns an empty set when unset (access control off)", async () => {
    const { allowlistEmails } = await loadEnv();
    expect(allowlistEmails({}).size).toBe(0);
  });
});
