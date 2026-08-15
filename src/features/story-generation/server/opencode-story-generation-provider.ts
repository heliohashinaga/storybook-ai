import "server-only";
import OpenAI from "openai";
import { z } from "zod";
import { getEnv, modelWithoutProviderPrefix } from "../../../lib/env";
import type {
  GeneratedStoryCandidate,
  ModerationDecision,
  ProviderStoryInput,
  StoryGenerationProvider,
} from "./story-generation-provider";
import { ProviderError } from "./story-generation-provider";
import {
  NARRATIVE_SYSTEM_PROMPT,
  narrativeUserPrompt,
  parseChatJson,
  storyCandidateSchema,
  toProviderError,
} from "./provider-core";
import { moderate } from "./provider-core/moderation";

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

  return {
    async generateStory(input: ProviderStoryInput): Promise<GeneratedStoryCandidate> {
      try {
        const completion = await getClient().chat.completions.create({
          model: resolveDeps(deps).textModel,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: NARRATIVE_SYSTEM_PROMPT },
            { role: "user", content: narrativeUserPrompt(input) },
          ],
        });
        const parsed = parseChatJson(completion.choices[0]?.message?.content);
        return storyCandidateSchema.parse(parsed);
      } catch (error) {
        if (error instanceof z.ZodError || error instanceof ProviderError) {
          throw new ProviderError("invalid_structured_output", "Story candidate is invalid.");
        }
        toProviderError(error);
      }
    },

    async moderateText(text: string): Promise<ModerationDecision> {
      return moderate(getClient(), resolveDeps(deps).moderationModel, text);
    },

    async moderateImage(prompt: string): Promise<ModerationDecision> {
      return moderate(getClient(), resolveDeps(deps).moderationModel, prompt);
    },
  };
}
