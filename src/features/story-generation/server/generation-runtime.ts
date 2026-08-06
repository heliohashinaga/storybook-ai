import "server-only";
import {
  InMemoryRateLimiter,
  generateSalt,
  type RateLimiter,
} from "../../../lib/rate-limit";
import {
  createDevelopmentIllustration,
  createDevelopmentStoryProvider,
} from "./dev-story-generation-provider";
import type { StoryGenerationProvider } from "./story-generation-provider";

/**
 * Runtime dependencies for the `POST /api/stories` route. The route is a pure
 * handler over these seams, so tests inject fakes while production selects the
 * real pieces here.
 *
 * NOTE: until T024 lands, `provider`/`illustrate` use the deterministic
 * development provider. T024 swaps them for the server-only OpenAI adapter
 * (models from `src/lib/env.ts`) with no change to the route itself.
 */
export interface GenerationRuntime {
  provider: StoryGenerationProvider;
  illustrate: (prompt: string) => Promise<{ dataUri: string }>;
  rateLimiter: RateLimiter;
  salt: string;
}

export function createGenerationRuntime(): GenerationRuntime {
  return {
    provider: createDevelopmentStoryProvider(),
    illustrate: createDevelopmentIllustration(),
    rateLimiter: new InMemoryRateLimiter({ windowMs: 60_000, limit: 10 }),
    salt: generateSalt(),
  };
}
