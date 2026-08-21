import { describe, expect, it, vi, afterEach } from "vitest";
import { createTtsRuntime } from "../../src/features/story-read-aloud/server/tts-runtime";
import {
  TtsProviderError,
  type TtsProvider,
  type SynthesizedAudio,
} from "../../src/features/story-read-aloud/server/tts-provider";

/**
 * Deterministic runtime tests (spec 004, T009/T022). No live TTS: the runtime
 * is driven with injected fake providers that never call a network service.
 */

const SCENE_TEXT = "Era uma vez uma estrelinha no céu.";
const LOCALE = { locale: "pt-BR" } as const;

function fakeMp3(): SynthesizedAudio {
  return { format: "audio/mpeg", audio: new Uint8Array([1, 2, 3]) };
}

/** A provider whose behavior/call-count is fully controlled by the test. */
function spyProvider(impl: () => Promise<SynthesizedAudio>) {
  const calls: Array<{ text: string; opts: { locale: "pt-BR" | "en" } }> = [];
  const provider: TtsProvider = {
    async synthesize(text, opts) {
      calls.push({ text, opts });
      return impl();
    },
  };
  return { provider, calls };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createTtsRuntime (T009 — happy path)", () => {
  it("synthesize resolves with mode:'ai' and delegates to the provider", async () => {
    const { provider, calls } = spyProvider(async () => fakeMp3());
    const runtime = createTtsRuntime({ enabled: true, provider });

    const result = await runtime.synthesize(SCENE_TEXT, LOCALE);

    expect(result).toMatchObject({ mode: "ai", format: "audio/mpeg" });
    expect(result.audio).toEqual(new Uint8Array([1, 2, 3]));
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({ text: SCENE_TEXT, opts: { locale: "pt-BR" } });
  });

  it("exposes enabled from deps", () => {
    const runtime = createTtsRuntime({
      enabled: true,
      provider: spyProvider(async () => fakeMp3()).provider,
    });
    expect(runtime.enabled).toBe(true);
  });
});

describe("createTtsRuntime (T022 — controlled failure, no fallback, no retry)", () => {
  it("rejects with a typed unavailable error when narration is disabled", async () => {
    const { provider, calls } = spyProvider(async () => fakeMp3());
    const runtime = createTtsRuntime({ enabled: false, provider });

    await expect(runtime.synthesize(SCENE_TEXT, LOCALE)).rejects.toMatchObject({
      name: "TtsProviderError",
      kind: "unavailable",
    });
    // The provider must never be reached when narration is off.
    expect(calls).toHaveLength(0);
  });

  it("propagates a typed provider error as-is (no retry, no fallback)", async () => {
    const expected = new TtsProviderError({ kind: "timeout", message: "upstream timed out" });
    const { provider, calls } = spyProvider(async () => {
      throw expected;
    });
    const runtime = createTtsRuntime({ enabled: true, provider });

    await expect(runtime.synthesize(SCENE_TEXT, LOCALE)).rejects.toBe(expected);
    expect(calls).toHaveLength(1);
  });

  it("normalizes an unexpected provider error to a typed unavailable error", async () => {
    const { provider, calls } = spyProvider(async () => {
      throw new Error("something went sideways");
    });
    const runtime = createTtsRuntime({ enabled: true, provider });

    await expect(runtime.synthesize(SCENE_TEXT, LOCALE)).rejects.toMatchObject({
      name: "TtsProviderError",
      kind: "unavailable",
    });
    expect(calls).toHaveLength(1);
  });
});

describe("createTtsRuntime (T010 — default provider resolution)", () => {
  // The TTS provider follows `AI_NARRATION_ENABLED` (not `STORIES_TEST_MODE`),
  // so a fake-generation run can still exercise real AI narration. The demo
  // path is always offline regardless of that flag.
  it("resolves the deterministic offline provider for the demo mode", async () => {
    vi.stubEnv("AI_NARRATION_ENABLED", "true");
    // The fixed offline provider goes through `getEnv()`, which validates the
    // full server env set. Stub the schema-required keys so synthesis succeeds.
    vi.stubEnv("OPENROUTER_API_KEY", "sk-test");
    vi.stubEnv("OPENCODE_GO_API_KEY", "sk-test");
    vi.stubEnv("PLANNER_MODEL", "openrouter/qwen/qwen3.7-flash");
    vi.stubEnv("WRITER_MODEL", "openrouter/qwen/qwen3.7-flash");
    vi.stubEnv("MODERATOR_MODEL", "openrouter/qwen/qwen3.7-flash");
    vi.stubEnv("ILLUSTRATOR_MODEL", "openrouter/qwen/qwen3.7-flash");
    vi.stubEnv("READER_MODEL", "openrouter/fish-audio/s2.1-pro-free:free");
    const runtime = createTtsRuntime({ mode: "demo", enabled: true });
    expect(runtime.enabled).toBe(true);
    const result = await runtime.synthesize(SCENE_TEXT, LOCALE);
    expect(result.format).toBe("audio/mpeg");
    expect(result.audio.length).toBeGreaterThan(0);
  });

  it("resolves the deterministic offline provider when AI narration is off (playground)", async () => {
    vi.stubEnv("AI_NARRATION_ENABLED", "false");
    vi.stubEnv("STORIES_TEST_MODE", "fake");
    const runtime = createTtsRuntime();
    expect(runtime.enabled).toBe(false);
    // Disabled runtime answers off; the client delegates to Web Speech.
    await expect(runtime.synthesize(SCENE_TEXT, LOCALE)).rejects.toMatchObject({
      kind: "unavailable",
    });
  });

  it("selects the real OpenRouter adapter for the playground when AI narration is on", async () => {
    vi.stubEnv("AI_NARRATION_ENABLED", "true");
    vi.stubEnv("STORIES_TEST_MODE", "fake");
    // No `READER_MODEL`/credential stubbed → the real adapter fails lazily,
    // proving the playground no longer falls back to the fixed provider.
    const runtime = createTtsRuntime();
    expect(runtime.enabled).toBe(true);
    await expect(runtime.synthesize(SCENE_TEXT, LOCALE)).rejects.toMatchObject({
      name: "TtsProviderError",
    });
  });
});
