import "server-only";
import {
  envOrDefault,
  readEnvIfNeeded,
} from "../../story-generation/server/provider-core/env-deps";
import type { SynthesizedAudio, TtsSynthesisOptions, TtsProvider } from "./tts-provider";
import { TtsProviderError, type TtsProviderErrorKind } from "./tts-provider";

/**
 * Server-only OpenRouter TTS adapter (spec 004, T008).
 *
 * Synthesizes the anonymous active-scene text into transient audio bytes using
 * the configured read-aloud model (`READER_MODEL`, or an injected value for
 * tests) via OpenRouter's `/audio/speech` endpoint. It reads the API
 * key/model only from the validated server env (`src/lib/env.ts`); raw
 * provider output is never logged or returned — only typed bytes / typed
 * `TtsProviderError`.
 *
 * The transport is a single injectable `fetchImpl` (defaults to global `fetch`)
 * so every test is deterministic with no live TTS.
 */

const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_TIMEOUT_MS = 60_000;

/** Overridable seams for deterministic tests (production defaults to env). */
export interface OpenRouterTtsDeps {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  timeoutMs?: number;
  /** Optional per-locale voice overrides (env-driven; see READER_VOICE_*). */
  voicePtBr?: string;
  voiceEn?: string;
  /** Replaceable transport; defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

/** Strips an `openrouter/` (or any provider) prefix so only the bare model id reaches the API. */
function stripModelPrefix(model: string): string {
  const idx = model.indexOf("/");
  return idx === -1 ? model : model.slice(idx + 1);
}

function resolveDeps(deps: OpenRouterTtsDeps) {
  // Production reads the key/model/voices only from the validated server env;
  // tests may inject them and skip `getEnv()` entirely. Voices are read from
  // the same env object (present when key/model are env-sourced), falling back
  // to defaults when injected deps skip `getEnv()`.
  const fields = [deps.apiKey, deps.model] as const;
  const env = readEnvIfNeeded(fields);
  return {
    apiKey: envOrDefault(deps.apiKey, env?.OPENROUTER_API_KEY, ""),
    model: envOrDefault(deps.model, env?.READER_MODEL, ""),
    voicePtBr: envOrDefault(deps.voicePtBr, env?.READER_VOICE_PT_BR, "af_heart"),
    voiceEn: envOrDefault(deps.voiceEn, env?.READER_VOICE_EN, "am_michael"),
    baseUrl: envOrDefault(deps.baseUrl, undefined, DEFAULT_BASE_URL),
    timeoutMs: envOrDefault(deps.timeoutMs, undefined, DEFAULT_TIMEOUT_MS),
    fetchImpl: envOrDefault(deps.fetchImpl, undefined, fetch),
  };
}

/** Maps a transport/SDK failure to a typed {@link TtsProviderError}. */
function toTtsProviderError(error: unknown, kind: TtsProviderErrorKind): never {
  if (error instanceof TtsProviderError) throw error;
  throw new TtsProviderError({ kind, message: "TTS provider failed." });
}

/**
 * Kokoro exposes named voices; other speech models (e.g. Fish Audio) reject the
 * `voice` field, so we only send it for Kokoro. The locale picks the configured
 * voice (env-overridable via READER_VOICE_*), falling back to a sensible default.
 */
function voiceFor(
  model: string,
  locale: string,
  voicePtBr: string,
  voiceEn: string
): string | undefined {
  if (!model.includes("kokoro")) return undefined;
  return locale === "en" ? voiceEn : voicePtBr;
}

function classifyResponseError(response: Response, contentType: string): TtsProviderError {
  const detail = contentType.includes("json") ? "" : `status ${response.status}`;
  const kind: TtsProviderErrorKind =
    contentType.includes("json") && response.status === 422
      ? "invalid"
      : contentType.includes("json")
        ? "unavailable"
        : "invalid";
  return new TtsProviderError({
    kind,
    message: `TTS provider failed: ${detail.slice(0, 200)}`,
  });
}

async function validateSpeechResponse(response: Response): Promise<Uint8Array> {
  const contentType = response.headers.get("content-type") ?? "";
  const isAudio = contentType.startsWith("audio/");
  if (!response.ok || !isAudio) {
    throw classifyResponseError(response, contentType);
  }

  const audio = new Uint8Array(await response.arrayBuffer());
  if (audio.length === 0) {
    throw new TtsProviderError({ kind: "invalid", message: "TTS provider returned empty audio." });
  }
  return audio;
}

/**
 * Creates an OpenRouter-backed {@link TtsProvider} that calls the `/audio/speech`
 * endpoint (not chat completions). The client is built lazily on first use so
 * importing this module never requires TTS env to be present.
 */
export function createOpenRouterTtsProvider(deps: OpenRouterTtsDeps = {}): TtsProvider {
  return {
    async synthesize(text: string, opts: TtsSynthesisOptions): Promise<SynthesizedAudio> {
      const { apiKey, model, voicePtBr, voiceEn, baseUrl, timeoutMs, fetchImpl } =
        resolveDeps(deps);
      const bareModel = stripModelPrefix(model);
      const voice = voiceFor(bareModel, opts.locale, voicePtBr, voiceEn);

      // MP3 is the canonical format: we must ask for it explicitly, otherwise the
      // provider picks its own default (often WAV/OGG) and the client would get
      // a Blob whose bytes don't match the hardcoded `audio/mpeg` content type
      // below (NotSupportedError on playback).
      const body: Record<string, unknown> = {
        model: bareModel,
        input: text,
        response_format: "mp3",
      };
      if (voice) body.voice = voice;

      let response: Response;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        response = await fetchImpl(`${baseUrl}/audio/speech`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        clearTimeout(timer);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          throw new TtsProviderError({ kind: "timeout", message: "TTS provider timed out." });
        }
        toTtsProviderError(error, "unavailable");
      }

      const audio = await validateSpeechResponse(response);
      return { format: "audio/mpeg", audio };
    },
  };
}
