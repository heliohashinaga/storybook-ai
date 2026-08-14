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
 * Per-agent providers (spec 006): planner, writer, and moderator each receive
 * a dedicated `StoryGenerationProvider` built from its own `*_MODEL` so each
 * agent can use a distinct provider and model. The `provider` field is kept
 * for backward compatibility with tests that pass a single fake provider.
 *
 * Test mode is selected by `STORIES_TEST_MODE`:
 * - `fake` → the deterministic offline development provider/illustrator (used
 *   only by e2e/visual/dev runs; never calls a live AI service) and never
 *   requires provider credentials to be present;
 * - absent (production default) → the real server-only adapters.
 */
export interface GenerationRuntime {
  /** Backward-compat: single provider used by all three text agents when per-agent providers are absent. */
  provider: StoryGenerationProvider;
  /** Per-agent provider for the Planner (PLANNER_MODEL). */
  plannerProvider: StoryGenerationProvider;
  /** Per-agent provider for the Writer (WRITER_MODEL). */
  writerProvider: StoryGenerationProvider;
  /** Per-agent provider for the Moderator (MODERATOR_MODEL). */
  moderatorProvider: StoryGenerationProvider;
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

/** Build a provider for one agent from its `*_MODEL` env var. */
function createAgentProvider(
  seams: RealAdapterSeams,
  capability: "text" | "moderation",
  modelVar: keyof ReturnType<typeof getEnv>
): StoryGenerationProvider {
  const env = getEnv();
  const model = env[modelVar] as string;
  if (!model) {
    throw new Error(`Missing env var: ${modelVar}`);
  }
  const route = resolveCapability({ capability, model });
  return seams.storyProviderFactory(route)();
}

/** Production default provider (composite) routed per agent model. */
function createRealProvider(seams: RealAdapterSeams): StoryGenerationProvider {
  let textProvider: StoryGenerationProvider | undefined;
  let moderationProvider: StoryGenerationProvider | undefined;

  const textRoute = () => resolveCapability({ capability: "text", model: getEnv().PLANNER_MODEL });
  const moderationRoute = () =>
    resolveCapability({ capability: "moderation", model: getEnv().MODERATOR_MODEL });

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
      return (moderationProvider ??= seams.storyProviderFactory(moderationRoute())()).moderateImage(
        prompt
      );
    },
  };
}

/** Production default illustrator picked by the `ILLUSTRATOR_MODEL` provider prefix. */
function createRealIllustration(seams: RealAdapterSeams) {
  let impl: ((prompt: string) => Promise<{ dataUri: string }>) | undefined;
  return (prompt: string) => {
    const route = resolveCapability({
      capability: "image",
      model: getEnv().ILLUSTRATOR_MODEL,
    });
    impl ??= seams.illustrationFactory(route);
    return impl(prompt);
  };
}

/**
 * Builds the production per-agent runtime. The `provider` field is a composite
 * for backward compat; each agent's `*Provider` field is a dedicated provider
 * built from its own `*_MODEL`. Fake mode reuses the fixed dev provider for all
 * text agents.
 *
 * All real providers are constructed **lazily** on first access (never at
 * construction time), so `createGenerationRuntime()` requires no credentials or
 * model env vars to be present until an agent actually generates (mirrors the
 * pre-split composite behavior and keeps the module-load path free of env
 * requirements).
 */
export function createRealRuntime(seams: RealAdapterSeams = DEFAULT_SEAMS): GenerationRuntime {
  const useFake = process.env.STORIES_TEST_MODE === "fake";
  const rateLimitMax = Number(process.env.STORY_RATE_LIMIT_MAX_REQUESTS ?? 10);
  const rateLimitWindowMs = Number(process.env.STORY_RATE_LIMIT_WINDOW_MS ?? 60_000);

  const fakeProvider = createFixedDevProvider();
  const fakeIllustration = createFixedDevIllustration();

  // Lazy provider getters: built once on first access, so construction is
  // side-effect free (no getEnv() until an agent actually runs).
  let plannerProvider: StoryGenerationProvider | undefined;
  let writerProvider: StoryGenerationProvider | undefined;
  let moderatorProvider: StoryGenerationProvider | undefined;

  return {
    provider: useFake ? fakeProvider : createRealProvider(seams),
    get plannerProvider(): StoryGenerationProvider {
      if (!useFake) plannerProvider ??= createAgentProvider(seams, "text", "PLANNER_MODEL");
      return useFake ? fakeProvider : plannerProvider!;
    },
    get writerProvider(): StoryGenerationProvider {
      if (!useFake) writerProvider ??= createAgentProvider(seams, "text", "WRITER_MODEL");
      return useFake ? fakeProvider : writerProvider!;
    },
    get moderatorProvider(): StoryGenerationProvider {
      if (!useFake)
        moderatorProvider ??= createAgentProvider(seams, "moderation", "MODERATOR_MODEL");
      return useFake ? fakeProvider : moderatorProvider!;
    },
    illustrate: useFake ? fakeIllustration : createRealIllustration(seams),
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
