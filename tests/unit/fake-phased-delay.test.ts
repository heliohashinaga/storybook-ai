import { describe, expect, it, vi } from "vitest";
import {
  createFakePhasedDelay,
  type FakeLoadPhase,
} from "../../src/features/story-generation/server/fixed-dev-provider";

/**
 * The fake-load is redistributed per pipeline **phase** (write → illustrate →
 * review), not per provider call, so the loading screen's elapsed-based steps
 * advance uniformly instead of stalling on the final (clamped) step. These
 * tests pin that each phase pays the fake delay exactly once — regardless of
 * how many provider calls the phase triggers (Planner + Writer, or N scene
 * illustrations) — and that it is a no-op under tests.
 */
describe("createFakePhasedDelay — fake-load distributed once per phase", () => {
  const track = () => {
    const paid = vi.fn((_phase: FakeLoadPhase) => Promise.resolve());
    return { paid, gate: createFakePhasedDelay(paid) };
  };

  it("pays the delay once per phase, even when a phase is hit many times", async () => {
    const { paid, gate } = track();

    // Planner + Writer: two generateStory calls in the "write" phase.
    await gate.wait("write");
    await gate.wait("write");

    // Multiple scene illustrations in the "illustrate" phase.
    await gate.wait("illustrate");
    await gate.wait("illustrate");
    await gate.wait("illustrate");

    // Text + image moderation share a single "review" phase.
    await gate.wait("review");
    await gate.wait("review");

    // Exactly one payment per phase → three payments total.
    expect(paid).toHaveBeenCalledTimes(3);
  });

  it("covers write, illustrate and review phases exactly once each", async () => {
    const { paid, gate } = track();
    const phases = ["write", "illustrate", "review"] as const;

    for (const phase of phases) {
      await gate.wait(phase);
      await gate.wait(phase);
    }

    const calledWith = paid.mock.calls.map(([p]) => p);
    expect(new Set(calledWith)).toEqual(new Set(phases));
    expect(paid).toHaveBeenCalledTimes(phases.length);
  });

  it("defers the actual delay to the injected function", async () => {
    const { paid, gate } = track();
    await gate.wait("write");
    expect(paid).toHaveBeenCalledTimes(1);
  });
});
