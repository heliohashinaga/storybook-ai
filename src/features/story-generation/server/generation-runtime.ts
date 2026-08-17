import "server-only";
import { getEnv } from "../../../lib/env";
import {
  InMemoryRateLimiter,
  generateSalt,
  trustForwardedForEnv,
  type RateLimiter,
} from "../../../lib/rate-limit";
import { createOpenCodeIllustration } from "./create-opencode-illustration";
import {
  createFakePhasedDelay,
  createFixedDevIllustration,
  createFixedDevProvider,
} from "./fixed-dev-provider";
import { createOpenCodeStoryProvider } from "./opencode-story-generation-provider";
import { defaultMaxAttempts } from "./agents/retry";
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
  trustForwardedFor: boolean;
}

/**
 * Per-model-request provider knobs derived from `MODEL_TIMEOUT_MS` and
 * `MODEL_MAX_ATTEMPTS` (spec 006 / commit 5864dae). Each adapter already honors
 * `timeoutMs` and `maxRetries`; these options close the env → provider wiring in
 * {@link createRealRuntime}, letting an operator tune them via env.
 */
export interface StoryProviderOptions {
  /** Per-model-request timeout (ms), from `MODEL_TIMEOUT_MS`. */
  timeoutMs?: number;
  /** Automatic retries after the first attempt, from `MODEL_MAX_ATTEMPTS - 1`. */
  maxRetries?: number;
}

/** Illustration provider knobs — only the timeout (image retries live at the set level). */
export interface IllustrationProviderOptions {
  /** Per-model-request timeout (ms), from `MODEL_TIMEOUT_MS`. */
  timeoutMs?: number;
}

/**
 * Adapter seams used by {@link createRealRuntime}. Production binds the real
 * OpenCode/OpenRouter adapters; tests inject spies to observe which provider
 * each capability is routed to without any live AI. Each factory receives the
 * already-resolved {@link Route} for the capability it serves plus the optional
 * per-agent provider options derived from env.
 */
export interface RealAdapterSeams {
  /**
   * Returns a `StoryGenerationProvider` for a text or moderation route. The
   * returned provider's `generateStory`/`moderateText`/`moderateImage` cover
   * the routed capability (D3 — any provider may serve any capability).
   */
  storyProviderFactory: (
    route: Route,
    options?: StoryProviderOptions
  ) => () => StoryGenerationProvider;
  /** Returns an illustration function for an image route. */
  illustrationFactory: (
    route: Route,
    options?: IllustrationProviderOptions
  ) => (prompt: string) => Promise<{ dataUri: string }>;
}

export const DEFAULT_SEAMS: RealAdapterSeams = {
  // Returns a lazy thunk so per-agent providers are only constructed on access.
  storyProviderFactory: (route, options) => () =>
    (route.provider === "opencode-go"
      ? createOpenCodeStoryProvider
      : createOpenRouterStoryProvider)(options),
  // `illustrationFactory` returns the illustration function directly
  // (options forwarded to the real adapter).
  illustrationFactory: (route, options) =>
    (route.provider === "opencode-go" ? createOpenCodeIllustration : createOpenRouterIllustration)(
      options
    ),
};

/** Reads a positive integer env override, or `undefined` when unset/invalid. */
function readOptionalInt(source: string | undefined, min: number): number | undefined {
  if (source === undefined) return undefined;
  const parsed = Number.parseInt(source, 10);
  return Number.isInteger(parsed) && parsed >= min ? parsed : undefined;
}

/**
 * Per-model-request provider options from `MODEL_TIMEOUT_MS` and
 * `MODEL_MAX_ATTEMPTS` (spec 006 / commit 5864dae). `maxRetries` is derived
 * from {@link defaultMaxAttempts} (total attempts ⇒ `attempts - 1` retries so
 * the OpenRouter/OpenCode SDKs retry after the first call) and is **always**
 * applied so the knob's default of 1 (no retry) is honored even when the env
 * var is unset. `timeoutMs` is injected only when explicitly set, keeping each
 * adapter's own documented default when absent (text 60 s, image 120 s).
 */
function modelProviderOptions(): StoryProviderOptions {
  const timeoutMs = readOptionalInt(process.env.MODEL_TIMEOUT_MS, 1000);
  const options: StoryProviderOptions = {};
  if (timeoutMs !== undefined) options.timeoutMs = timeoutMs;
  options.maxRetries = defaultMaxAttempts() - 1;
  return options;
}

/** Illustration provider options: only the timeout (image retries are set-level). */
function illustrationProviderOptions(): IllustrationProviderOptions {
  const timeoutMs = readOptionalInt(process.env.MODEL_TIMEOUT_MS, 1000);
  return timeoutMs !== undefined ? { timeoutMs } : {};
}

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
  return seams.storyProviderFactory(route, modelProviderOptions())();
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
      return (textProvider ??= seams.storyProviderFactory(
        textRoute(),
        modelProviderOptions()
      )()).generateStory(input);
    },
    async moderateText(content) {
      return (moderationProvider ??= seams.storyProviderFactory(
        moderationRoute(),
        modelProviderOptions()
      )()).moderateText(content);
    },
    async moderateImage(prompt) {
      return (moderationProvider ??= seams.storyProviderFactory(
        moderationRoute(),
        modelProviderOptions()
      )()).moderateImage(prompt);
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
    impl ??= seams.illustrationFactory(route, illustrationProviderOptions());
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

  const fakeDelay = createFakePhasedDelay();
  const fakeProvider = createFixedDevProvider(fakeDelay);
  const fakeIllustration = createFixedDevIllustration(fakeDelay);

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
    trustForwardedFor: trustForwardedForEnv(),
  };
}

export function createGenerationRuntime(): GenerationRuntime {
  return createRealRuntime();
}
