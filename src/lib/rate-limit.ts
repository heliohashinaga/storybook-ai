import { createHash, randomBytes } from "node:crypto";

/**
 * Platform-adaptable anonymous rate limiting.
 *
 * The generation route consumes a short-lived, pseudo-anonymous key (a salted,
 * rotating hash of the client IP). That key is used only to bound cost within a
 * short time window and is never a persistent identity: it does not store the
 * raw IP, direct identifiers, or any story content/profile.
 */

const IP_LITERAL_RE = /^[\da-fA-F.:]+$/;

/**
 * Fixed key used when no trustworthy client IP is available. A shared,
 * anonymous aggregate budget — never an identifier, and never merged with
 * per-client keys. Bounded by the same limiter window so a proxyless/unknown
 * source still cannot exhaust unlimited provider cost, but is never used to
 * distinguish or impersonate a client.
 */
export const ANONYMOUS_GLOBAL_KEY = "<anonymous-global>";

export interface ResolveClientIpInput {
  /** Raw `X-Forwarded-For` header value, or null. */
  forwardedFor: string | null;
  /** Raw real-IP header (`x-real-ip` / `CF-Connecting-IP`), or null. */
  realIp: string | null;
}

/**
 * Derives a trustworthy client IP literal for the pseudo-anonymous bucket key.
 *
 * Security model (audit PR #2): `X-Forwarded-For` is **client-forgeable** unless
 * it is rewritten by a reverse proxy we control (e.g. Vercel). When `trust`ed,
 * the real client is the **rightmost** hop our proxy appended — never the
 * client-supplied leftmost hop. When not trusted, no header value is accepted
 * and the caller falls back to {@link ANONYMOUS_GLOBAL_KEY} rather than
 * letting an attacker forge arbitrary per-client keys (or, worse, letting the
 * old `"unknown"` collapse every client into one shared budget). The returned
 * value is validated to look like an IP literal and never contains raw headers.
 */
export function resolveClientIp(
  input: ResolveClientIpInput,
  opts: { trustForwardedFor: boolean }
): string | null {
  if (opts.trustForwardedFor) {
    const hops = input.forwardedFor
      ?.split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const rightmost = hops?.length ? (hops[hops.length - 1] ?? "") : "";
    if (IP_LITERAL_RE.test(rightmost)) return rightmost;
    // Cloudflare/downstream trusted proxies also surface a validated real IP.
    if (input.realIp && IP_LITERAL_RE.test(input.realIp)) return input.realIp;
  }
  return null;
}

/**
 * Environment-derived decision for whether `X-Forwarded-For` is overwritten by a
 * reverse proxy we control. Detect Vercel automatically; allow an explicit
 * opt-in (`TRUST_PROXY=1`) for other trusted-fronter deployments.
 */
export function trustForwardedForEnv(): boolean {
  return process.env.VERCEL === "1" || process.env.TRUST_PROXY === "1";
}

export interface RateLimitResult {
  /** Whether the request may proceed. */
  allowed: boolean;
  /** Requests remaining in the current window (informational). */
  remaining: number;
  /** Seconds until the window resets; null when not limited. */
  retryAfterSeconds: number | null;
}

/**
 * Rate-limiter seam. A platform implementation (in-memory for development/tests,
 * a hosted store in production) can be swapped behind this interface without
 * changing route code.
 */
export interface RateLimiter {
  consume(key: string, now?: number): Promise<RateLimitResult>;
}

/**
 * Derives an opaque, pseudo-anonymous bucket key from the client IP plus a
 * server-side salt. The output is a fixed-size hex digest — the raw IP is never
 * retained, logged, or used as the bucket key. Rotating the salt invalidates
 * old buckets (short-lived anonymity).
 */
export function createPseudoAnonymousKey(input: { ip: string; salt: string }): string {
  return createHash("sha256").update(`${input.salt}:${input.ip}`).digest("hex");
}

/** Generates a fresh per-boot salt so buckets never span process identity. */
export function generateSalt(): string {
  return randomBytes(16).toString("hex");
}

interface InMemoryOptions {
  windowMs: number;
  limit: number;
  clock?: () => number;
}

/**
 * Sliding-window in-memory limiter. Deterministic and injectable (clock, now)
 * so tests never depend on wall-clock time. Suitable for single-instance
 * development and the deterministic test/devloop path; a shared store can
 * implement the same `RateLimiter` interface for production.
 */
export class InMemoryRateLimiter implements RateLimiter {
  private readonly windowMs: number;
  private readonly limit: number;
  private readonly clock: () => number;
  private readonly hits: Map<string, number[]> = new Map();

  constructor(options: InMemoryOptions) {
    this.windowMs = options.windowMs;
    this.limit = options.limit;
    this.clock = options.clock ?? Date.now;
  }

  async consume(key: string, now?: number): Promise<RateLimitResult> {
    const timestamp = now ?? this.clock();
    const windowStart = timestamp - this.windowMs;

    const existing = (this.hits.get(key) ?? []).filter((t) => t > windowStart);
    existing.push(timestamp);
    this.hits.set(key, existing);

    const remaining = this.limit - existing.length;
    if (remaining >= 0) {
      return { allowed: true, remaining, retryAfterSeconds: null };
    }

    const oldest = existing[0];
    const retryAfterMs = Math.max(0, this.windowMs - (timestamp - (oldest ?? timestamp)));
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
    };
  }
}
