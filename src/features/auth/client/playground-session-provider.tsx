"use client";

import { SessionProvider } from "next-auth/react";

/**
 * Auth.js `SessionProvider`, scoped **only** to the playground route group
 * (`/form`, `/reader`). It is deliberately NOT mounted for `/` or `/demo`, so
 * the anonymous demo path stays 100% cookie/identity-free (spec 015). The
 * `<LoginScreenView>` still uses `signIn`/`signOut` from `next-auth/react`,
 * which do not require a provider.
 */
export function PlaygroundSessionProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
