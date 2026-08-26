"use client";

import { ClerkProvider } from "@clerk/nextjs";
import type { ClerkLocalization } from "./clerk-localization";
import type { ReactNode } from "react";

/**
 * Conditional ClerkProvider (spec 018 / ADR 0013).
 *
 * Mounts Clerk **only** when the publishable key is present. On a demo-only
 * deploy (no `CLERK_SECRET_KEY`/`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`) it renders
 * children without a provider, so the app boots without Clerk and `/demo`
 * never receives a Clerk cookie.
 *
 * `localization` is forwarded to `ClerkProvider` so the auth UI matches the
 * active app locale (Clerk's `<SignIn>`/`<SignUp>` inherit it).
 *
 * Mounted in `(playground)/layout.tsx` and around the `/` login screen only —
 * **not** in the root layout (which also serves the anonymous `/demo`).
 */
export function ClerkProviderGate({
  children,
  localization,
}: {
  children: ReactNode;
  localization?: ClerkLocalization;
}) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!publishableKey) return <>{children}</>;
  return (
    <ClerkProvider publishableKey={publishableKey} localization={localization}>
      {children}
    </ClerkProvider>
  );
}
