import "next-auth";
import "next-auth/jwt";

/**
 * Minimal session/JWT shape (spec 015). The session cookie is a stateless JWT;
 * we expose **only** `authenticated` + `provider` to the client. No email,
 * name, photo, subject, or OAuth token is ever persisted, logged, or sent to
 * the browser — those fields stay optional and are left absent.
 */
declare module "next-auth" {
  interface Session {
    authenticated?: boolean;
    provider?: string;
    user?: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    provider?: string;
  }
}
