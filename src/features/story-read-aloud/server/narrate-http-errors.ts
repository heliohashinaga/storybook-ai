import "server-only";

/**
 * Narration-specific wire error contract for `/api/narrate` (spec 004).
 *
 * Kept separate from the shared generation `http-errors` module so the
 * narration error union never leaks into (or widens) the generation pipeline's
 * exhaustive `statusByCode`/type-guards. The codes here parallel
 * `contracts/tts.openapi.yaml` and always use a stable machine `code` plus a
 * localized `messageKey` — never a raw provider message.
 */

export const narrateErrorCodes = [
  "invalid_input",
  "unsupported_locale",
  "narration_unavailable",
  "narration_timeout",
] as const;

export type NarrateErrorCode = (typeof narrateErrorCodes)[number];

export interface NarrateHttpError {
  /** HTTP status returned to the client. */
  status: number;
  /** Stable machine-readable code from the narration contract. */
  code: NarrateErrorCode;
  /** Localized UI message key (never a raw provider error). */
  messageKey: string;
  /** Whether the client may safely retry. */
  retryable: boolean;
}

export const narrateInvalidInput: NarrateHttpError = {
  status: 400,
  code: "invalid_input",
  messageKey: "story.narration.error",
  retryable: false,
};

export const narrateUnsupportedLocale: NarrateHttpError = {
  status: 422,
  code: "unsupported_locale",
  messageKey: "story.error.unsupportedLocale",
  retryable: false,
};

export const narrateUnavailable: NarrateHttpError = {
  status: 502,
  code: "narration_unavailable",
  messageKey: "story.narration.unavailable",
  retryable: true,
};

export const narrateTimeout: NarrateHttpError = {
  status: 504,
  code: "narration_timeout",
  messageKey: "story.narration.error",
  retryable: true,
};

/** Marshals a narration error to its wire-safe JSON body. */
export function toNarrateErrorJson(error: NarrateHttpError): {
  code: NarrateErrorCode;
  messageKey: string;
  retryable: boolean;
} {
  return { code: error.code, messageKey: error.messageKey, retryable: error.retryable };
}
