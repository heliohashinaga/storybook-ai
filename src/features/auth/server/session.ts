import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

export { auth };

/**
 * True when the current request carries a valid authenticated Clerk session
 * (spec 018). On a demo-only deploy (no `CLERK_SECRET_KEY`/`publishable key`),
 * `auth()` throws — caught and treated as anonymous so the app boots without
 * Clerk and the demo path stays cookie/anonymity-free.
 */
export async function isAuthenticated(): Promise<boolean> {
  try {
    const { userId } = await auth();
    return Boolean(userId);
  } catch {
    return false;
  }
}

/**
 * Guard for the playground (`/form`, `/reader`). Redirects to the login screen
 * (`/`) when there is no valid session — used server-side so deep links and
 * hard reloads can never reach the real-LLM screens anonymously.
 */
export async function requireSession(): Promise<void> {
  const authed = await isAuthenticated();
  if (!authed) redirect("/");
}
