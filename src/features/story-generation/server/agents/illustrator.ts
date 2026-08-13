import "server-only";
import type { AgentResult } from "./agent-result";
import type { JobContext } from "./types";
import type { ModeratedStoryCandidate } from "../safety-pipeline";

/**
 * Illustrator agent (specs/006-multi-agent-story-generation/data-model.md).
 *
 * Given the Reviewer-approved narrative, the Illustrator generates a
 * consistent illustration per scene and derives localized, age-safe alt text.
 * Illustration sets are generated with **limited** concurrency (ADR 0005) and
 * bounded whole-set retry: any missing/oversized illustration rejects the whole
 * set so a story is never partially illustrated (SC-006). English prompts are
 * generated server-side only; the response carries only the WebP data-URI.
 */

/** Default limit for a serialized WebP data-URI illustration (responses stay bounded). */
const DEFAULT_MAX_ILLUSTRATION_DATA_URI_LENGTH = 4 * 1024 * 1024;

/** Default max illustrations generated in parallel for one set (ADR 0005). */
const DEFAULT_ILLUSTRATION_CONCURRENCY = 2;

export interface IllustrationResult {
  /** Optimized WebP data-URI for a scene (validated here for size/format). */
  dataUri: string;
}

export interface IllustratorSeams {
  /** Generates an optimized illustration from a moderated scene prompt. */
  illustrate: (prompt: string) => Promise<IllustrationResult>;
  /** Bounded retries for the whole illustration set (default 1). */
  imageRetries?: number;
  /** Max illustrations generated concurrently within a set (default 2). */
  illustrationConcurrency?: number;
  /** Response-size guard on each illustration data URI (override for tests). */
  maxIllustrationDataUriLength?: number;
}

export interface IllustratedScene {
  ordinal: number;
  title: string;
  body: string;
  illustrationDataUri: string;
  altText: string;
}

export interface IllustratedStory {
  title: string;
  safetyDecision: "approved" | "regenerated";
  scenes: IllustratedScene[];
}

function isValidIllustration(dataUri: string, maxLength: number): boolean {
  return /^data:image\/webp;base64,/.test(dataUri) && dataUri.length <= maxLength;
}

/** Runs `worker` for `items` with at most `limit` in flight at once (ADR 0005). */
async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R | undefined>(items.length);
  let nextIndex = 0;
  let cancelled = false;

  async function runSlot() {
    try {
      while (!cancelled && nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        const item = items[index];
        results[index] = await worker(item!, index);
      }
    } finally {
      cancelled = true;
    }
  }

  const slotCount = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: slotCount }, () => runSlot()));
  return results as R[];
}

/** Deterministic, localized, age-safe alt text (never a direct identifier). */
export function altTextFor(
  locale: JobContext["locale"],
  theme: JobContext["theme"],
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
 * Generates a consistent N-image set with bounded whole-set retry and limited
 * concurrency (ADR 0005). Returns the data URIs in scene order, or `null` when
 * the set stays incomplete. Any failed/oversized illustration rejects the whole
 * set so a story is never partially illustrated.
 */
async function illustrateSet(prompts: string[], seams: IllustratorSeams): Promise<string[] | null> {
  const maxLength = seams.maxIllustrationDataUriLength ?? DEFAULT_MAX_ILLUSTRATION_DATA_URI_LENGTH;
  const retries = seams.imageRetries ?? 1;
  const concurrency = seams.illustrationConcurrency ?? DEFAULT_ILLUSTRATION_CONCURRENCY;

  for (let attempt = 0; ; attempt += 1) {
    try {
      const dataUris = await mapWithConcurrency(prompts, concurrency, async (prompt) => {
        const result = await seams.illustrate(prompt);
        if (!isValidIllustration(result.dataUri, maxLength)) {
          throw new Error("invalid illustration");
        }
        return result.dataUri;
      });
      return dataUris;
    } catch {
      if (attempt >= retries) return null;
    }
  }
}

/**
 * Illustrates every approved scene. Returns `Ok<IllustratedStory>` when the
 * whole set is complete and valid, or an `Err` (`stage: "illustrate"`,
 * `transient: true`) when the set stays incomplete so the Coordinator can map
 * it to a typed "generation unavailable" error.
 *
 * @param ctx anonymous job context
 * @param approved the safety-approved narrative
 * @param seams illustration capability seam(s)
 */
export async function illustrateStory(
  ctx: JobContext,
  approved: ModeratedStoryCandidate,
  seams: IllustratorSeams
): Promise<AgentResult<IllustratedStory>> {
  if (!approved || !Array.isArray(approved.scenes)) {
    return {
      ok: false,
      stage: "illustrate",
      message: "story.error.generationUnavailable",
      transient: true,
    };
  }

  const prompts = approved.scenes.map((scene) => scene.illustrationPrompt);
  const dataUris = await illustrateSet(prompts, seams);
  if (!dataUris) {
    return {
      ok: false,
      stage: "illustrate",
      message: "story.error.generationUnavailable",
      transient: true,
    };
  }

  const scenes: IllustratedScene[] = dataUris.map((dataUri, index) => {
    // dataUris carries one entry per prompt, and prompts mirror the approved
    // scenes, so `scene` is always present (non-null asserted for TS indexing).
    const scene = approved.scenes[index]!;
    return {
      ordinal: index + 1,
      title: typeof scene.title === "string" ? scene.title : "",
      body: typeof scene.body === "string" ? scene.body : "",
      illustrationDataUri: dataUri,
      altText: altTextFor(ctx.locale, ctx.theme, index + 1),
    };
  });

  return {
    ok: true,
    value: {
      title: typeof approved.title === "string" ? approved.title : "",
      safetyDecision: approved.safetyDecision,
      scenes,
    },
  };
}
