// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

/**
 * Session guard over Clerk `auth()` (spec 018 / ADR 0013).
 *
 * `isAuthenticated()`/`requireSession()` wrap Clerk's `auth()`. The auth module
 * is mocked: on a demo-only deploy (no Clerk keys) `auth()` throws, which must
 * be treated as anonymous (never crashes, never authenticates).
 */

const redirectMock = vi.hoisted(() => vi.fn());
const authMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@clerk/nextjs/server", () => ({ auth: authMock }));

async function loadSession() {
  vi.resetModules();
  return await import("../../src/features/auth/server/session");
}

describe("session — Clerk (spec 018)", () => {
  it("isAuthenticated true when auth returns a userId", async () => {
    authMock.mockResolvedValue({ userId: "user_123" });
    const { isAuthenticated } = await loadSession();
    expect(await isAuthenticated()).toBe(true);
  });

  it("isAuthenticated false when auth returns no userId", async () => {
    authMock.mockResolvedValue({ userId: null });
    const { isAuthenticated } = await loadSession();
    expect(await isAuthenticated()).toBe(false);
  });

  it("isAuthenticated false when auth throws (demo-only, no keys)", async () => {
    authMock.mockRejectedValue(new Error("missing publishable key"));
    const { isAuthenticated } = await loadSession();
    expect(await isAuthenticated()).toBe(false);
  });

  it("requireSession redirects to / when not authenticated", async () => {
    redirectMock.mockImplementation(() => {
      throw new Error("redirect");
    });
    authMock.mockResolvedValue({ userId: null });
    const { requireSession } = await loadSession();
    await expect(requireSession()).rejects.toThrow("redirect");
    expect(redirectMock).toHaveBeenCalledWith("/");
  });

  it("requireSession does not redirect when authenticated", async () => {
    authMock.mockResolvedValue({ userId: "user_123" });
    const { requireSession } = await loadSession();
    await expect(requireSession()).resolves.toBeUndefined();
  });
});
