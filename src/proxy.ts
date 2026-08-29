import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * Auth proxy (spec 018 / ADR 0013).
 *
 * Next.js 16 renamed the `middleware` file convention to `proxy`; this file is
 * the migration of the former `src/middleware.ts`. It runs the Clerk proxy on
 * app + API routes, **except** `/demo`: `/demo` stays 100% anonymous (no
 * `__clerk_*` cookie, no session) — it is excluded from the matcher.
 * `/api/:path*` is included so `auth()` resolves inside the `/api/stories`
 * and `/api/narrate` route handlers (mode is derived from the session;
 * anonymous → demo, defense-in-depth).
 *
 * Demo-only deploy (no `CLERK_SECRET_KEY`): the proxy is a no-op so the app
 * boots without Clerk and the demo works with zero cookies.
 */

const isClerkConfigured = Boolean(
  process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
);

/**
 * Custom Clerk Frontend API domain (spec 018 / ADR 0013). Two supported models:
 *
 * - **Clerk-hosted custom domain** (chosen for this app: `clerk.hashinaga.dev`, a
 *   separate subdomain served by Clerk). The publishable key is bound to that
 *   domain and clerk-js/FAPI traffic goes straight to it (cross-origin cookie
 *   handshake). Set `CLERK_PROXY_URL=<scheme>://<domain>` so the server resolver
 *   targets it and the CSP (next.config.ts) allows loading the client runtime.
 * - **App-origin auto-proxy**: with production (`pk_live_`) keys on a non-Clerk
 *   host, `@clerk/nextjs` can auto-proxy the Frontend API/clerk-js through the
 *   app's own origin (`frontendApiProxy` auto-detect). Dev (`pk_test_`) keys do
 *   *not* auto-proxy, which caused the earlier dev-browser handshake churn.
 *
 * Both env knobs are optional, server-only, and leave current/auto behavior
 * untouched when unset:
 *
 * - `CLERK_PROXY_URL`: the Clerk Frontend API base URL (Clerk-hosted custom
 *   domain, or a self-hosted proxy). Passed to `clerkMiddleware({ proxyUrl })`;
 *   also feed the CSP origin in next.config.ts.
 * - `CLERK_FRONTEND_API_PROXY=1`: force-enable the app-origin Frontend API proxy
 *   (mainly for same-origin dev-key/testing scenarios).
 */
const forceFrontendApiProxy = process.env.CLERK_FRONTEND_API_PROXY === "1";
const proxyUrl = process.env.CLERK_PROXY_URL || undefined;

export default isClerkConfigured
  ? clerkMiddleware({
      ...(forceFrontendApiProxy ? { frontendApiProxy: { enabled: true } } : {}),
      ...(proxyUrl ? { proxyUrl } : {}),
    })
  : function proxy() {
      return NextResponse.next();
    };

export const config = {
  // Skip Next internals and static files (unless found in search params) and
  // exclude `/demo` (anonymous path). Always run on API routes.
  matcher: [
    "/((?!_next|demo|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
