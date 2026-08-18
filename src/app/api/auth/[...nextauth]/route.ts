import "server-only";
import { handlers } from "../../../../features/auth/server/auth";
import { withAuthRateLimit } from "../../../../features/auth/server/auth-rate-limit";

/**
 * Auth.js route handlers (`/api/auth/*`) wrapped with the anonymous OAuth rate
 * limiter (spec 010 hardening). Every response is `Cache-Control: no-store`.
 * Provider callbacks (Google/GitHub) happen server-side; the client only posts
 * to this route and is redirected — batteries-on-the-wire stay opaque.
 */
export const GET = withAuthRateLimit(handlers.GET);
export const POST = withAuthRateLimit(handlers.POST);
