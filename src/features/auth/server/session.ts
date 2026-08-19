import "server-only";
import { redirect } from "next/navigation";
import { auth } from "./auth";

export { auth };

/**
 * True when the current request carries a valid authenticated JWT session
 * (spec 015). Anonymous (existing demo/health paths) calls return `false` and
 * never touch identity fields.
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await auth();
  return session?.authenticated === true;
}

/**
 * Guard for the playground (`/form`, `/reader`). Redirects to the login screen
 * (`/`) when there is no valid session — used server-side so deep links and
 * hard reloads can never reach the real-LLM screens anonymously.
 */
export async function requireSession(): Promise<void> {
  const session = await auth();
  if (session?.authenticated !== true) redirect("/");
}
