import { describe, expect, it } from "vitest";
import {
  createStopwatch,
  nowMs,
} from "../../../../src/features/story-generation/server/agents/timing";

describe("timing helpers (T005/T036)", () => {
  it("nowMs returns a finite, non-negative monotonic time", () => {
    const t = nowMs();
    expect(typeof t).toBe("number");
    expect(Number.isFinite(t)).toBe(true);
    expect(t).toBeGreaterThanOrEqual(0);
  });

  it("elapsedMs increases over time (without sleeping, it is ≥ 0)", () => {
    const sw = createStopwatch();
    const a = sw.elapsedMs();
    const b = sw.elapsedMs();
    expect(b).toBeGreaterThanOrEqual(a);
  });

  it("tick records an increasing duration per stage", () => {
    const sw = createStopwatch();
    sw.tick("plan");
    const write = sw.tick("write");
    expect(write).toBeGreaterThanOrEqual(0);
    expect(sw.isOverBudget(1)).toBe(false); // within any sane budget immediately
  });

  it("isOverBudget is false within a generous budget", () => {
    const sw = createStopwatch();
    expect(sw.isOverBudget(1_000_000)).toBe(false);
  });
});
