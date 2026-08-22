import "server-only";
import {
  envOrDefault,
  readEnvIfNeeded,
} from "../../story-generation/server/provider-core/env-deps";
import type {
  SynthesizedAudio,
  TtsAudioFormat,
  TtsSynthesisOptions,
  TtsProvider,
} from "./tts-provider";
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
  /** Audio format for TTS output (env-driven; see TTS_AUDIO_FORMAT). */
  audioFormat?: string;
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
    audioFormat: envOrDefault(deps.audioFormat, env?.TTS_AUDIO_FORMAT, "mp3"),
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

/** Maps a TTS output-format token (`mp3`/`wav`/`ogg`) to its MIME type. */
function mimeForFormat(format: string): TtsAudioFormat {
  if (format === "wav") return "audio/wav";
  if (format === "ogg") return "audio/ogg";
  return "audio/mpeg";
}

/**
 * Maps the provider `content-type` to a TTS output format based on the expected
 * format variable and ensures it matches what the client expects. Some providers
 * return a generic audio content-type, which is tolerated (dev-only warning).
 */
function audioMimeFromContentType(contentType: string, expectedFormat?: string): string | null {
  if (!expectedFormat) return null;
  const expectedMimeType = mimeForFormat(expectedFormat);
  const subtype = expectedMimeType.split("/")[1] ?? "";
  if (contentType.includes(subtype)) return null;
  if (process.env.NODE_ENV === "development") {
    console.warn(`Expected ${expectedMimeType} but got ${contentType}`);
  }
  return null;
}

async function validateSpeechResponse(
  response: Response,
  expectedFormat?: string
): Promise<Uint8Array> {
  const contentType = response.headers.get("content-type") ?? "";
  const isAudio = contentType.startsWith("audio/");
  if (!response.ok || !isAudio) {
    throw classifyResponseError(response, contentType);
  }

  // Tolerate a provider `content-type` that doesn't exactly carry the expected
  // subtype; the audio bytes are what matter, not the header (dev warning).
  audioMimeFromContentType(contentType, expectedFormat);

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
      const { apiKey, model, voicePtBr, voiceEn, audioFormat, baseUrl, timeoutMs, fetchImpl } =
        resolveDeps(deps);
      const bareModel = stripModelPrefix(model);
      const voice = voiceFor(bareModel, opts.locale, voicePtBr, voiceEn);

      const body: Record<string, unknown> = { model: bareModel, input: text };
      if (voice) body.voice = voice;
      body.response_format = audioFormat;

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

      const audio = await validateSpeechResponse(response, audioFormat);
      return { format: mimeForFormat(audioFormat), audio };
    },
  };
}
