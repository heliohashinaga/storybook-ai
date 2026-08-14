import "server-only";

/**
 * Common result type shared by every pipeline agent
 * (specs/006-multi-agent-story-generation/data-model.md).
 *
 * Each agent returns an `AgentResult<T>` — an "Ok" carrying a typed value, or
 * an "Err" carrying enough context for the Coordinator to retry (transient
 * failures) or surface a typed, localized safe error (permanent ones). The
 * payload is in-memory and transient; nothing here is ever persisted.
 */

/** Canonical role identifiers for the six-agent pipeline. */
export const AGENT_IDS = [
  "coordinator",
  "planner",
  "writer",
  "moderator",
  "illustrator",
  "reader",
] as const;

export type AgentId = (typeof AGENT_IDS)[number];

/** Which pipeline stage produced an error (drives retry + messaging). */
export type AgentStage =
  "plan" | "write" | "moderate" | "illustrate" | "read" | "assemble" | "rate-limit";

export interface AgentOk<T> {
  ok: true;
  value: T;
}

export interface AgentErr {
  ok: false;
  /** The stage that failed (or `"rate-limit"` for transient throttling). */
  stage: AgentStage;
  /** Localized message key (never a raw provider message). */
  message: string;
  /**
   * True when the Coordinator may safely retry the stage (transient, e.g. a
   * 429 throttling or a provider timeout); false when the failure is
   * permanent and must surface immediately as a safe error.
   */
  transient: boolean;
  /**
   * Optional exact safe-error code from the provider boundary (e.g.
   * `generation_timeout` vs `generation_unavailable`), preserved so the outer
   * `generateStory` wrapper can map back to the precise localized HTTP error.
   */
  errorCode?: string;
}

/** Discriminated union used as every agent's return type. */
export type AgentResult<T> = AgentOk<T> | AgentErr;

/** Narrowing helper — satisfies the coordinator's stage branching. */
export function isOk<T>(result: AgentResult<T>): result is AgentOk<T> {
  return result.ok;
}
