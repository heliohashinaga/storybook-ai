import "server-only";

/**
 * Bounded retry policy for the multi-agent pipeline
 * (specs/006-multi-agent-story-generation/research.md).
 *
 * Agents execute over a network provider that can fail transiently (rate
 * limit 429, timeout, provider blip). Rather than retrying ad hoc inside each
 * agent, the Coordinator runs stages through a single bounded helper:
 * `runWithRetry`. Defaults are read from server-only env so the operator can
 * tune them, but the retry count is always capped (never infinite).
 */

export interface RetryPolicy {
  /** Total attempts (includes the first), never negative. */
  maxAttempts: number;
}

/** Reads the pipeline max-attempts from env (default 2), server-only. */
export function defaultMaxAttempts(): number {
  const raw = process.env.STORY_PIPELINE_MAX_ATTEMPTS;
  if (!raw) return 2;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isInteger(parsed) && parsed >= 1) return parsed;
  return 2;
}

export type RetryOperation<T> = (
  attempt: number
) => Promise<{ ok: true; value: T } | { ok: false; message?: string; transient?: boolean }>;

/**
 * Runs `op` up to `maxAttempts` times. The helper exits early on the first
 * success (or the first permanent/`{ ok: false }` result) and only re-invokes
 * `op` when the previous attempt threw a *transient* error (the caller signals
 * success vs. transient failure via the discriminated return). When all
 * attempts fail or throw, it rejects so the Coordinator can map the stage to a
 * typed safe error.
 *
 * @param op callback receiving the 1-based attempt number
 * @param policy bounded attempt count (default env-driven, capped at 2)
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
