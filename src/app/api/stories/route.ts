import "server-only";
import { createGenerationRuntime } from "../../../features/story-generation/server/generation-runtime";
import { generateStory } from "../../../features/story-generation/server/generate-story";
import {
  generateRequestSchema,
  localeSchema,
} from "../../../features/story-generation/server/schemas";
import type { StoryGenerationProvider } from "../../../features/story-generation/server/story-generation-provider";
import {
  invalidInput,
  rateLimited,
  toErrorJson,
  unsupportedLocale,
  type HttpErrorCode,
} from "../../../lib/http-errors";
import { createPseudoAnonymousKey, type RateLimiter } from "../../../lib/rate-limit";

/**
 * `POST /api/stories` — the only server entry point for story generation.
 *
 * Privacy & safety contract (see AGENTS.md):
 * - accepts **only** `ageBand`, `locale`, `theme` (server re-validation);
 * - anonymous rate limiting via a short-lived pseudo-anonymous key;
 * - every response is `Cache-Control: no-store` (never persisted);
 * - request and story content are never logged here.
 */

const STATUS_BY_CODE: Record<HttpErrorCode, number> = {
  invalid_input: 400,
  unsupported_locale: 422,
  unsafe_unrecoverable: 422,
  rate_limited: 429,
  generation_unavailable: 502,
  generation_timeout: 504,
};

const NO_STORE = { "Cache-Control": "no-store" };

export interface StoriesRouteDeps {
  provider: StoryGenerationProvider;
  illustrate: (prompt: string) => Promise<{ dataUri: string }>;
  rateLimiter: RateLimiter;
  salt: string;
}

function json(status: number, body: unknown, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...NO_STORE, ...extraHeaders },
  });
}

export function createStoriesHandler(deps: StoriesRouteDeps) {
  return async function POST(request: Request): Promise<Response> {
    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const ip = forwarded || "unknown";
    const key = createPseudoAnonymousKey({ ip, salt: deps.salt });

    const rate = await deps.rateLimiter.consume(key);
    if (!rate.allowed) {
      return json(429, toErrorJson(rateLimited), {
        "Retry-After": String(rate.retryAfterSeconds ?? 1),
      });
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return json(400, toErrorJson(invalidInput));
    }

    const parsed = generateRequestSchema.safeParse(payload);
    if (!parsed.success) {
      const raw = payload as { locale?: unknown } | null;
      if (raw && typeof raw.locale === "string" && !localeSchema.safeParse(raw.locale).success) {
        return json(422, toErrorJson(unsupportedLocale));
      }
      return json(400, toErrorJson(invalidInput));
    }

    const { ageBand, locale, theme, sceneCount } = parsed.data;
    const result = await generateStory({
      input: {
        ageBand,
        locale,
        theme,
        sceneCount: sceneCount ?? 3,
      },
      provider: deps.provider,
      illustrate: deps.illustrate,
    });

    if (result.ok) {
      return json(200, result.story);
    }
    return json(STATUS_BY_CODE[result.error.code] ?? 502, result.error);
  };
}

const runtime = createGenerationRuntime();

export const POST = createStoriesHandler(runtime);
