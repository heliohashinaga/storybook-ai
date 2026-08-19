import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "../features/auth/server/session";
import { getAuthEnv } from "../lib/env";
import { LoginScreenView } from "../features/auth/components/login-screen-view";

/**
 * `/` — login screen (spec 015). Renamed from the old anonymous redirect to
 * `/form`: the root is now the auth gate. An authenticated visitor is sent
 * straight to the playground; anonymous visitors get the OAuth buttons (one per
 * configured provider) plus the always-available Demo entry point. Demo-only
 * deploys (no `AUTH_SECRET`) skip `auth()` entirely and render with all buttons
 * disabled.
 */
export default async function HomePage() {
  const env = getAuthEnv();

  if (env.AUTH_SECRET) {
    const session = await auth();
    if (session?.authenticated) redirect("/form");
  }

  const credentials = {
    google: Boolean(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET),
    github: Boolean(env.AUTH_GITHUB_ID && env.AUTH_GITHUB_SECRET),
  };

  // Client-side `useSearchParams()` in the login view requires a Suspense
  // boundary during static prerendering of `/`.
  return (
    <Suspense>
      <LoginScreenView credentials={credentials} />
    </Suspense>
  );
}
