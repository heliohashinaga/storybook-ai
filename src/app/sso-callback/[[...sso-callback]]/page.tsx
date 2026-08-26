import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { ClerkProviderGate } from "../../../features/auth/client/clerk-provider";

// Clerk OAuth/SSO callback (spec 018 / ADR 0013).
//
// After Google (or any SSO provider) authenticates, Clerk redirects here.
// `AuthenticateWithRedirectCallback` completes the handshake client-side and establishes the
// session, then redirects to `CLERK_AFTER_SIGN_IN_URL` (`/form`). With
// Invite-only enabled in the Clerk dashboard, an uninvited account is rejected
// by Clerk during this callback and bounced back to the sign-in screen
// (`CLERK_SIGN_IN_URL` = `/`) with a generic, non-enumerating "access
// restricted" message — no custom redirect code is needed.
//
// Wrapped in `ClerkProviderGate` so the provider is present (only in configured
// mode); the anonymous demo path never reaches this route.
export const dynamic = "force-dynamic";

export default function SSOCallbackRoute() {
  return (
    <ClerkProviderGate>
      <AuthenticateWithRedirectCallback />
    </ClerkProviderGate>
  );
}
