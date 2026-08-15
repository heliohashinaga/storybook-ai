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
  postImages,
  storyCandidateSchema,
  toProviderError,
  toWebPDataUri,
  OPENROUTER_APP_HEADERS,
} from "./provider-core";
import { moderate } from "./provider-core/moderation";

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
}

function resolveDeps(deps: OpenRouterDeps) {
  // Production reads the key and model identifiers only from the validated
  // server env; tests may inject every value and skip `getEnv()` entirely.
  const requiresEnv = [deps.apiKey, deps.textModel, deps.imageModel, deps.moderationModel].some(
    (value) => value === undefined
  );
  const env = requiresEnv ? getEnv() : null;
  return {
    apiKey: deps.apiKey ?? env?.OPENROUTER_API_KEY ?? "",
    textModel: deps.textModel ?? (env ? modelWithoutProviderPrefix(env.PLANNER_MODEL) : ""),
    imageModel: deps.imageModel ?? (env ? modelWithoutProviderPrefix(env.ILLUSTRATOR_MODEL) : ""),
    moderationModel:
      deps.moderationModel ?? (env ? modelWithoutProviderPrefix(env.MODERATOR_MODEL) : ""),
    baseUrl: deps.baseUrl ?? DEFAULT_BASE_URL,
    timeoutMs: deps.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    maxRetries: deps.maxRetries ?? 2,
    fetchImpl: deps.fetchImpl ?? fetch,
    imageEncoder: deps.imageEncoder ?? defaultImageEncoder,
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
 */
export function createOpenRouterStoryProvider(deps: OpenRouterDeps = {}): StoryGenerationProvider {
  // Build the SDK client lazily on first use so importing this module (e.g. the
  // App Router route, or the build) never requires provider env to be present;
  // env is validated on the first real request instead. `buildChatClient` reads
  // model identifiers only from `src/lib/env.ts`.
  let client: OpenAI | undefined;
  const getClient = () => (client ??= buildChatClient(deps));

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
const IMAGE_TIMEOUT_MS = 120_000; // geração de imagem é lenta; evita Image generation timed out

export function createOpenRouterIllustration(
  deps: OpenRouterDeps = { timeoutMs: IMAGE_TIMEOUT_MS }
): (prompt: string) => Promise<{ dataUri: string }> {
  return async (prompt: string): Promise<{ dataUri: string }> => {
    const { apiKey, imageModel, baseUrl, timeoutMs, fetchImpl, imageEncoder } = resolveDeps(deps);

    const raw = await postImages({
      baseUrl,
      apiKey,
      imageModel,
      prompt,
      timeoutMs,
      fetchImpl,
    });

    const encode: ((bytes: Uint8Array) => Promise<Uint8Array>) | undefined = imageEncoder
      ? async (bytes) => imageEncoder(Buffer.from(bytes))
      : undefined;
    const dataUri = await toWebPDataUri(raw, encode);
    return { dataUri };
  };
}
