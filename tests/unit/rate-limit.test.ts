import { describe, expect, it } from "vitest";
import {
  ANONYMOUS_GLOBAL_KEY,
  InMemoryRateLimiter,
  createPseudoAnonymousKey,
  resolveClientIp,
  type RateLimiter,
} from "../../src/lib/rate-limit";

describe("pseudo-anonymous rate-limit key", () => {
  it("derives a stable, opaque hash from ip+salt", () => {
    const key = createPseudoAnonymousKey({ ip: "203.0.113.7", salt: "dev-salt" });
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(key).not.toContain("203.0.113.7");
    expect(createPseudoAnonymousKey({ ip: "203.0.113.7", salt: "dev-salt" })).toBe(key);
  });

  it("differs across ips and salts (rotation)", () => {
    const a = createPseudoAnonymousKey({ ip: "203.0.113.7", salt: "s1" });
    const b = createPseudoAnonymousKey({ ip: "203.0.113.7", salt: "s2" });
    const c = createPseudoAnonymousKey({ ip: "198.51.100.9", salt: "s1" });
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });
});

describe("InMemoryRateLimiter sliding window", () => {
  function at(ms: number) {
    return () => ms;
  }

  it("allows requests up to the window limit and ratelimits past it", async () => {
    const clock = at(1000);
    const limiter: RateLimiter = new InMemoryRateLimiter({ windowMs: 10_000, limit: 2, clock });
    const key = "k1";
    expect((await limiter.consume(key)).allowed).toBe(true);
    expect((await limiter.consume(key)).allowed).toBe(true);
    const third = await limiter.consume(key);
    expect(third.allowed).toBe(false);
    expect(third.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("gives rate-limit responses a retryable window", async () => {
    const clock = at(1000);
    const limiter = new InMemoryRateLimiter({ windowMs: 10_000, limit: 1, clock });
    await limiter.consume("k2");
    const denied = await limiter.consume("k2");
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterSeconds).toBe(10);
  });

  it("refreshes the window after it elapses", async () => {
    let now = 1000;
    const mutableClock = () => now;
    const limiter = new InMemoryRateLimiter({ windowMs: 10_000, limit: 1, clock: mutableClock });
    expect((await limiter.consume("k3")).allowed).toBe(true);
    expect((await limiter.consume("k3")).allowed).toBe(false);
    now = 11_000;
    expect((await limiter.consume("k3")).allowed).toBe(true);
  });

  it("treats distinct keys independently", async () => {
    const limiter = new InMemoryRateLimiter({ windowMs: 10_000, limit: 1 });
    expect((await limiter.consume("ka")).allowed).toBe(true);
    expect((await limiter.consume("kb")).allowed).toBe(true);
    expect((await limiter.consume("ka")).allowed).toBe(false);
  });

  it("accepts an injected now timestamp (no wall-clock dependence)", async () => {
    const limiter = new InMemoryRateLimiter({ windowMs: 10_000, limit: 1 });
    expect((await limiter.consume("kn", 1000)).allowed).toBe(true);
    expect((await limiter.consume("kn", 2000)).allowed).toBe(false);
    // At now=12000 the earliest hit (1000) and the denied hit (2000) are both
    // outside the sliding window (start 2000, exclusive), so a new window opens.
    expect((await limiter.consume("kn", 12_000)).allowed).toBe(true);
  });
});

describe("resolveClientIp (trusted reverse-proxy model)", () => {
  const trust = { trustForwardedFor: true };
  const noTrust = { trustForwardedFor: false };

  it("behind a trusted proxy returns the RIGHTMOST XFF hop (the real client), not the client-forged leftmost hop", () => {
    // CWE-918-style XFF spoofing: attacker sends a public leftmost hop and the
    // proxy appends the actual client to the right.
    expect(
      resolveClientIp({ forwardedFor: "203.0.113.1, 198.51.100.9", realIp: null }, trust)
    ).toBe("198.51.100.9");
  });

  it("behind a trusted proxy returns a single XFF hop", () => {
    expect(resolveClientIp({ forwardedFor: "203.0.113.7", realIp: null }, trust)).toBe(
      "203.0.113.7"
    );
  });

  it("ignores a non-IP-literal XFF value (no usable key)", () => {
    expect(resolveClientIp({ forwardedFor: "ScriptKiddie", realIp: null }, trust)).toBeNull();
  });

  it("DOES NOT trust XFF when not behind a trusted proxy (no client-forged key)", () => {
    expect(resolveClientIp({ forwardedFor: "203.0.113.7", realIp: null }, noTrust)).toBeNull();
  });

  it("falls back to a validated real-ip header when behind a trusted proxy", () => {
    expect(resolveClientIp({ forwardedFor: null, realIp: "198.51.100.9" }, trust)).toBe(
      "198.51.100.9"
    );
  });

  it("returns null when the proxy is trusted but no forwarded/real IP is present", () => {
    expect(resolveClientIp({ forwardedFor: null, realIp: null }, trust)).toBeNull();
  });

  it("trailing comma list resolves the last non-empty hop", () => {
    expect(
      resolveClientIp({ forwardedFor: "203.0.113.1,198.51.100.9,", realIp: null }, trust)
    ).toBe("198.51.100.9");
  });

  it("has a stable non-identifier global fallback key", () => {
    expect(ANONYMOUS_GLOBAL_KEY).toBe("<anonymous-global>");
    expect(ANONYMOUS_GLOBAL_KEY).not.toMatch(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/);
  });
});
