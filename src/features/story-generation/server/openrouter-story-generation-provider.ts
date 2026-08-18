import "server-only";
import OpenAI from "openai";
import { envOrDefault, modelEnvOrDefault, readEnvIfNeeded } from "./provider-core/env-deps";
import type { StoryGenerationProvider } from "./story-generation-provider";
import {
  createChatCompletionsProvider,
  postImages,
  toWebPDataUri,
  OPENROUTER_APP_HEADERS,
  type UrlResolver,
} from "./provider-core";

/**
 * Server-only OpenRouter adapter (T024) for narrative generation, text/image
 * moderation, and illustration generation.
 *
 * All model identifiers and the API key are read **only** from the validated
 * server environment (`src/lib/env.ts`). Raw provider output and prompts are
 * never logged, surfaced, or returned to the client; only the typed, validated
 * candidate crosses the boundary.
 *
 * Transport is a single injectable `fetchImpl` (defaults to global `fetch`):
 * chat completions go through the OpenAI-compatible SDK pointed at OpenRouter;
 * image generation goes to OpenRouter's documented `/images` endpoint (the
 * SDK's `images.generate` path does not match OpenRouter's). Injecting `fetch`
 * keeps every test deterministic with no live AI.
 */

const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_TIMEOUT_MS = 60_000; // text/moderation timeout

/** Overridable seams for deterministic tests (production defaults to env). */
export interface OpenRouterDeps {
  apiKey?: string;
  textModel?: string;
  imageModel?: string;
  moderationModel?: string;
  baseUrl?: string;
  timeoutMs?: number;
  /** Number of automatic retries on transient failures (default 2). */
  maxRetries?: number;
  /** Replaceable transport; defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /** Non-WebP → WebP transcoder; defaults to a lazy `sharp` import. */
  imageEncoder?: (bytes: Buffer) => Promise<Buffer>;
  /** Overridable DNS resolver for the SSRF guard (CWE-918); tests inject a fixed set. */
  urlSafetyResolver?: UrlResolver;
}

function resolveDeps(deps: OpenRouterDeps) {
  // Production reads the key and model identifiers only from the validated
  // server env; tests may inject every value and skip `getEnv()` entirely.
  const fields = [deps.apiKey, deps.textModel, deps.imageModel, deps.moderationModel] as const;
  const env = readEnvIfNeeded(fields);
  return {
    apiKey: envOrDefault(deps.apiKey, env?.OPENROUTER_API_KEY, ""),
    textModel: modelEnvOrDefault(deps.textModel, env, "PLANNER_MODEL"),
    imageModel: modelEnvOrDefault(deps.imageModel, env, "ILLUSTRATOR_MODEL"),
    moderationModel: modelEnvOrDefault(deps.moderationModel, env, "MODERATOR_MODEL"),
    baseUrl: envOrDefault(deps.baseUrl, undefined, DEFAULT_BASE_URL),
    timeoutMs: envOrDefault(deps.timeoutMs, undefined, DEFAULT_TIMEOUT_MS),
    maxRetries: envOrDefault(deps.maxRetries, undefined, 2),
    fetchImpl: envOrDefault(deps.fetchImpl, undefined, fetch),
    imageEncoder: envOrDefault(deps.imageEncoder, undefined, defaultImageEncoder),
    urlSafetyResolver: deps.urlSafetyResolver,
  };
}

/** Builds an OpenRouter-compatible OpenAI chat client bound to a transport. */
function buildChatClient(deps: OpenRouterDeps) {
  const { apiKey, baseUrl, timeoutMs, maxRetries, fetchImpl } = resolveDeps(deps);
  return new OpenAI({
    apiKey,
    baseURL: baseUrl,
    defaultHeaders: OPENROUTER_APP_HEADERS,
    timeout: timeoutMs,
    maxRetries,
    fetch: fetchImpl,
  });
}

/**
 * Creates the OpenRouter-backed {@link StoryGenerationProvider}.
 *
 * This is a **thin adapter**: it owns only client construction (`getClient`
 * with `baseUrl` + `defaultHeaders`/app-identity) and model resolution, and
 * composes the shared orchestration factory
 * (`createChatCompletionsProvider` in `provider-core`) for
 * `generateStory`/`moderateText`/`moderateImage`. There is no orchestration
 * body here (spec 013, SC-001/SC-004). The SDK client is built lazily on first
 * use so importing this module (e.g. the App Router route, or the build) never
 * requires provider env to be present; env is validated on the first real
 * request instead (spec 013, SC-002). `buildChatClient` reads model
 * identifiers only from `src/lib/env.ts`.
 */
export function createOpenRouterStoryProvider(deps: OpenRouterDeps = {}): StoryGenerationProvider {
  let client: OpenAI | undefined;
  const getClient = () => (client ??= buildChatClient(deps));
  // Model identifiers are resolved once here and passed to the factory; client
  // construction and env validation are deferred to the first request via
  // `getClient`. Production always resolves routes (and therefore env) before
  // constructing a provider, so this is behavior-identical to per-call
  // resolution (spec 013, SC-003).
  const { textModel, moderationModel } = resolveDeps(deps);
  return createChatCompletionsProvider({ getClient, textModel, moderationModel });
}

/** Lazy `sharp` transcode — loaded only when the upstream bytes are not WebP. */
async function defaultImageEncoder(bytes: Buffer): Promise<Buffer> {
  const { default: sharp } = await import("sharp");
  return sharp(bytes).webp().toBuffer();
}

/**
 * Creates an illustration generator: `(prompt) => Promise<{ dataUri }>` that
 * returns a validated WebP data URI (the format `generate-story` accepts).
 * Generates via OpenRouter's `/images` endpoint through the shared
 * `provider-core` image client.
 */
const IMAGE_TIMEOUT_MS = 120_000; // image generation is slow; avoids an image generation timeout

export function createOpenRouterIllustration(
  deps: OpenRouterDeps = { timeoutMs: IMAGE_TIMEOUT_MS }
): (prompt: string) => Promise<{ dataUri: string }> {
  return async (prompt: string): Promise<{ dataUri: string }> => {
    const { apiKey, imageModel, baseUrl, timeoutMs, fetchImpl, imageEncoder, urlSafetyResolver } =
      resolveDeps(deps);

    const raw = await postImages({
      baseUrl,
      apiKey,
      imageModel,
      prompt,
      timeoutMs,
      fetchImpl,
      urlSafetyResolver,
    });

    const encode: ((bytes: Uint8Array) => Promise<Uint8Array>) | undefined = imageEncoder
      ? async (bytes) => imageEncoder(Buffer.from(bytes))
      : undefined;
    const dataUri = await toWebPDataUri(raw, encode);
    return { dataUri };
  };
}
