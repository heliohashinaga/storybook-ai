import { describe, expect, it, beforeEach, vi } from "vitest";

/**
 * Narration model resolution by environment (spec 006 / legacy spec 004 T018,
 * SC-007) — consolidated onto the per-agent `READER_MODEL`.
 *
 * The read-aloud (neural TTS) voice model is configured via the server-only
 * `READER_MODEL` env var — the same per-agent model the reader/speech capability
 * routes through (spec 006). This test pins that resolution deterministically
 * (stubbed env, no TTS call, no fallback to the system voice — model selection
 * happens entirely server-side). `AI_NARRATION_ENABLED` stays the separate
 * switch that turns narration on/off (browser Web Speech when off).
 */

const required: Record<string, string> = {
  OPENROUTER_API_KEY: "sk-test-123",
  OPENCODE_GO_API_KEY: "sk-opencode-test-123",
  PLANNER_MODEL: "opencode-go/some-org/text-model",
  WRITER_MODEL: "opencode-go/some-org/text-model",
  MODERATOR_MODEL: "openrouter/some-org/moderation-model",
  ILLUSTRATOR_MODEL: "openrouter/some-org/image-model",
};

/** Cost-efficient default narration profile (Kokoro 82M via OpenRouter). */
const COST_EFFICIENT_MODEL = "openrouter/hexgrad/kokoro-82m";
/** Premium narration profile. */
const PREMIUM_MODEL = "openrouter/openai/tts-1-hd";

/**
 * Re-import the env module fresh on every test so the module-level `cached`
 * value can never leak between cases (deterministic, order-independent).
 */
async function loadEnv() {
  vi.resetModules();
  return await import("../../src/lib/env");
}

describe("narration model (READER_MODEL) env resolution (T018 / SC-007)", () => {
  beforeEach(() => {
    delete process.env.AI_NARRATION_ENABLED;
  });

  it("resolves a cost-efficient narration profile from env", async () => {
    const { parseEnv } = await loadEnv();
    const result = parseEnv({ ...required, READER_MODEL: COST_EFFICIENT_MODEL });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.READER_MODEL).toBe(COST_EFFICIENT_MODEL);
    }
  });

  it("resolves a premium narration profile from env", async () => {
    const { parseEnv } = await loadEnv();
    const result = parseEnv({ ...required, READER_MODEL: PREMIUM_MODEL });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.READER_MODEL).toBe(PREMIUM_MODEL);
    }
  });

  it("switches profiles without any code change and keeps narration enabled", async () => {
    const { parseEnv } = await loadEnv();

    const cost = parseEnv({
      ...required,
      READER_MODEL: COST_EFFICIENT_MODEL,
      AI_NARRATION_ENABLED: "true",
    });
    expect(cost.success).toBe(true);
    if (cost.success) {
      expect(cost.data.READER_MODEL).toBe(COST_EFFICIENT_MODEL);
      expect(cost.data.AI_NARRATION_ENABLED).toBe(true);
    }

    const premium = parseEnv({
      ...required,
      READER_MODEL: PREMIUM_MODEL,
      AI_NARRATION_ENABLED: "true",
    });
    expect(premium.success).toBe(true);
    if (premium.success) {
      expect(premium.data.READER_MODEL).toBe(PREMIUM_MODEL);
      expect(premium.data.AI_NARRATION_ENABLED).toBe(true);
    }
  });

  it("rejects a READER_MODEL without a provider prefix (fail-fast, no silent system fallback)", async () => {
    const { parseEnv } = await loadEnv();
    const result = parseEnv({ ...required, READER_MODEL: "hexgrad/kokoro-82m" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing READER_MODEL (required per-agent model, never optional)", async () => {
    const { parseEnv } = await loadEnv();
    const result = parseEnv({ ...required });
    expect(result.success).toBe(false);
  });
});
