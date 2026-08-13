import "server-only";
import { z } from "zod";

/**
 * Canonical providers understood by capability routing (spec 005 FR-002/D3).
 * The provider for each capacity is derived exclusively from the prefix of the
 * `*_MODEL` value (first segment before the first `/`); there is **no**
 * defaultProvider. Both `opencode-go` and `openrouter` can serve any capacity.
 */
export const PROVIDER_IDS = ["opencode-go", "openrouter"] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

const envSchema = z
  .object({
    OPENROUTER_API_KEY: z.string().min(1),
    OPENCODE_GO_API_KEY: z.string().min(1),
    /**
     * Per-capability model identifiers in `provider/model` convention. The first
     * segment before the first `/` identifies the provider; a value without a
     * known provider prefix (or with an unknown one) is a boot-time config
     * error, never silent (spec 005 FR-002).
     */
    TEXT_MODEL: z.string().min(1).refine(hasKnownProviderPrefix, {
      message:
        "TEXT_MODEL must name a provider via its first segment (opencode-go|openrouter), e.g. opencode-go/qwen/qwen3.7-flash.",
    }),
    IMAGE_MODEL: z.string().min(1).refine(hasKnownProviderPrefix, {
      message: "IMAGE_MODEL must name a provider via its first segment (opencode-go|openrouter).",
    }),
    MODERATION_MODEL: z.string().min(1).refine(hasKnownProviderPrefix, {
      message:
        "MODERATION_MODEL must name a provider via its first segment (opencode-go|openrouter).",
    }),
    /**
     * Test-only mode switch for the generation and TTS runtimes (read by
     * `generation-runtime.ts` and `tts-runtime.ts`). `fake` selects the
     * deterministic offline dev providers for e2e/visual/dev runs and lets the
     * environment omit provider credentials entirely. Absent (default) means the
     * real providers, whose per-capability routing is derived from the value of
     * each `*_MODEL` (see spec 005) — never from this switch.
     */
    STORIES_TEST_MODE: z.enum(["fake"]).optional(),
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
    TTS_MODEL: z.string().min(1).optional(),
  })
  .strict();

/** Returns the first path segment of `model` (the provider prefix), if any. */
export function providerPrefixOf(model: string): string | undefined {
  const idx = model.indexOf("/");
  return idx === -1 ? undefined : model.slice(0, idx);
}

/**
 * Returns the effective model identifier with its provider prefix removed
 * (matches data-model `RoutedConfig.model`). Prefixed `provider/rest` env
 * values resolve to `rest`; a value without a prefix is returned unchanged
 * (the schema already rejects unknown/no-prefix values at boot).
 */
export function modelWithoutProviderPrefix(model: string): string {
  const idx = model.indexOf("/");
  return idx === -1 ? model : model.slice(idx + 1);
}

function hasKnownProviderPrefix(model: string): boolean {
  const prefix = providerPrefixOf(model);
  return prefix !== undefined && (PROVIDER_IDS as readonly string[]).includes(prefix);
}

export type ServerEnv = z.infer<typeof envSchema>;

let cached: ServerEnv | undefined;

/**
 * Validates a candidate environment object (testable in isolation).
 * Returns a Zod result so callers decide how to surface the failure.
 */
export function parseEnv(source: NodeJS.ProcessEnv | Record<string, string | undefined>) {
  return envSchema.safeParse(source);
}

/** Keys the server env schema owns, plus legacy vars it must reject under D5-C. */
const KNOWN_KEYS = [
  // new per-capability schema
  "OPENROUTER_API_KEY",
  "OPENCODE_GO_API_KEY",
  "TEXT_MODEL",
  "IMAGE_MODEL",
  "MODERATION_MODEL",
  "STORIES_TEST_MODE",
  "AI_NARRATION_ENABLED",
  "TTS_MODEL",
  // removed legacy vars (rejected by .strict() under D5-C: no compat)
  "OPENROUTER_TEXT_MODEL",
  "OPENROUTER_IMAGE_MODEL",
  "OPENROUTER_MODERATION_MODEL",
] as const;

/**
 * Returns the validated server environment, reading from `process.env`.
 * Only schema-owned keys (plus legacy vars it must reject) are picked so the
 * strict schema never sees unrelated platform variables, while still
 * failing fast on any leftover legacy `OPENROUTER_*` model config (D5-C).
 * Throws a safe, generic error when required provider variables are missing.
 */
export function getEnv(): ServerEnv {
  if (cached) return cached;
  const source: Record<string, string> = {};
  for (const key of KNOWN_KEYS) {
    const value = process.env[key];
    // Only materialize defined keys: `.strict()` rejects present-but-undefined
    // members, and an absent legacy var must not fail the parse.
    if (value !== undefined) source[key] = value;
  }
  const parsed = parseEnv(source);
  if (!parsed.success) {
    throw new Error("Server environment is missing required provider configuration.");
  }
  cached = parsed.data;
  return cached;
}
