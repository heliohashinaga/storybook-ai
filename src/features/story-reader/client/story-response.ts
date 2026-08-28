import {
  safeErrorSchema,
  storyResponseSchema,
  type GeneratedStory,
  type SafeError,
} from "../../story-generation/server/schemas";

/**
 * Client-side parsing of the `POST /api/stories` response (T029). Turns a raw
 * `Response` into either a validated approved story or a typed, sanitized
 * error. No raw provider content crosses this boundary: on success the story is
 * re-validated against `storyResponseSchema`, on failure only the stable
 * `code` + localized `messageKey` + `retryable` trio is surfaced.
 */

export type StoryLoadResult =
  { status: "success"; story: GeneratedStory } | { status: "error"; error: SafeError };

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/** Status-derived fallback used when the server error body is absent/invalid. */
function errorForStatus(status: number): SafeError {
  switch (status) {
    case 400:
      return { code: "invalid_input", messageKey: "story.error.invalidInput", retryable: false };
    case 422:
      return {
        code: "unsafe_unrecoverable",
        messageKey: "story.error.safeAlternativeUnavailable",
        retryable: true,
      };
    case 429:
      return { code: "rate_limited", messageKey: "story.error.tryAgainLater", retryable: true };
    case 403:
      return {
        code: "captcha_failed",
        messageKey: "story.error.captchaFailed",
        retryable: true,
      };
    case 504:
      return {
        code: "generation_timeout",
        messageKey: "story.error.generationTimeout",
        retryable: true,
      };
    default:
      return {
        code: "generation_unavailable",
        messageKey: "story.error.generationUnavailable",
        retryable: true,
      };
  }
}

/**
 * Parses an approved story response. A 200 whose body fails validation is
 * treated as a typed `generation_unavailable` error rather than displayed.
 */
export async function parseStoryResponse(response: Response): Promise<StoryLoadResult> {
  const body: unknown = await readJson(response);

  if (response.ok) {
    const story = storyResponseSchema.safeParse(body);
    if (story.success) return { status: "success", story: story.data };
    return { status: "error", error: errorForStatus(response.status) };
  }

  const error = safeErrorSchema.safeParse(body);
  if (error.success) return { status: "error", error: error.data };
  return { status: "error", error: errorForStatus(response.status) };
}
