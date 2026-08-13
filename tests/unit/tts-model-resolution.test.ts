import { describe, expect, it, beforeEach, vi } from "vitest";

/**
 * Model resolution by environment (spec 004, T018 / SC-007).
 *
 * The cost-vs-naturalness profile is configured purely via the server-only
 * `TTS_MODEL` env var. This test pins the resolution
 * deterministically (stubbed env, no TTS call, no fallback to the system
 * voice — model selection happens entirely server-side).
 */

const required: Record<string, string> = {
  OPENROUTER_API_KEY: "sk-test-123",
  OPENCODE_GO_API_KEY: "sk-opencode-test-123",
  TEXT_MODEL: "opencode-go/some-org/text-model",
  IMAGE_MODEL: "openrouter/some-org/image-model",
  MODERATION_MODEL: "openrouter/some-org/moderation-model",
};

/** Cost-efficient default profile (research.md §5, Kokoro 82M via OpenRouter). */
const COST_EFFICIENT_MODEL = "hexgrad/kokoro-82m";
/** Premium profile, switchable per environment (FR-011 / Q2-C). */
const PREMIUM_MODEL = "openai/tts-1-hd";

/**
 * Re-import the env module fresh on every test so the module-level `cached`
 * value can never leak between cases (deterministic, order-independent).
 */
async function loadEnv() {
  vi.resetModules();
  return await import("../../src/lib/env");
}

describe("TTS_MODEL env resolution (T018 / SC-007)", () => {
  beforeEach(() => {
    delete process.env.TTS_MODEL;
    delete process.env.AI_NARRATION_ENABLED;
  });

  it("resolves a cost-efficient model profile from env", async () => {
    const { parseEnv } = await loadEnv();
    const result = parseEnv({ ...required, TTS_MODEL: COST_EFFICIENT_MODEL });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.TTS_MODEL).toBe(COST_EFFICIENT_MODEL);
    }
  });

  it("resolves a premium model profile from env", async () => {
    const { parseEnv } = await loadEnv();
    const result = parseEnv({ ...required, TTS_MODEL: PREMIUM_MODEL });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.TTS_MODEL).toBe(PREMIUM_MODEL);
    }
  });

  it("resolves different profiles without any code change and keeps narration enabled", async () => {
    const { parseEnv } = await loadEnv();

    const cost = parseEnv({
      ...required,
      TTS_MODEL: COST_EFFICIENT_MODEL,
      AI_NARRATION_ENABLED: "true",
    });
    expect(cost.success).toBe(true);
    if (cost.success) {
      expect(cost.data.TTS_MODEL).toBe(COST_EFFICIENT_MODEL);
      expect(cost.data.AI_NARRATION_ENABLED).toBe(true);
    }

    const premium = parseEnv({
      ...required,
      TTS_MODEL: PREMIUM_MODEL,
      AI_NARRATION_ENABLED: "true",
    });
    expect(premium.success).toBe(true);
    if (premium.success) {
      expect(premium.data.TTS_MODEL).toBe(PREMIUM_MODEL);
      expect(premium.data.AI_NARRATION_ENABLED).toBe(true);
    }
  });

  it("rejects an empty TTS model identifier (fail-fast, no silent system fallback)", async () => {
    const { parseEnv } = await loadEnv();
    const result = parseEnv({ ...required, TTS_MODEL: "" });
    expect(result.success).toBe(false);
  });

  it("keeps model selection optional so narration can stay fully disabled", async () => {
    const { parseEnv } = await loadEnv();
    const result = parseEnv({ ...required });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.TTS_MODEL).toBeUndefined();
      expect(result.data.AI_NARRATION_ENABLED).toBe(false);
    }
  });
});
