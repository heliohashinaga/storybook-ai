import "server-only";

/**
 * Bounded per-model-request helper (specs/006-multi-agent-story-generation).
 *
 * Retry/timeout happen at the level of a SINGLE provider/model request, not the
 * whole pipeline. The Coordinator runs each stage exactly once (no pipeline
 * retry); if a model call still fails the error surfaces and the user retries
 * manually (regenerate button). Defaults are read from server-only env so the
 * operator can tune them, but the retry count is always capped (never
 * infinite).
 */

export interface RetryPolicy {
  /** Total attempts (includes the first), never negative. */
  maxAttempts: number;
}

/** Reads the per-model-request max attempts from env (default 1 = no retry). */
export function defaultMaxAttempts(): number {
  const raw = process.env.MODEL_MAX_ATTEMPTS;
  if (!raw) return 1;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isInteger(parsed) && parsed >= 1) return parsed;
  return 1;
}

/**
 * Reads the per-model-request timeout from env (ms, default 60000). Frames a
 * single provider/model call so a slow/hung model fails fast instead of
 * languishing the whole pipeline.
 */
export function defaultModelTimeoutMs(): number {
  const raw = process.env.MODEL_TIMEOUT_MS;
  if (!raw) return 60_000;
  const parsed = Number.parseInt(raw, 10);
  return Number.isInteger(parsed) && parsed >= 1000 ? parsed : 60_000;
}

export type RetryOperation<T> = (
  attempt: number
) => Promise<{ ok: true; value: T } | { ok: false; message?: string; transient?: boolean }>;

/**
 * Re-runs a single model request `op` up to `maxAttempts` times. Exits early
 * on success or a permanent `{ ok: false }`; only a *transient* throw is
 * retried. This bounds a flaky per-model call without re-running the pipeline
 * (no pipeline-level retry). All failures surface a generic, localized key.
 *
 * @param op callback receiving the 1-based attempt number
 * @param policy bounded attempt count (default env-driven, capped)
 */
export async function runWithRetry<T>(
  op: RetryOperation<T>,
  policy: RetryPolicy = { maxAttempts: defaultMaxAttempts() }
): Promise<{ ok: true; value: T } | { ok: false; message: string; transient: boolean }> {
  const maxAttempts = Math.max(1, policy.maxAttempts);
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const result = await op(attempt);
      if (result.ok) return result;
      // A non-throwing `{ ok: false }` is a permanent stage failure — no retry.
      // Normalize any missing fields so the promise type stays stable.
      return {
        ok: false,
        message: result.message ?? "story.error.generationUnavailable",
        transient: result.transient ?? false,
      };
    } catch {
      const isLastAttempt = attempt >= maxAttempts;
      if (isLastAttempt) {
        return {
          ok: false,
          // No raw provider message crosses the boundary — always a generic key.
          message: "story.error.generationUnavailable",
          transient: true,
        };
      }
      // Transient error: loop again up to maxAttempts.
    }
  }
  // Unreachable while maxAttempts >= 1, but kept for exhaustiveness.
  return { ok: false, message: "story.error.generationUnavailable", transient: true };
}
