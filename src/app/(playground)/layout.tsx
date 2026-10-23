import type { ReactNode } from "react";
import { requireSession } from "../../features/auth/server/session";

// Authenticated playground routes are rendered on demand so the gatekeeper
// session is verified at request time; the anonymous demo path never touches
// it (ADR 0015).
export const dynamic = "force-dynamic";

/**
 * Playground route group (`(playground)`): `/form` and `/reader`. The
 * gatekeeper guard runs here and **only** here — the anonymous demo path
 * (`/`, `/demo`) never sees a session cookie. On a demo-only deploy (no
 * gatekeeper vars) every visitor redirects to `/`, so the demo stays
 * cookie/anonymity-free.
 */
export default async function PlaygroundLayout({ children }: { children: ReactNode }) {
  await requireSession();
  return <>{children}</>;
}
