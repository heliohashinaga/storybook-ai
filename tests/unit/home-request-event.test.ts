import { describe, expect, it, vi } from "vitest";
import { onHomeRequested, requestHome } from "../../src/lib/home-request-event";

/**
 * The top-nav brand mark (shell) and the story app (feature) are siblings on
 * the same route, so `router.push("/")` is a client-side no-op that never
 * returns the reader to the form. This module carries the "go home → reset to
 * form" signal between them. These tests pin its subscribe/emit semantics.
 */
describe("home-request-event", () => {
  it("notifies all subscribed listeners on requestHome", () => {
    const a = vi.fn();
    const b = vi.fn();
    const unsubA = onHomeRequested(a);
    onHomeRequested(b);

    requestHome();

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    unsubA();
  });

  it("stops notifying a listener after it unsubscribes", () => {
    const a = vi.fn();
    const unsubA = onHomeRequested(a);
    requestHome();
    expect(a).toHaveBeenCalledTimes(1);

    unsubA();
    requestHome();
    // Only the first emission reached it; the second is dropped.
    expect(a).toHaveBeenCalledTimes(1);
  });

  it("does nothing when there are no listeners", () => {
    // prev: not possible to fully "clear" in a fresh import; just assert no throw.
    expect(() => requestHome()).not.toThrow();
  });
});
