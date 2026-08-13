import "server-only";

/**
 * Pipeline timing helpers (specs/006-multi-agent-story-generation, T005 / T036).
 *
 * The full generation budget is ≤120 s end-to-end (performance budget, spec
 * 001). These helpers give the Coordinator a simple monotonic stopwatch so a
 * stage can be abandoned early (instead of exhausting a latency budget) and
 * tests can assert deterministic per-stage timing without wall-clock flakiness.
 */

/** Monotonic clock in milliseconds (Date.now is not monotonic; use this). */
export function nowMs(): number {
  // `performance.now()` is monotonic in Node and browsers and reduces by no
  // amount on system clock adjustments.
  return globalThis.performance.now();
}

export interface TimedStage {
  /** Stage id (plan | write | review | illustrate | assemble | read). */
  stage: string;
  /** Duration in milliseconds (bounded by the parent budget). */
  durationMs: number;
}

export interface Stopwatch {
  /** Elapsed milliseconds since the stopwatch started. */
  elapsedMs: () => number;
  /** Mark a stage boundary, returning the tick's stage duration. */
  tick: (stage: string) => number;
  /** Whether the cumulative elapsed time has crossed `budgetMs`. */
  isOverBudget: (budgetMs: number) => boolean;
}

/**
 * Creates a stopwatch seeded at the current monotonic time. `tick` snapshots
 * the elapsed time and records the duration since the previous tick (or start).
 * It never throws and never depends on the wall clock, so tests stay
 * deterministic.
 */
export function createStopwatch(): Stopwatch {
  const startedAt = nowMs();
  let last = startedAt;
  const records: TimedStage[] = [];
  return {
    elapsedMs: () => nowMs() - startedAt,
    tick(stage: string) {
      const now = nowMs();
      const durationMs = now - last;
      last = now;
      records.push({ stage, durationMs });
      return durationMs;
    },
    isOverBudget(budgetMs: number) {
      return nowMs() - startedAt > budgetMs;
    },
  };
}
