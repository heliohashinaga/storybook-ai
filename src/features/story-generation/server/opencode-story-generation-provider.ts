import "server-only";
import OpenAI from "openai";
import { getEnv, modelWithoutProviderPrefix } from "../../../lib/env";
import type { StoryGenerationProvider } from "./story-generation-provider";
import { createChatCompletionsProvider } from "./provider-core";

/**
 * Server-only OpenCode adapter (spec 005, T010) for narrative generation and
 * text/image moderation via the OpenAI-compatible OpenCode endpoint.
 *
 * All model identifiers and the API key are read **only** from the validated
 * server environment (`src/lib/env.ts`). Raw provider output and prompts are
 * never logged, surfaced, or returned to the client; only the typed, validated
 * candidate crosses the boundary.
 *
 * The provider is **capacity-agnostic** (spec 005 D3): it serves whatever
 * capability the router derives from the `*_MODEL` prefix — here `text`,
 * `moderation`, and `moderateImage` all go through chat completions. It does
 * NOT generate illustrations (that is `create-opencode-illustration.ts` when
 * `ILLUSTRATOR_MODEL` routes to `opencode-go`).
 *
 * Transport is a single injectable `fetchImpl` via the OpenAI-compatible SDK;
 * injecting `fetch` keeps every test deterministic with no live AI.
 */

const DEFAULT_BASE_URL = "https://opencode.ai/zen/go/v1";
const DEFAULT_TIMEOUT_MS = 60_000;

/** Overridable seams for deterministic tests (production defaults to env). */
export interface OpenCodeDeps {
  apiKey?: string;
  textModel?: string;
  moderationModel?: string;
  baseUrl?: string;
  timeoutMs?: number;
  /** Number of automatic retries on transient failures (default 2). */
  maxRetries?: number;
  /** Replaceable transport; defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

function resolveDeps(deps: OpenCodeDeps) {
  // Production reads the key and model identifiers only from the validated
  // server env; tests may inject every value and skip `getEnv()` entirely.
  const requiresEnv = [deps.apiKey, deps.textModel, deps.moderationModel].some(
    (value) => value === undefined
  );
  const env = requiresEnv ? getEnv() : null;
  return {
    apiKey: deps.apiKey ?? env?.OPENCODE_GO_API_KEY ?? "",
    textModel: deps.textModel ?? (env ? modelWithoutProviderPrefix(env.PLANNER_MODEL) : ""),
    moderationModel:
      deps.moderationModel ?? (env ? modelWithoutProviderPrefix(env.MODERATOR_MODEL) : ""),
    baseUrl: deps.baseUrl ?? DEFAULT_BASE_URL,
    timeoutMs: deps.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    maxRetries: deps.maxRetries ?? 2,
    fetchImpl: deps.fetchImpl ?? fetch,
  };
}

/**
 * Creates the OpenCode-backed {@link StoryGenerationProvider}. The SDK client
 * is built lazily on first use so importing this module never requires
 * provider env to be present; env is validated on the first real request.
 * Like the OpenRouter adapter, this is a **thin adapter**: it owns only
 * `getClient()` (no `defaultHeaders`, as today) and model resolution, and
 * composes the shared orchestration factory (`createChatCompletionsProvider`
 * in `provider-core`) for `generateStory`/`moderateText`/`moderateImage`
 * (spec 013, SC-001/SC-004).
 */
export function createOpenCodeStoryProvider(deps: OpenCodeDeps = {}): StoryGenerationProvider {
  let client: OpenAI | undefined;
  const getClient = () =>
    (client ??= new OpenAI({
      apiKey: resolveDeps(deps).apiKey,
      baseURL: resolveDeps(deps).baseUrl,
      timeout: resolveDeps(deps).timeoutMs,
      maxRetries: resolveDeps(deps).maxRetries,
      fetch: resolveDeps(deps).fetchImpl,
    }));
  // Model identifiers are resolved once here and passed to the factory; client
  // construction and env validation are deferred to the first request via
  // `getClient`. Production always resolves routes (and therefore env) before
  // constructing a provider, so this is behavior-identical to per-call
  // resolution (spec 013, SC-003).
  const { textModel, moderationModel } = resolveDeps(deps);
  return createChatCompletionsProvider({ getClient, textModel, moderationModel });
}
