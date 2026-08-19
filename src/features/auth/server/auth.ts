import "server-only";
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { allowlistEmails, getAuthEnv } from "../../../lib/env";
import { logAuthEvent } from "./anonymous-logger";

/**
 * Auth.js (next-auth v5) configuration (spec 015).
 *
 * Stateless JWT sessions only (no database), `authjs.session-token` cookie
 * (httpOnly, SameSite=Lax, Secure in prod after redaction, 24h TTL). Providers
 * are registered **lazily from env**: when no Google/GitHub credentials are
 * configured the provider is omitted and the login screen disables its button
 * (the anonymous demo path stays fully functional with zero `AUTH_*`).
 *
 * Privacy: the `session` callback returns **only** `authenticated` + provider
 * to the client. Email, name, photo, subject, and OAuth tokens are never
 * exposed, logged, or persisted.
 */
const env = getAuthEnv();

const trustHost = process.env.AUTH_TRUST_HOST === "true" || process.env.VERCEL === "1";

import type { NextRequest } from "next/server";

export type AuthHandlers = {
  GET: (req: NextRequest) => Promise<Response>;
  POST: (req: NextRequest) => Promise<Response>;
};
export type Auth = () => Promise<{ authenticated?: boolean; provider?: string } | null>;

/**
 * Auth.js requires a session-encryption secret at runtime. When this instance
 * has **no** `AUTH_SECRET` (a demo-only deploy with zero `AUTH_*`), mount a
 * safe stub instead of `NextAuth()` so the `/` login screen and `/api/auth/*`
 * route stay functional (no session, all sign-ins rejected) without blowing up
 * at module load. Whenever `AUTH_SECRET` is present we build the real handlers.
 */
let handlers: AuthHandlers;
let auth: Auth;

if (!env.AUTH_SECRET) {
  const unauthorized = async (): Promise<Response> => new Response("Unauthorized", { status: 401 });
  handlers = { GET: unauthorized, POST: unauthorized };
  auth = async () => null;
} else {
  const authInstance = NextAuth({
    session: { strategy: "jwt", maxAge: 24 * 60 * 60 },
    trustHost,
    secret: env.AUTH_SECRET,
    providers: [
      ...(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET
        ? [
            Google({
              clientId: env.AUTH_GOOGLE_ID,
              clientSecret: env.AUTH_GOOGLE_SECRET,
            }),
          ]
        : []),
      ...(env.AUTH_GITHUB_ID && env.AUTH_GITHUB_SECRET
        ? [
            GitHub({
              clientId: env.AUTH_GITHUB_ID,
              clientSecret: env.AUTH_GITHUB_SECRET,
            }),
          ]
        : []),
    ],
    callbacks: {
      /**
       * Access control (FR-016). When `AUTH_ALLOWLIST_EMAILS` is set, only those
       * emails may create a session; anything else is rejected. The email is
       * compared in-memory and never logged, stored, or sent to the client.
       */
      async signIn({ user, account }) {
        const allow = allowlistEmails(env);
        if (allow.size > 0 && (!user.email || !allow.has(user.email.toLowerCase()))) {
          logAuthEvent("signin_denied", { provider: account?.provider });
          return false; // Auth.js answers AccessDenied; client shows a localized error
        }
        logAuthEvent("signin_success", { provider: account?.provider });
        return true;
      },
      /** Stamp the provider claim onto the JWT (non-identifying). */
      async jwt({ token, account }) {
        if (account?.provider) token.provider = account.provider;
        return token;
      },
      /** Expose only auth state + provider — never identity fields. */
      async session({ session, token }) {
        return { ...session, authenticated: true, provider: token.provider };
      },
    },
  });
  ({ handlers, auth } = authInstance);
}

export { handlers, auth };
