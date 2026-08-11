import "server-only";
import OpenAI from "openai";
import { z } from "zod";
import { getEnv } from "../../../lib/env";
import type {
  GeneratedStoryCandidate,
  ModerationDecision,
  ProviderStoryInput,
  StoryGenerationProvider,
} from "./story-generation-provider";
import { ProviderError } from "./story-generation-provider";

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
const DEFAULT_TIMEOUT_MS = 30_000;

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

function resolveDeps(deps: OpenRouterDeps) {
  // Production reads the key and model identifiers only from the validated
  // server env; tests may inject all four values and skip `getEnv()` entirely.
  const requiresEnv = [deps.apiKey, deps.textModel, deps.imageModel, deps.moderationModel].some(
    (value) => value === undefined
  );
  const env = requiresEnv ? getEnv() : null;
  return {
    apiKey: deps.apiKey ?? env?.OPENROUTER_API_KEY ?? "",
    textModel: deps.textModel ?? env?.OPENROUTER_TEXT_MODEL ?? "",
    imageModel: deps.imageModel ?? env?.OPENROUTER_IMAGE_MODEL ?? "",
    moderationModel: deps.moderationModel ?? env?.OPENROUTER_MODERATION_MODEL ?? "",
    baseUrl: deps.baseUrl ?? DEFAULT_BASE_URL,
    timeoutMs: deps.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    maxRetries: deps.maxRetries ?? 2,
    fetchImpl: deps.fetchImpl ?? fetch,
    imageEncoder: deps.imageEncoder ?? defaultImageEncoder,
  };
}

/** Maps a transport/SDK failure to a typed {@link ProviderError}. */
function toProviderError(error: unknown): never {
  if (error instanceof ProviderError) throw error;
  // The SDK overrides `name` to a generic value, so classify by class, not by
  // name. Only a connection timeout maps to 504; everything else is a safe
  // 502-style "unavailable".
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

/** Builds an OpenRouter-compatible OpenAI chat client bound to a transport. */
function buildChatClient(deps: OpenRouterDeps) {
  const { apiKey, baseUrl, timeoutMs, maxRetries, fetchImpl } = resolveDeps(deps);
  return new OpenAI({
    apiKey,
    baseURL: baseUrl,
    timeout: timeoutMs,
    maxRetries,
    fetch: fetchImpl,
  });
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
      count: 3,
      requirement: "Exactly three scenes. Each scene has a positive, child-safe arc.",
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

/** True when a raw image buffer already carries the WebP container signature. */
function isWebP(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && // R
    bytes[1] === 0x49 && // I
    bytes[2] === 0x46 && // F
    bytes[3] === 0x46 && // F
    bytes[8] === 0x57 && // W
    bytes[9] === 0x45 && // E
    bytes[10] === 0x42 && // B
    bytes[11] === 0x50 //  P
  );
}

/** Lazy `sharp` transcode — loaded only when the upstream bytes are not WebP. */
async function defaultImageEncoder(bytes: Buffer): Promise<Buffer> {
  const { default: sharp } = await import("sharp");
  return sharp(bytes).webp().toBuffer();
}

/**
 * Normalizes a raw image buffer to WebP bytes, transcoding only when the
 * upstream payload is not already WebP (deferring the `sharp` load to the
 * rare transcode path so plain tests never require it).
 */
async function toWebPBuffer(
  bytes: Uint8Array,
  mediaType: string | undefined,
  encode: (raw: Buffer) => Promise<Buffer>
): Promise<Buffer> {
  const buffer = Buffer.from(bytes);
  if (mediaType?.includes("webp") || isWebP(buffer)) return buffer;
  return encode(buffer);
}

/**
 * Creates an illustration generator: `(prompt) => Promise<{ dataUri }>` that
 * returns a validated WebP data URI (the format `generate-story` accepts).
 * Generates via OpenRouter's `/images` endpoint.
 */
const IMAGE_TIMEOUT_MS = 90_000; // geração de imagem é lenta; evita Image generation timed out

export function createOpenRouterIllustration(
  deps: OpenRouterDeps = { timeoutMs: IMAGE_TIMEOUT_MS }
): (prompt: string) => Promise<{ dataUri: string }> {
  return async (prompt: string): Promise<{ dataUri: string }> => {
    const { apiKey, imageModel, baseUrl, timeoutMs, fetchImpl, imageEncoder } = resolveDeps(deps);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(`${baseUrl}/images`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: imageModel,
          prompt,
          n: 1,
          output_format: "webp",
          aspect_ratio: "1:1",
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new ProviderError("unavailable", "Image provider was unavailable.");
      }

      const json = (await response.json()) as {
        data?: { b64_json?: string; url?: string; media_type?: string }[];
      };
      const first = json.data?.[0];

      let bytes: Uint8Array;
      let mediaType: string | undefined;
      if (typeof first?.b64_json === "string") {
        bytes = Buffer.from(first.b64_json, "base64");
        mediaType = first.media_type;
      } else if (typeof first?.url === "string") {
        const imageResponse = await fetchImpl(first.url, { signal: controller.signal });
        if (!imageResponse.ok) {
          throw new ProviderError("unavailable", "Image URL could not be fetched.");
        }
        bytes = new Uint8Array(await imageResponse.arrayBuffer());
        mediaType = imageResponse.headers.get("content-type") ?? undefined;
      } else {
        throw new ProviderError("unavailable", "Image provider returned no data.");
      }

      const webp = await toWebPBuffer(bytes, mediaType, imageEncoder);
      return { dataUri: `data:image/webp;base64,${webp.toString("base64")}` };
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      if (controller.signal.aborted) {
        throw new ProviderError("timeout", "Image generation timed out.");
      }
      toProviderError(error);
    } finally {
      clearTimeout(timer);
    }
  };
}
