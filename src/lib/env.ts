import "server-only";
import { z } from "zod";

/**
 * Server environment contract. Read only by server-only provider adapters
 * and the generation route. Values are validated with Zod at first access so
 * a missing or malformed provider configuration fails fast with a safe,
 * generic error — never by leaking the raw environment value.
 */
const envSchema = z.object({
  OPENROUTER_API_KEY: z.string().min(1),
  OPENROUTER_TEXT_MODEL: z.string().min(1),
  OPENROUTER_IMAGE_MODEL: z.string().min(1),
  OPENROUTER_MODERATION_MODEL: z.string().min(1),
  /**
   * Provider selector for the generation runtime (read by
   * `generation-runtime.ts`, not by the OpenRouter adapter which always uses
   * the real provider). `fake` selects the deterministic dev provider for
   * e2e/visual/dev runs; anything else or absent means the production
   * OpenRouter provider. Optional so fake-run environments can omit the
   * OpenRouter credentials entirely.
   */
  STORIES_PROVIDER: z.enum(["openrouter", "fake"]).optional(),
  /**
   * Whether AI narration (natural TTS voice) is enabled. Read only by the
   * server-only TTS adapters (`story-read-aloud/server`). When `true`, the
   * anonymous scene text is sent to the configured neural TTS model and
   * returned as transient audio; on provider failure an accessible error is
   * shown (never a fallback to browser Web Speech). When `false`/absent
   * (default), narration uses the browser's native speechSynthesis. Never
   * exposed to the client.
   */
  AI_NARRATION_ENABLED: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? false : v === "true")),
  /**
   * Server-only TTS model identifier (cost-vs-naturalness profile configurable
   * per environment, spec 004 FR-011/Q2-C). Reference: Kokoro 82M via
   * OpenRouter, billed per character. Optional so narration can be left fully
   * disabled (Web Speech) without any provider credentials.
   */
  OPENROUTER_TTS_MODEL: z.string().min(1).optional(),
});

export type ServerEnv = z.infer<typeof envSchema>;

let cached: ServerEnv | undefined;

/**
 * Validates a candidate environment object (testable in isolation).
 * Returns a Zod result so callers decide how to surface the failure.
 */
export function parseEnv(source: NodeJS.ProcessEnv | Record<string, string | undefined>) {
  return envSchema.safeParse(source);
}

/**
 * Returns the validated server environment, reading from `process.env`.
 * Throws a safe, generic error when required provider variables are missing.
 */
export function getEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = parseEnv(process.env);
  if (!parsed.success) {
    throw new Error("Server environment is missing required provider configuration.");
  }
  cached = parsed.data;
  return cached;
}
