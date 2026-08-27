"use client";

import dynamic from "next/dynamic";
import type { ClerkLocalization } from "./clerk-localization";
import type { ReactNode } from "react";

/**
 * Clerk's `ClerkProvider` pulls in the ~400 KiB clerk-js runtime. It is
 * dynamically imported (client-only, `ssr: false`) so clerk-js stays OUT of the
 * initial `/` bundle and the 250 KiB initial-JS budget is respected (AGENTS.md:
 * heavy libs are lazy-loaded, never in the initial bundle). The provider mounts
 * only when the publishable key is present; on a demo-only deploy it renders
 * children with no provider at all, so `/demo` never receives a Clerk cookie.
 *
 * `localization` is forwarded to `ClerkProvider` so the auth UI matches the
 * active app locale (Clerk's `<SignIn>`/`<SignUp>` inherit it).
 *
 * Mounted in `(playground)/layout.tsx` and around the `/` login screen only —
 * **not** in the root layout (which also serves the anonymous `/demo`).
 */
const ClerkProvider = dynamic(() => import("@clerk/nextjs").then((m) => m.ClerkProvider), {
  ssr: false,
});

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
