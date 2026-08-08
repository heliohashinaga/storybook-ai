import "server-only";
import { InMemoryRateLimiter, generateSalt, type RateLimiter } from "../../../lib/rate-limit";
import {
  createOpenRouterIllustration,
  createOpenRouterStoryProvider,
} from "./openrouter-story-generation-provider";
import type { StoryGenerationProvider } from "./story-generation-provider";

/**
 * Runtime dependencies for the `POST /api/stories` route. The route is a pure
 * handler over these seams, so tests inject fakes while production selects the
 * real pieces here. The provider and illustration generator are the server-only
 * OpenRouter adapter (models from `src/lib/env.ts`).
 */
export interface GenerationRuntime {
  provider: StoryGenerationProvider;
  illustrate: (prompt: string) => Promise<{ dataUri: string }>;
  rateLimiter: RateLimiter;
  salt: string;
}

export function createGenerationRuntime(): GenerationRuntime {
  return {
    provider: createOpenRouterStoryProvider(),
    illustrate: createOpenRouterIllustration(),
    rateLimiter: new InMemoryRateLimiter({ windowMs: 60_000, limit: 10 }),
    salt: generateSalt(),
  };
}
