import "server-only";
import {
  generationTimeout,
  generationUnavailable,
  toErrorJson,
  unsafeUnrecoverable,
} from "../../../lib/http-errors";
import { generateStoryPipeline, createGenerationToken } from "./agents";
import type { JobContext } from "./agents/types";
import { type GeneratedStory, type SafeError } from "./schemas";
import type { ProviderStoryInput, StoryGenerationProvider } from "./story-generation-provider";

/**
 * N-scene generation orchestration (T027 → 006 multi-agent pipeline).
 *
 * `generateStory` is the thin, contract-stable entry point. It builds an
 * anonymous `JobContext` and delegates to the `Coordinator`, which runs the
 * multi-agent pipeline (Reviewer safety gate → Planner → Writer →
 * Illustrator). This keeps the external `POST /api/stories` contract, the
 * `GeneratedStory` model, the privacy/anonymous boundary, and the frontend
 * behavior identical while decomposing the work into focused agents
 * (specs/006-multi-agent-story-generation/).
 *
 * Provider transport failures are mapped to typed HTTP errors (unavailable →
 * 502, timeout → 504). Unsafe results never reach the caller. The requested
 * scene count (`input.sceneCount`, 3–5) is enforced by the Coordinator and the
 * safety pipeline against the shared `MIN_SCENES`/`MAX_SCENES` constants, so a
 * story is only success when exactly the requested number of scenes is
 * complete.
 */

export interface IllustrationResult {
  /** Optimized WebP data-URI for a scene (validated for size/format). */
  dataUri: string;
}

export interface GenerateStoryOptions {
  /** Anonymous request: only ageBand, locale, theme, and requested scene count. */
  input: ProviderStoryInput;
  provider: StoryGenerationProvider;
  /** Generates an optimized illustration from a moderated scene prompt. */
  illustrate: (prompt: string) => Promise<IllustrationResult>;
  /** Bounded retries for the whole illustration set (default 1). */
  imageRetries?: number;
  /** Max illustrations generated concurrently within a set (ADR 0005, default 2). */
  illustrationConcurrency?: number;
  /** Response-size guard on each illustration data URI (override for tests). */
  maxIllustrationDataUriLength?: number;
}

export type GenerateStoryResult =
  { ok: true; story: GeneratedStory } | { ok: false; error: SafeError };

/** Maps an agent error code (preserved from the provider boundary) to a SafeError. */
function safeErrorFor(errorCode: string | undefined): SafeError {
  switch (errorCode) {
    case "generation_timeout":
      return toErrorJson(generationTimeout);
    case "unsafe_unrecoverable":
      return toErrorJson(unsafeUnrecoverable);
    default:
      // Unknown / absent code from a stage = a transport (generation) failure → 502.
      return toErrorJson(generationUnavailable);
  }
}

function buildJobContext(input: ProviderStoryInput): JobContext {
  return {
    ageBand: input.ageBand,
    locale: input.locale,
    theme: input.theme,
    sceneCountRequested: input.sceneCount,
    generationToken: createGenerationToken(),
  };
}

/**
 * Runs the full anonymous generation pipeline and returns either a validated
 * 3–5 scene story (matching `input.sceneCount`) or a typed safe error.
 */
export async function generateStory(options: GenerateStoryOptions): Promise<GenerateStoryResult> {
  const {
    input,
    provider,
    illustrate,
    imageRetries,
    illustrationConcurrency,
    maxIllustrationDataUriLength,
  } = options;

  const ctx = buildJobContext(input);
  const result = await generateStoryPipeline({
    ctx,
    seams: {
      provider,
      illustrate,
      imageRetries,
      illustrationConcurrency,
      maxIllustrationDataUriLength,
    },
  });

  if (result.ok) {
    return { ok: true, story: result.value };
  }
  return { ok: false, error: safeErrorFor(result.errorCode) };
}
