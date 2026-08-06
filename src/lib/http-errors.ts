/**
 * Typed, sanitized HTTP error contract for the generation route.
 * Mirrors `components/schemas/GenerationError` in
 * `specs/001-personalized-story-generation/contracts/story-generation.openapi.yaml`:
 * an error carries an HTTP status, a stable machine `code`, a localized
 * `messageKey` (never a raw provider message), and a retry hint.
 */

export const errorCodes = [
  "invalid_input",
  "unsupported_locale",
  "unsafe_unrecoverable",
  "rate_limited",
  "generation_unavailable",
  "generation_timeout",
] as const;

export type HttpErrorCode = (typeof errorCodes)[number];

export interface HttpError {
  /** HTTP status returned to the client. */
  status: number;
  /** Stable machine-readable code from the OpenAPI contract. */
  code: HttpErrorCode;
  /** Localized UI message identifier; never a raw provider error. */
  messageKey: string;
  /** Whether the client may safely retry. */
  retryable: boolean;
}

export const invalidInput: HttpError = {
  status: 400,
  code: "invalid_input",
  messageKey: "story.error.invalidInput",
  retryable: false,
};

export const unsupportedLocale: HttpError = {
  status: 422,
  code: "unsupported_locale",
  messageKey: "story.error.unsupportedLocale",
  retryable: false,
};

export const unsafeUnrecoverable: HttpError = {
  status: 422,
  code: "unsafe_unrecoverable",
  messageKey: "story.error.safeAlternativeUnavailable",
  retryable: true,
};

export const rateLimited: HttpError = {
  status: 429,
  code: "rate_limited",
  messageKey: "story.error.tryAgainLater",
  retryable: true,
};

export const generationUnavailable: HttpError = {
  status: 502,
  code: "generation_unavailable",
  messageKey: "story.error.generationUnavailable",
  retryable: true,
};

export const generationTimeout: HttpError = {
  status: 504,
  code: "generation_timeout",
  messageKey: "story.error.generationTimeout",
  retryable: true,
};

/**
 * Type guard for the sanitized error shape. Any unknown payload that does not
 * match the contract is treated as not-an-HttpError and never surfaced as a
 * provider message.
 */
export function isHttpError(value: unknown): value is HttpError {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.status === "number" &&
    typeof candidate.retryable === "boolean" &&
    typeof candidate.messageKey === "string" &&
    (errorCodes as readonly string[]).includes(String(candidate.code))
  );
}

/**
 * Renders the wire-safe JSON body for a route error. Deliberately omits any
 * internal detail; only the stable code, localized message key, and retry hint
 * cross the network.
 */
export function toErrorJson(error: HttpError): {
  code: HttpErrorCode;
  messageKey: string;
  retryable: boolean;
} {
  return { code: error.code, messageKey: error.messageKey, retryable: error.retryable };
}
