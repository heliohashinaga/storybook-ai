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
 * Test mode is selected by `STORIES_TEST_MODE`:
 * - `fake` → the deterministic offline development provider/illustrator (used
 *   only by e2e/visual/dev runs; never calls a live AI service) and never
 *   requires provider credentials to be present;
 * - absent (production default) → the real server-only adapters, whose
 *   per-capability provider routing is derived from each `*_MODEL` (spec 005)
 *   with credentials/models read from `src/lib/env.ts`.
 */
export interface GenerationRuntime {
  provider: StoryGenerationProvider;
  illustrate: (prompt: string) => Promise<{ dataUri: string }>;
  rateLimiter: RateLimiter;
  salt: string;
}

export function createGenerationRuntime(): GenerationRuntime {
  const useFake = process.env.STORIES_TEST_MODE === "fake";
  // Anonymous rate limiting. Production default is 10 requests / 60s; CI and
  // e2e/visual/perf suites raise the cap via STORY_RATE_LIMIT_MAX_REQUESTS so a full browser
  // test run (many real POST /api/stories) against one shared server is not
  // throttled. Read directly from process.env like STORIES_TEST_MODE because
  // this seam must also operate in fake/test envs that omit OpenRouter creds.
  const rateLimitMax = Number(process.env.STORY_RATE_LIMIT_MAX_REQUESTS ?? 10);
  const rateLimitWindowMs = Number(process.env.STORY_RATE_LIMIT_WINDOW_MS ?? 60_000);
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
