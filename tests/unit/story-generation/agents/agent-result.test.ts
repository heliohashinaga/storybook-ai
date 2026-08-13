import { describe, expect, it } from "vitest";
import {
  isOk,
  type AgentResult,
} from "../../../../src/features/story-generation/server/agents/agent-result";

describe("agent-result", () => {
  it("isOk narrows an AgentOk<number>", () => {
    const ok: AgentResult<number> = { ok: true, value: 42 };
    expect(isOk(ok)).toBe(true);
  });

  it("isOk narrows an AgentErr", () => {
    const err: AgentResult<number> = {
      ok: false,
      stage: "write",
      message: "story.error.generationUnavailable",
      transient: true,
    };
    expect(isOk(err)).toBe(false);
  });
});
