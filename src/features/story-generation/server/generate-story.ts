import "server-only";
import {
  generationTimeout,
  generationUnavailable,
  toErrorJson,
  unsafeUnrecoverable,
} from "../../../lib/http-errors";
import { N_SCENES, storyResponseSchema, type GeneratedStory, type SafeError } from "./schemas";
import { runSafetyPipeline } from "./safety-pipeline";
import {
  ProviderError,
  type ProviderStoryInput,
  type StoryGenerationProvider,
} from "./story-generation-provider";

/**
 * N-scene generation orchestration (T027). Composes the provider, the safety
 * pipeline, and illustration generation into one anonymous story request:
 *
 * 1. `runSafetyPipeline` moderates the structured narrative (text **and** each
 *    illustration prompt) with bounded auto-regeneration.
 * 2. A consistent three-image set is generated from the moderated prompts,
 *    with bounded whole-set retry when any illustration is missing/oversized.
 * 3. Every scene gets localized alt text; the result is validated against the
 *    story-response schema before it may be returned.
 *
 * Provider transport failures are mapped to typed HTTP errors (unavailable →
 * 502, timeout → 504). Unsafe results never reach the caller. The scene count
 * is enforced here and in the safety pipeline against the single validated
 * `N_SCENES` constant from the shared schemas (extension point for 3/4/5).
 */

/** Default limit for a serialized WebP data-URI illustration (responses stay bounded). */
const DEFAULT_MAX_ILLUSTRATION_DATA_URI_LENGTH = 4 * 1024 * 1024;

export interface IllustrationResult {
  /** Optimized WebP data-URI for a scene (validated here for size/format). */
  dataUri: string;
}

export interface GenerateStoryOptions {
  /** Anonymous request: only ageBand, locale, theme. */
  input: ProviderStoryInput;
  provider: StoryGenerationProvider;
  /** Generates an optimized illustration from a moderated scene prompt. */
  illustrate: (prompt: string) => Promise<IllustrationResult>;
  /** Bounded retries for the whole illustration set (default 1). */
  imageRetries?: number;
  /** Response-size guard on each illustration data URI (override for tests). */
  maxIllustrationDataUriLength?: number;
}

export type GenerateStoryResult =
  { ok: true; story: GeneratedStory } | { ok: false; error: SafeError };

/** Maps provider transport errors to the typed, localized HTTP error contract. */
function mapProviderError(error: unknown): SafeError {
  if (error instanceof ProviderError) {
    if (error.kind === "timeout") return toErrorJson(generationTimeout);
    // unavailable and invalid_structured_output both mean "no valid result".
    return toErrorJson(generationUnavailable);
  }
  return toErrorJson(generationUnavailable);
}

function isValidIllustration(dataUri: string, maxLength: number): boolean {
  return /^data:image\/webp;base64,/.test(dataUri) && dataUri.length <= maxLength;
}

/**
 * Generates a consistent three-image set with bounded whole-set retry. Returns
 * the data URIs in scene order, or `null` when the set stays incomplete.
 */
async function illustrateSet(
  prompts: string[],
  options: GenerateStoryOptions
): Promise<string[] | null> {
  const maxLength =
    options.maxIllustrationDataUriLength ?? DEFAULT_MAX_ILLUSTRATION_DATA_URI_LENGTH;
  const retries = options.imageRetries ?? 1;

  for (let attempt = 0; ; attempt += 1) {
    try {
      const dataUris: string[] = [];
      for (const prompt of prompts) {
        const result = await options.illustrate(prompt);
        if (!isValidIllustration(result.dataUri, maxLength)) {
          throw new Error("invalid illustration");
        }
        dataUris.push(result.dataUri);
      }
      return dataUris;
    } catch {
      if (attempt >= retries) return null;
    }
  }
}

/** Deterministic, localized, age-safe alt text (never a direct identifier). */
function altTextFor(
  locale: "pt-BR" | "en",
  theme: "courage" | "friendship" | "kindness",
  ordinal: number
): string {
  if (locale === "en") {
    const themeEn =
      theme === "courage" ? "courage" : theme === "friendship" ? "friendship" : "kindness";
    return `Scene ${ordinal} of a story about ${themeEn}.`;
  }
  const themePt = theme === "courage" ? "coragem" : theme === "friendship" ? "amizade" : "bondade";
  return `Ilustração da cena ${ordinal} de uma história sobre ${themePt}.`;
}

/**
 * Runs the full anonymous generation pipeline and returns either a validated
 * three-scene story or a typed, localized safe error.
 */
export async function generateStory(options: GenerateStoryOptions): Promise<GenerateStoryResult> {
  const { input, provider } = options;

  let safetyDecision: "approved" | "regenerated";
  let title: string;
  let scenes: { ordinal: number; title: string; body: string; illustrationPrompt: string }[];

  try {
    const moderated = await runSafetyPipeline({ provider, input });
    if (!moderated.ok) return { ok: false, error: moderated.error };
    safetyDecision = moderated.candidate.safetyDecision;
    title = moderated.candidate.title;
    scenes = moderated.candidate.scenes;
  } catch (error) {
    return { ok: false, error: mapProviderError(error) };
  }

  // Defense-in-depth: the orchestration boundary re-binds the single validated
  // scene count regardless of which safety pipeline produced the candidate, so
  // a future variable-scene-count extension stays safe here too.
  if (scenes.length !== N_SCENES) {
    return { ok: false, error: toErrorJson(unsafeUnrecoverable) };
  }

  const dataUris = await illustrateSet(
    scenes.map((scene) => scene.illustrationPrompt),
    options
  );
  if (!dataUris) {
    return { ok: false, error: toErrorJson(generationUnavailable) };
  }

  const story: GeneratedStory = {
    locale: input.locale,
    ageBand: input.ageBand,
    theme: input.theme,
    safetyDecision,
    title,
    scenes: scenes.map((scene, index) => ({
      ordinal: scene.ordinal,
      title: scene.title,
      body: scene.body,
      illustrationDataUri: dataUris[index] ?? "",
      altText: altTextFor(input.locale, input.theme, index + 1),
    })),
  };

  const parsed = storyResponseSchema.safeParse(story);
  if (!parsed.success) {
    return { ok: false, error: toErrorJson(generationUnavailable) };
  }
  return { ok: true, story: parsed.data };
}
