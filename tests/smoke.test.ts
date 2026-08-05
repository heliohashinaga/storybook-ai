import { describe, expect, it } from "vitest";

/**
 * Phase 1 smoke test. Real behavior tests arrive in Phase 2+; this placeholder
 * keeps `pnpm test` green while the tooling pipeline is validated.
 */
describe("test tooling smoke", () => {
  it("resolves the Vitest harness with jsdom + RTL setup", () => {
    expect(typeof globalThis.document).toBe("object");
    expect(true).toBe(true);
  });
});
