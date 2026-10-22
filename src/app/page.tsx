import { Suspense } from "react";
import { redirect } from "next/navigation";
import { isAuthenticated } from "../features/auth/server/session";
import { LoginScreenView } from "../features/auth/components/login-screen-view";

// The porteiro gate renders on demand (never statically prerendered) so the
// session check runs at request time and the anonymous demo path never touches
// a session cookie (ADR 0015).
export const dynamic = "force-dynamic";

/** True when the gatekeeper is configured (playground enabled). */
function isGateConfigured(): boolean {
  return Boolean(process.env.GATEKEEPER_SECRET && process.env.PLAYGROUND_PASSWORD_HASH);
}

/**
 * `/` — porteiro do playground (ADR 0015). The server redirects an
 * authenticated visitor straight to the playground; anonymous visitors get the
 * shared-password screen plus the always-available Demo entry point
 * (anonymous, zero cookies). Demo-only deploys (no gatekeeper vars) render
 * the demo-only panel with no session and no cookie.
 */
export default async function HomePage() {
  if (await isAuthenticated()) redirect("/form");

  return (
    <Suspense>
      <LoginScreenView gateConfigured={isGateConfigured()} />
    </Suspense>
  );
}
