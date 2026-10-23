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

/**
 * Shape of `PLAYGROUND_PASSWORD_HASH`: `scrypt:<saltHex>:<keyHex>` — a scrypt
 * key-derivation output, never a fast hash of the password (ADR 0015). 16-byte
 * salt (32 hex) + 32-byte derived key (64 hex). Single source of truth shared
 * with `features/auth/server/gate.ts`, which does the derivation.
 *
 * The separator is `:`, **not** `$`: Next.js runs `.env` values through dotenv
 * expansion, so a `$`-separated value (`scrypt$<salt>$<key>`) is truncated to
 * `scrypt` at load time (the `$<salt>` reads as an empty variable reference).
 */
export const PASSWORD_HASH_PATTERN = /^scrypt:[0-9a-f]{32}:[0-9a-f]{64}$/i;

const envSchema = z
  .object({
    OPENROUTER_API_KEY: z.string().min(1),
    OPENCODE_GO_API_KEY: z.string().min(1),
    /**
     * Per-agent model identifiers in `provider/model` convention. The first
     * segment before the first `/` identifies the provider; a value without a
     * known provider prefix (or with an unknown one) is a boot-time config
     * error, never silent (spec 006: each pipeline agent routes to its own
     * model/provider).
     */
    PLANNER_MODEL: z.string().min(1).refine(hasKnownProviderPrefix, {
      message:
        "PLANNER_MODEL must name a provider via its first segment (opencode-go|openrouter), e.g. opencode-go/qwen/qwen3.7-flash.",
    }),
    WRITER_MODEL: z.string().min(1).refine(hasKnownProviderPrefix, {
      message:
        "WRITER_MODEL must name a provider via its first segment (opencode-go|openrouter), e.g. opencode-go/qwen/qwen3.7-flash.",
    }),
    MODERATOR_MODEL: z.string().min(1).refine(hasKnownProviderPrefix, {
      message:
        "MODERATOR_MODEL must name a provider via its first segment (opencode-go|openrouter), e.g. opencode-go/qwen/qwen3.7-flash.",
    }),
    ILLUSTRATOR_MODEL: z.string().min(1).refine(hasKnownProviderPrefix, {
      message:
        "ILLUSTRATOR_MODEL must name a provider via its first segment (opencode-go|openrouter).",
    }),
    READER_MODEL: z.string().min(1).refine(hasKnownProviderPrefix, {
      message: "READER_MODEL must name a provider via its first segment (opencode-go|openrouter).",
    }),
    /**
     * Optional per-locale TTS voice ids for the reader model (spec 004). When
     * unset the provider adapter uses a sensible default per model/locale. Only
     * consumed by Kokoro-style models that accept a `voice` field; other speech
     * models ignore it. Optional so demo/fake runs need no voice config.
     */
    READER_VOICE_PT_BR: z.string().min(1).optional(),
    READER_VOICE_EN: z.string().min(1).optional(),
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
     * Optional per-model-request timeout (ms), attempt-count, and pipeline
     * budget knobs (spec 006 / commit 5864dae). Read by the per-agent provider
     * construction (`generation-runtime.ts`) and the per-model-request retry
     * policy (`agents/retry.ts`); when absent each adapter/helper keeps its
     * documented default. These must be schema-owned so they parse under
     * `.strict()` instead of failing boot when set.
     */
    MODEL_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
    MODEL_MAX_ATTEMPTS: z.coerce.number().int().positive().optional(),
    PIPELINE_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
    /**
     * Gatekeeper (porteiro) do playground — senha única compartilhada.
     * Ambos opcionais: deploy demo-only roda sem eles e o porteiro fica
     * desabilitado (demo 100% anônima). `GATEKEEPER_SECRET` assina o JWT
     * httpOnly (HS256, mínimo 32 chars); `PLAYGROUND_PASSWORD_HASH` é o
     * hash scrypt da senha (`scrypt:<salt>:<key>`, gerado com `pnpm gate:hash`)
     * — nunca um hash rápido de senha, e sem `$` (a expansão de `.env`
     * truncaria o valor). Nenhum vai ao cliente; lidos só via
     * `getEnv()` / `process.env` no servidor.
     */
    GATEKEEPER_SECRET: z.string().min(32).optional(),
    PLAYGROUND_PASSWORD_HASH: z.string().regex(PASSWORD_HASH_PATTERN).optional(),
    /**
     * Cloudflare Turnstile demo anti-bot (feature 019). Both keys are
     * optional: absent keys disable the feature (demo behaves as today).
     * `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is a **publishable** (non-secret) key
     * exposed to the browser by design — an explicit exception to the "no
     * NEXT_PUBLIC_*" rule (ADR 0014), like Turnstile site key (ADR 0014).
     * `TURNSTILE_SECRET_KEY` is server-only.
     */
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1).optional(),
    TURNSTILE_SECRET_KEY: z.string().min(1).optional(),
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
  // per-agent schema (spec 006)
  "OPENROUTER_API_KEY",
  "OPENCODE_GO_API_KEY",
  "PLANNER_MODEL",
  "WRITER_MODEL",
  "MODERATOR_MODEL",
  "ILLUSTRATOR_MODEL",
  "READER_MODEL",
  "READER_VOICE_PT_BR",
  "READER_VOICE_EN",
  "STORIES_TEST_MODE",
  "AI_NARRATION_ENABLED",
  // pipeline & per-model-request timeout/retry (in ms / count)
  "MODEL_TIMEOUT_MS",
  "MODEL_MAX_ATTEMPTS",
  "PIPELINE_TIMEOUT_MS",
  // gatekeeper do playground (porteiro senha única) — opcional; demo-only sem chaves
  "GATEKEEPER_SECRET",
  "PLAYGROUND_PASSWORD_HASH",
  // Cloudflare Turnstile demo anti-bot (feature 019) — optional
  "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
  "TURNSTILE_SECRET_KEY",
  // removed legacy vars (rejected by `.strict()` under D5-C: no compat)
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
  return parsed.data;
}
