import "server-only";
import { createFixedTtsProvider } from "./fixed-tts-provider";
import { createOpenRouterTtsProvider } from "./openrouter-tts-provider";
import type { SynthesizedAudio, TtsSynthesisOptions, TtsProvider } from "./tts-provider";
import { TtsProviderError } from "./tts-provider";
import type { GenerationMode } from "../../story-generation/server/generation-runtime";

/**
 * Server runtime for AI narration (spec 004, T010).
 *
 * Resolves the TTS provider and orchestrates a single `synthesize` call for the
 * anonymous active-scene text. Provider selection mirrors the generation
 * runtime: `STORIES_TEST_MODE=fake` selects the deterministic offline provider
 * (e2e/visual/dev), otherwise the server-only OpenRouter adapter reading its
 * model/key from `src/lib/env.ts`.
 *
 * Behavior on provider failure is **strictly controlled** (US2): there is NO
 * fallback to browser Web Speech from the server. With AI narration enabled,
 * a provider failure propagates as a typed {@link TtsProviderError} (HTTP
 * 502/429) so the client shows an accessible error; only metadata (no content)
 * is logged.
 */

export type TtsMode = "ai";

export interface TtsRuntime {
  /** Whether AI narration is enabled in this environment (read from env). */
  enabled: boolean;
  /** Synthesizes the scene text, always marking the result `mode: 'ai'`. */
  synthesize(
    text: string,
    opts: TtsSynthesisOptions
  ): Promise<SynthesizedAudio & { mode: TtsMode }>;
}

export interface TtsRuntimeDeps {
  /** Enable AI narration (defaults to the env value). */
  enabled?: boolean;
  /** Provider seam for tests; defaults to the env-resolved provider. */
  provider?: TtsProvider;
  /** Provider selector mirroring `STORIES_TEST_MODE` (`fake` → offline dev). */
  storiesProvider?: string;
  /**
   * Optional generation mode (spec 015). When `demo`, narration always uses
   * the deterministic offline provider (the anonymous demo path never calls a
   * live TTS service), mirroring the generation runtime.
   */
  mode?: GenerationMode;
}

/** Resolves the real provider from env/mode (never used by tests directly). */
function resolveDefaultProvider(mode?: GenerationMode): TtsProvider {
  // Demo path and `STORIES_TEST_MODE=fake` select the deterministic offline
  // dev provider so the anonymous demo / e2e / visual runs never call a live
  // TTS service; the authenticated playground uses the real OpenRouter adapter.
  return mode === "demo" || process.env.STORIES_TEST_MODE === "fake"
    ? createFixedTtsProvider()
    : createOpenRouterTtsProvider();
}

/**
 * Reads the AI-narration toggle directly from `process.env` (mirrors how
 * `generation-runtime.ts` reads `STORIES_TEST_MODE`). We deliberately do NOT
 * call `getEnv()` here: `getEnv()` validates the *whole* server schema at
 * module load, including the story-generation `OPENROUTER_*` credentials that
 * are unrelated to TTS, which would throw during `next build` on a host without
 * those credentials. The OpenRouter TTS adapter resolves its own key/model
 * lazily inside `synthesize`, so nothing here requires a full env validation.
 */
function resolveEnabled(deps: TtsRuntimeDeps): boolean {
  if (deps.enabled !== undefined) return deps.enabled;
  return process.env.AI_NARRATION_ENABLED === "true";
}

export function createTtsRuntime(deps: TtsRuntimeDeps = {}): TtsRuntime {
  const enabled = resolveEnabled(deps);
  const provider = deps.provider ?? resolveDefaultProvider(deps.mode);

  return {
    enabled,
    async synthesize(text, opts) {
      if (!enabled) {
        // Caller (route) must not call this when disabled; this is a safety net.
        throw new TtsProviderError({
          kind: "unavailable",
          message: "AI narration is disabled.",
        });
      }
      try {
        const audio = await provider.synthesize(text, opts);
        return { ...audio, mode: "ai" };
      } catch (error) {
        if (error instanceof TtsProviderError) throw error;
        // Provider surfaced an unexpected (non-typed) failure — normalize to a
        // typed error; never fall back to Web Speech, never retry indefinitely.
        throw new TtsProviderError({
          kind: "unavailable",
          message: "TTS synthesis failed.",
        });
      }
    },
  };
}

/**
 * Always-offline demo TTS runtime (spec 015): mirrors the generation demo
 * runtime so the anonymous `/demo` path never synthesizes with a live model.
 */
export function createDemoTtsRuntime(): TtsRuntime {
  return createTtsRuntime({ mode: "demo" });
}
