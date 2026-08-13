import "server-only";
import { getEnv } from "../../../lib/env";
import { InMemoryRateLimiter, generateSalt, type RateLimiter } from "../../../lib/rate-limit";
import { createOpenCodeIllustration } from "./create-opencode-illustration";
import { createFixedDevIllustration, createFixedDevProvider } from "./fixed-dev-provider";
import { createOpenCodeStoryProvider } from "./opencode-story-generation-provider";
import {
  createOpenRouterIllustration,
  createOpenRouterStoryProvider,
} from "./openrouter-story-generation-provider";
import { resolveCapability, type Route } from "./provider-routing";
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
 *   per-capability provider routing is derived from the prefix of each `*_MODEL`
 *   (spec 005) with credentials/models read from `src/lib/env.ts`.
 */
export interface GenerationRuntime {
  provider: StoryGenerationProvider;
  illustrate: (prompt: string) => Promise<{ dataUri: string }>;
  rateLimiter: RateLimiter;
  salt: string;
}

/**
 * Adapter seams used by {@link createRealRuntime}. Production binds the real
 * OpenCode/OpenRouter adapters; tests inject spies to observe which provider
 * each capability is routed to without any live AI. Each factory receives the
 * already-resolved {@link Route} for the capability it serves.
 */
export interface RealAdapterSeams {
  /**
   * Returns a `StoryGenerationProvider` for a text or moderation route. The
   * returned provider's `generateStory`/`moderateText`/`moderateImage` cover
   * the routed capability (D3 — any provider may serve any capability).
   */
  storyProviderFactory: (route: Route) => () => StoryGenerationProvider;
  /** Returns an illustration function for an image route. */
  illustrationFactory: (route: Route) => (prompt: string) => Promise<{ dataUri: string }>;
}

export const DEFAULT_SEAMS: RealAdapterSeams = {
  storyProviderFactory: (route) =>
    route.provider === "opencode-go" ? createOpenCodeStoryProvider : createOpenRouterStoryProvider,
  illustrationFactory: (route) =>
    route.provider === "opencode-go"
      ? createOpenCodeIllustration()
      : createOpenRouterIllustration(),
};

/** Production default provider (composite) routed per capability by prefix. */
function createRealProvider(seams: RealAdapterSeams): StoryGenerationProvider {
  let textProvider: StoryGenerationProvider | undefined;
  let moderationProvider: StoryGenerationProvider | undefined;

  const textRoute = () => resolveCapability({ capability: "text", model: getEnv().TEXT_MODEL });
  const moderationRoute = () =>
    resolveCapability({ capability: "moderation", model: getEnv().MODERATION_MODEL });

  return {
    async generateStory(input) {
      return (textProvider ??= seams.storyProviderFactory(textRoute())()).generateStory(input);
    },
    async moderateText(content) {
      return (moderationProvider ??= seams.storyProviderFactory(moderationRoute())()).moderateText(
        content
      );
    },
    async moderateImage(prompt) {
      // Illustration *prompts* are moderated by the moderation-routed provider.
      return (moderationProvider ??= seams.storyProviderFactory(moderationRoute())()).moderateImage(
        prompt
      );
    },
  };
}

/** Production default illustrator picked by the `IMAGE_MODEL` provider prefix. */
function createRealIllustration(seams: RealAdapterSeams) {
  let impl: ((prompt: string) => Promise<{ dataUri: string }>) | undefined;
  return (prompt: string) => {
    const route = resolveCapability({ capability: "image", model: getEnv().IMAGE_MODEL });
    impl ??= seams.illustrationFactory(route);
    return impl(prompt);
  };
}

/**
 * Builds the production dual runtime (routed per capability). Seams are
 * injectable for deterministic route-selection tests (T013); omitted by the
 * route, which calls {@link createGenerationRuntime}.
 */
export function createRealRuntime(seams: RealAdapterSeams = DEFAULT_SEAMS): GenerationRuntime {
  const useFake = process.env.STORIES_TEST_MODE === "fake";
  const rateLimitMax = Number(process.env.STORY_RATE_LIMIT_MAX_REQUESTS ?? 10);
  const rateLimitWindowMs = Number(process.env.STORY_RATE_LIMIT_WINDOW_MS ?? 60_000);
  return {
    provider: useFake ? createFixedDevProvider() : createRealProvider(seams),
    illustrate: useFake ? createFixedDevIllustration() : createRealIllustration(seams),
    rateLimiter: new InMemoryRateLimiter({
      windowMs: rateLimitWindowMs,
      limit: Number.isFinite(rateLimitMax) ? rateLimitMax : 10,
    }),
    salt: generateSalt(),
  };
}

export function createGenerationRuntime(): GenerationRuntime {
  return createRealRuntime();
}
