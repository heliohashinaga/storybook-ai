import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { LoginScreenView } from "../features/auth/components/login-screen-view";

// The login gate is rendered on demand (never statically prerendered) so the
// Clerk provider is mounted at request time and the anonymous demo path never
// touches a session cookie (spec 018 / ADR 0013).
export const dynamic = "force-dynamic";

/**
 * `/` — login screen (spec 018). Server redirects an authenticated visitor
 * straight to the playground; anonymous visitors get the Clerk `<SignIn>` (Google
 * + e-mail/senha) plus the always-available Demo entry point (anonymous, zero
 * cookies). Demo-only deploys (no `CLERK_SECRET_KEY`) skip `auth()` gracefully
 * and render the demo-only panel with no Clerk provider/cookie. `LoginScreenView`
 * mounts its own `ClerkProviderGate` internally (it needs `useLocale` for
 * localization), so this page must not wrap it again.
 */
export default async function HomePage() {
  let userId: string | null = null;
  try {
    const session = await auth();
    userId = session.userId;
  } catch {
    userId = null;
  }
  if (userId) redirect("/form");

  return (
    <Suspense>
      <LoginScreenView />
    </Suspense>
  );
}
