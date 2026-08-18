import "server-only";

/**
 * Auth lifecycle events that are safe to log.
 */
export type AuthLogEvent = "signin_success" | "signin_denied" | "signin_error" | "signout";

export interface AuthLogFields {
  /** OAuth provider (`google` | `github`) — never an email/name/token. */
  provider?: string;
}

/**
 * Anonymous auth logging (FR-014 / spec 015). Emits only non-identifying
 * events to stdout: the OAuth provider and the outcome. It **never** logs an
 * email, name, subject, token, IP, or cookie — the privacy invariant holds end
 * to end. Purpose: operator visibility into login volume/failures without
 * weakening the anonymous-by-design contract.
 */
export function logAuthEvent(event: AuthLogEvent, fields: AuthLogFields = {}): void {
  console.info(JSON.stringify({ ns: "auth", event, ...fields }));
}
