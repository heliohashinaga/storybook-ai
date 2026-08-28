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

export default isClerkConfigured
  ? clerkMiddleware()
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
