import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { GATE_COOKIE_NAME } from "../gate-cookie";
import { verifyGateToken } from "./gate";

/**
 * True when the current request carries a valid gatekeeper session (ADR 0015).
 *
 * The playground gate is a shared-password JWT (`{ gate: true }`, HS256) in
 * the httpOnly `__Host-gatekeeper` cookie — no identity, no user id. A
 * missing, forged, or expired token (or an unconfigured gatekeeper on a
 * demo-only deploy) resolves to anonymous: never throws, never authenticates.
 */
export async function isAuthenticated(): Promise<boolean> {
  const store = await cookies();
  const token = store.get(GATE_COOKIE_NAME)?.value;
  if (!token) return false;
  return verifyGateToken(token);
}

/**
 * Guard for the playground (`/form`, `/reader`). Redirects to the porteiro
 * (`/`) when there is no valid gatekeeper session — used server-side so deep
 * links and hard reloads can never reach the real-LLM screens anonymously.
 */
export async function requireSession(): Promise<void> {
  const authed = await isAuthenticated();
  if (!authed) redirect("/");
}
