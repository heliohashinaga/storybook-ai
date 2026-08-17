import "server-only";
import OpenAI from "openai";
import { z } from "zod";
import { getEnv } from "../../../lib/env";
import type { SynthesizedAudio, TtsSynthesisOptions, TtsProvider } from "./tts-provider";
import { TtsProviderError, type TtsProviderErrorKind } from "./tts-provider";

/**
 * Server-only OpenRouter TTS adapter (spec 004, T008).
 *
 * Synthesizes the anonymous active-scene text into transient MP3 bytes using
 * the configured read-aloud model (`READER_MODEL`, or an injected value for
 * tests) with `output_modalities: "speech"`. It reads the API key/model only
 * from the validated server env (`src/lib/env.ts`); raw provider output is
 * never logged or returned — only typed bytes / typed `TtsProviderError`.
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
  /** Number of automatic retries on transient failures (default 2). */
  maxRetries?: number;
  /** Replaceable transport; defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

function resolveDeps(deps: OpenRouterTtsDeps) {
  // Production reads the key/model only from the validated server env; tests
  // may inject them and skip `getEnv()` entirely.
  const requiresEnv = deps.apiKey === undefined || deps.model === undefined;
  const env = requiresEnv ? getEnv() : null;
  return {
    apiKey: deps.apiKey ?? env?.OPENROUTER_API_KEY ?? "",
    model: deps.model ?? env?.READER_MODEL ?? "",
    baseUrl: deps.baseUrl ?? DEFAULT_BASE_URL,
    timeoutMs: deps.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    maxRetries: deps.maxRetries ?? 2,
    fetchImpl: deps.fetchImpl ?? fetch,
  };
}

/** Response envelope from OpenRouter chat completions that carry audio. */
const ttsResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          audio: z
            .object({
              data: z.string().min(1), // base64 MP3
            })
            .optional(),
          content: z.string().nullish(),
        }),
      })
    )
    .min(1),
});

/** Maps a transport/SDK failure to a typed {@link TtsProviderError}. */
function toTtsProviderError(error: unknown, kind: TtsProviderErrorKind): never {
  if (error instanceof TtsProviderError) throw error;
  if (error instanceof OpenAI.APIConnectionTimeoutError) {
    throw new TtsProviderError({ kind: "timeout", message: "TTS provider timed out." });
  }
  throw new TtsProviderError({ kind, message: "TTS provider failed." });
}

/**
 * Creates an OpenRouter-backed {@link TtsProvider}. The SDK client is built
 * lazily on first use so importing this module never requires TTS env to be
 * present; env is validated on the first real synthesis.
 */
export function createOpenRouterTtsProvider(deps: OpenRouterTtsDeps = {}): TtsProvider {
  let client: OpenAI | undefined;
  const getClient = () => {
    const { apiKey, baseUrl, timeoutMs, maxRetries, fetchImpl } = resolveDeps(deps);
    return (client ??= new OpenAI({
      apiKey,
      baseURL: baseUrl,
      timeout: timeoutMs,
      maxRetries,
      fetch: fetchImpl,
    }));
  };

  return {
    async synthesize(text: string, opts: TtsSynthesisOptions): Promise<SynthesizedAudio> {
      const { model, fetchImpl } = resolveDeps(deps);
      try {
        const completion = await getClient().chat.completions.create({
          model,
          modalities: ["text", "audio"],
          audio: { voice: opts.locale === "en" ? "verse" : "ember", format: "mp3" },
          messages: [
            {
              role: "user",
              content: text,
            },
          ],
        });
        const parsed = ttsResponseSchema.parse(completion as unknown as unknown);
        const encoded = parsed.choices[0]?.message?.audio?.data;
        if (!encoded) {
          throw new TtsProviderError({
            kind: "invalid",
            message: "TTS provider returned no audio.",
          });
        }
        const audio = Uint8Array.from(Buffer.from(encoded, "base64"));
        // Retain a reference to `fetchImpl` to keep the transport seam in scope.
        void fetchImpl;
        return { format: "audio/mpeg", audio };
      } catch (error) {
        if (error instanceof z.ZodError) {
          throw new TtsProviderError({
            kind: "invalid",
            message: "TTS provider returned an invalid payload.",
          });
        }
        toTtsProviderError(error, "unavailable");
      }
    },
  };
}
