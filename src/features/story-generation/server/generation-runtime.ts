import "server-only";
import { InMemoryRateLimiter, generateSalt, type RateLimiter } from "../../../lib/rate-limit";
import { createFixedDevIllustration, createFixedDevProvider } from "./fixed-dev-provider";
import {
  createOpenRouterIllustration,
  createOpenRouterStoryProvider,
} from "./openrouter-story-generation-provider";
import type { StoryGenerationProvider } from "./story-generation-provider";

/**
 * Runtime dependencies for the `POST /api/stories` route. The route is a pure
 * handler over these seams, so tests inject fakes while production selects the
 * real pieces here.
 *
 * Provider selection is controlled by `STORIES_PROVIDER` (default `openrouter`):
 * - `fake` → the deterministic development provider/illustrator (used only by
 *   e2e/visual/dev runs; never calls a live AI service);
 * - `openrouter` (production default) → the server-only OpenRouter adapter with
 *   models read from `src/lib/env.ts`.
 * The fake path is read directly from `process.env` and never requires the
 * OpenRouter credentials to be present, so e2e runs stay fully deterministic
 * and offline.
 */
export interface GenerationRuntime {
  provider: StoryGenerationProvider;
  illustrate: (prompt: string) => Promise<{ dataUri: string }>;
  rateLimiter: RateLimiter;
  salt: string;
}

export function createGenerationRuntime(): GenerationRuntime {
  const useFake = process.env.STORIES_PROVIDER === "fake";
  // Anonymous rate limiting. Production default is 10 requests / 60s; CI and
  // e2e/visual/perf suites raise the cap via RATE_LIMIT_MAX so a full browser
  // test run (many real POST /api/stories) against one shared server is not
  // throttled. Read directly from process.env like STORIES_PROVIDER because
  // this seam must also operate in fake/test envs that omit OpenRouter creds.
  const rateLimitMax = Number(process.env.RATE_LIMIT_MAX ?? 10);
  const rateLimitWindowMs = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000);
  return {
    provider: useFake ? createFixedDevProvider() : createOpenRouterStoryProvider(),
    illustrate: useFake ? createFixedDevIllustration() : createOpenRouterIllustration(),
    rateLimiter: new InMemoryRateLimiter({
      windowMs: rateLimitWindowMs,
      limit: Number.isFinite(rateLimitMax) ? rateLimitMax : 10,
    }),
    salt: generateSalt(),
  };
}
