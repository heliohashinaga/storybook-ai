import { buildSafeCandidate } from "./provider-fixtures";
import type { AgentResult } from "../../../src/features/story-generation/server/agents/agent-result";
import type { JobContext } from "../../../src/features/story-generation/server/agents/types";
import type { ModeratedStoryCandidate } from "../../../src/features/story-generation/server/safety-pipeline";

/**
 * Deterministic, controllable fakes for the multi-agent pipeline stages
 * (specs/006-multi-agent-story-generation, T004). They never call a live AI
 * service, record only anonymous inputs, and let tests wire failure modes /
 * call-count assertions per agent with zero network. Each fake returns the
 * well-typed `AgentResult` the real agent would, so a Coordinator seam can be
 * fully stubbed in integration tests.
 */

const WEBP = "data:image/webp;base64,QUJDRA==";

/** Builds a safety-approved candidate fixture for a given job context. */
function approvedFor(ctx: JobContext): ModeratedStoryCandidate {
  const base = buildSafeCandidate({
    ageBand: ctx.ageBand,
    locale: ctx.locale,
    theme: ctx.theme,
    sceneCount: ctx.sceneCountRequested,
  });
  return { ...base, safetyDecision: "approved" };
}

export interface PlannerFake {
  calls: number;
  /** When set, the fake returns this permanent error instead of the outline. */
  fail?: boolean;
  plan: (
    ctx: JobContext
  ) => Promise<AgentResult<{ scenes: Array<{ index: number; purpose: string }> }>>;
}

/** Deterministic Planner fake: always plans `sceneCountRequested` scenes. */
export function createPlannerFake(options: { fail?: boolean } = {}): PlannerFake {
  const state: PlannerFake = {
    calls: 0,
    fail: options.fail,
    async plan(ctx) {
      state.calls += 1;
      if (state.fail) {
        return {
          ok: false,
          stage: "plan",
          message: "story.error.generationUnavailable",
          transient: false,
        };
      }
      return {
        ok: true,
        value: {
          scenes: Array.from({ length: ctx.sceneCountRequested }, (_, i) => ({
            index: i + 1,
            purpose: `scene-${i + 1}-${ctx.theme}`,
          })),
        },
      };
    },
  };
  return state;
}

export interface WriterFake {
  calls: number;
  fail?: boolean;
  write: (
    ctx: JobContext,
    approved: ModeratedStoryCandidate
  ) => Promise<AgentResult<{ title: string; scenes: unknown[] }>>;
}

/** Deterministic Writer fake: mirrors the approved candidate's scenes. */
export function createWriterFake(options: { fail?: boolean } = {}): WriterFake {
  const state: WriterFake = {
    calls: 0,
    fail: options.fail,
    async write(ctx, approved) {
      state.calls += 1;
      if (state.fail) {
        return {
          ok: false,
          stage: "write",
          message: "story.error.generationUnavailable",
          transient: false,
        };
      }
      return {
        ok: true,
        value: {
          title: approved.title,
          scenes: (approved.scenes ?? []).map((s, i) => ({
            ordinal: i + 1,
            title: s.title,
            body: s.body,
            illustrationPrompt: s.illustrationPrompt,
          })),
        },
      };
    },
  };
  return state;
}

export interface ReviewerFake {
  calls: number;
  /** Emit a safe approval (default) or a transient/permanent error. */
  mode?: "safe" | "unavailable" | "unsafe";
  review: () => Promise<AgentResult<ModeratedStoryCandidate>>;
}

/** Deterministic Reviewer fake: approval or a scripted failure mode. */
export function createReviewerFake(
  ctx: JobContext,
  options: { mode?: "safe" | "unavailable" | "unsafe" } = {}
): ReviewerFake {
  const mode = options.mode ?? "safe";
  const metrics = { calls: 0 };
  const state = {
    calls: 0,
    mode,
    async review(): Promise<AgentResult<ModeratedStoryCandidate>> {
      metrics.calls += 1;
      state.calls = metrics.calls;
      if (state.mode === "unavailable") {
        return {
          ok: false,
          stage: "review",
          message: "story.error.generationUnavailable",
          transient: true,
          errorCode: "generation_unavailable",
        };
      }
      if (state.mode === "unsafe") {
        return {
          ok: false,
          stage: "review",
          message: "story.error.unsafeUnrecoverable",
          transient: false,
          errorCode: "unsafe_unrecoverable",
        };
      }
      return { ok: true, value: approvedFor(ctx) };
    },
  } satisfies ReviewerFake;
  return state;
}

export interface IllustratorFake {
  calls: number;
  fail?: boolean;
  illustrate: (ctx: JobContext) => Promise<AgentResult<{ scenes: unknown[] }>>;
}

/** Deterministic Illustrator fake: one WebP data-URI per requested scene. */
export function createIllustratorFake(options: { fail?: boolean } = {}): IllustratorFake {
  const metrics = { calls: 0 };
  const state = {
    calls: 0,
    fail: options.fail,
    async illustrate(ctx: JobContext): Promise<AgentResult<{ scenes: unknown[] }>> {
      metrics.calls += 1;
      state.calls = metrics.calls;
      if (state.fail) {
        return {
          ok: false,
          stage: "illustrate",
          message: "story.error.generationUnavailable",
          transient: true,
        };
      }
      return {
        ok: true,
        value: {
          scenes: Array.from({ length: ctx.sceneCountRequested }, (_, i) => ({
            ordinal: i + 1,
            illustrationDataUri: WEBP,
            altText: `Scene ${i + 1}.`,
          })),
        },
      };
    },
  } satisfies IllustratorFake;
  return state;
}

export interface ReaderFake {
  calls: number;
  fail?: boolean;
  read: (text: string) => Promise<AgentResult<{ ordinal: number }>>;
}

/** Deterministic Reader fake: accepts any non-empty scene text. */
export function createReaderFake(options: { fail?: boolean } = {}): ReaderFake {
  const metrics = { calls: 0 };
  const state = {
    calls: 0,
    fail: options.fail,
    async read(text: string): Promise<AgentResult<{ ordinal: number }>> {
      metrics.calls += 1;
      state.calls = metrics.calls;
      if (state.fail) {
        return {
          ok: false,
          stage: "read",
          message: "story.error.generationUnavailable",
          transient: false,
        };
      }
      if (!text || text.trim().length === 0) {
        return {
          ok: false,
          stage: "read",
          message: "story.error.invalidInput",
          transient: false,
        };
      }
      return { ok: true, value: { ordinal: 1 } };
    },
  } satisfies ReaderFake;
  return state;
}
