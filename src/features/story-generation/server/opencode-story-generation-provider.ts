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
 * `IMAGE_MODEL` routes to `opencode-go`).
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

/** Local Zod mirrors of the provider candidate shapes (server-side only). */
const sceneCandidateSchema = z.object({
  ordinal: z.number().int().positive(),
  title: z.string().min(1),
  body: z.string().min(1),
  illustrationPrompt: z.string().min(1),
});
const storyCandidateSchema = z.object({
  title: z.string().min(1),
  scenes: z.array(sceneCandidateSchema).min(1),
});
const moderationSchema = z.object({
  safe: z.boolean(),
  reason: z.string().nullable().optional(),
});

function resolveDeps(deps: OpenCodeDeps) {
  // Production reads the key and model identifiers only from the validated
  // server env; tests may inject every value and skip `getEnv()` entirely.
  const requiresEnv = [deps.apiKey, deps.textModel, deps.moderationModel].some(
    (value) => value === undefined
  );
  const env = requiresEnv ? getEnv() : null;
  return {
    apiKey: deps.apiKey ?? env?.OPENCODE_GO_API_KEY ?? "",
    textModel: deps.textModel ?? (env ? modelWithoutProviderPrefix(env.TEXT_MODEL) : ""),
    moderationModel:
      deps.moderationModel ?? (env ? modelWithoutProviderPrefix(env.MODERATION_MODEL) : ""),
    baseUrl: deps.baseUrl ?? DEFAULT_BASE_URL,
    timeoutMs: deps.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    maxRetries: deps.maxRetries ?? 2,
    fetchImpl: deps.fetchImpl ?? fetch,
  };
}

/** Maps a transport/SDK failure to a typed {@link ProviderError}. */
function toProviderError(error: unknown): never {
  if (error instanceof ProviderError) throw error;
  if (error instanceof OpenAI.APIConnectionTimeoutError) {
    throw new ProviderError("timeout", "Provider request timed out.");
  }
  throw new ProviderError("unavailable", "Provider request failed.");
}

/** Extracts and parses `choices[0].message.content` as JSON from a chat response. */
function parseChatJson(content: unknown): unknown {
  if (typeof content !== "string" || content.trim() === "") {
    throw new ProviderError("invalid_structured_output", "Provider returned no content.");
  }
  try {
    return JSON.parse(content);
  } catch {
    throw new ProviderError("invalid_structured_output", "Provider returned malformed JSON.");
  }
}

const NARRATIVE_SYSTEM_PROMPT = [
  "You are an author of safe, age-appropriate children's books.",
  "You write only short fictional stories. You never use real names or any",
  "personal or identifying information.",
  "Respond with a single JSON object only — no prose, no markdown.",
].join(" ");

function narrativeUserPrompt(input: ProviderStoryInput): string {
  const language = input.locale === "en" ? "English" : "Brazilian Portuguese";
  return JSON.stringify({
    task: "Write a short children's story.",
    locale: input.locale,
    ai: `Write the story in ${language}.`,
    ageBand: input.ageBand,
    theme: input.theme,
    scenes: {
      count: input.sceneCount,
      requirement:
        `Exactly ${input.sceneCount} scenes. Each scene has a positive, child-safe arc. ` +
        "The last scene must end with a definite closing or resolution sentence, " +
        "never cutting off mid-story.",
    },
    style:
      "Warm, playful, gentle. Every illustration prompt must describe the same " +
      "characters in a soft watercolor style so the set stays visually consistent.",
    rules: [
      "Never include names or any personal identifying details.",
      "Keep it age-appropriate and non-scary for the given age band.",
      "Make each scene body a few short sentences.",
      "Each illustrationPrompt must be a detailed visual prompt (soft watercolor).",
    ],
    output_schema: {
      title: "string — story title",
      scenes: [
        {
          ordinal: "int, 1-based",
          title: "string — scene title",
          body: "string — scene body",
          illustrationPrompt: "string — watercolor illustration prompt",
        },
      ],
    },
  });
}

const MODERATION_SYSTEM_PROMPT = [
  "You are a strict safety classifier for children's content.",
  "Given content, reply with a single JSON object only:",
  '{"safe": true|false, "reason": string|null}.',
  "Mark unsafe if it contains violence, fear, horror, inappropriate or sexual",
  "content, drugs, self-harm, hateful themes, or any direct personal identifier",
  "(for example a child's name).",
  '"reason" is a short category string, or null when safe.',
].join(" ");

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

async function moderate(
  client: OpenAI,
  model: string,
  content: string
): Promise<ModerationDecision> {
  try {
    const completion = await client.chat.completions.create({
      model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: MODERATION_SYSTEM_PROMPT },
        { role: "user", content },
      ],
    });
    const parsed = parseChatJson(completion.choices[0]?.message?.content);
    const decision = moderationSchema.parse(parsed);
    return decision.safe
      ? { safe: true }
      : { safe: false, ...(decision.reason ? { reason: decision.reason } : {}) };
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof ProviderError) {
      throw new ProviderError("unavailable", "Moderation result is invalid.");
    }
    toProviderError(error);
  }
}
