import "server-only";
import type { NextRequest } from "next/server";
import {
  ANONYMOUS_GLOBAL_KEY,
  createPseudoAnonymousKey,
  generateSalt,
  InMemoryRateLimiter,
  resolveClientIp,
  trustForwardedForEnv,
  type RateLimiter,
} from "../../../lib/rate-limit";

/**
 * Rate-limits the OAuth endpoints (`/api/auth/*`) so sign-in/callback cannot
 * be weaponized as a DoS or an impersonation/credential-stuffing seam (spec
 * 010 hardening). Keys on the same salted, hashed pseudo-anonymous IP as the
 * story endpoints: no raw IP or identity is ever retained. Also stamps every
 * auth response `Cache-Control: no-store` (zero persistence, matching the rest
 * of the server surface).
 */

const AUTH_RATE_LIMIT_MAX_REQUESTS = Number(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS ?? 30);
const AUTH_RATE_LIMIT_WINDOW_MS = Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS ?? 60_000);

const limiter: RateLimiter = new InMemoryRateLimiter({
  limit: AUTH_RATE_LIMIT_MAX_REQUESTS,
  windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
});

const salt = generateSalt();
const trustForwardedFor = trustForwardedForEnv();

const NO_STORE = { "Cache-Control": "no-store" } as const;

export type AuthRouteHandler = (request: NextRequest) => Response | Promise<Response>;

/**
 * Wraps a NextAuth route handler with (1) anonymous rate limiting and
 * (2) a `Cache-Control: no-store` guarantee on every response.
 */
export function withAuthRateLimit(handler: AuthRouteHandler) {
  return async function (request: NextRequest): Promise<Response> {
    const ip = resolveClientIp(
      {
        forwardedFor: request.headers.get("x-forwarded-for"),
        realIp: request.headers.get("x-real-ip"),
      },
      { trustForwardedFor }
    );
    const key = ip ? createPseudoAnonymousKey({ ip, salt }) : ANONYMOUS_GLOBAL_KEY;

    const rate = await limiter.consume(key);
    if (!rate.allowed) {
      const response = new Response(null, {
        status: 429,
        headers: {
          ...NO_STORE,
          "Retry-After": String(rate.retryAfterSeconds ?? 1),
        },
      });
      return response;
    }

    const response = await handler(request);
    response.headers.set("Cache-Control", "no-store");
    return response;
  };
}
