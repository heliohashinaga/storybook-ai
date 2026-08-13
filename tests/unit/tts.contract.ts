/**
 * Test-contract reference types for `/api/narrate` (spec 004, US1-US3).
 *
 * This is a **test fixture only** — it exists so contract and provider tests
 * can pin the wire/domain shape to `contracts/tts.openapi.yaml` without
 * coupling to the production Zod route schema. It is intentionally NOT
 * production code and imports nothing from `src/`.
 *
 * The real server-side validation lives as a Zod schema in the narrate route
 * (`src/app/api/narrate/route.ts`); the client hook parses the same minimal
 * fields. Update the YAML + this fixture together if the contract changes.
 */

/** Active story languages accepted by `/api/narrate`. */
export type NarrateLocale = "pt-BR" | "en";

/**
 * Body of `POST /api/narrate`. Anonymous by design — only the active scene's
 * text and the story locale; never an identifier, exact age, or theme.
 */
export interface NarrateRequest {
  /** The active scene's body text (1..=NON_EMPTY_MAX chars). */
  sceneText: string;
  /** Story locale, drives the TTS voice selection. */
  locale: NarrateLocale;
}

/** Upper bound for `sceneText` (mirrors the Zod schema constant). */
export const NON_EMPTY_MAX = 2000;
/** Lower bound — `sceneText` cannot be empty/whitespace-only. */
export const NON_EMPTY_MIN = 1;

/**
 * Body of a 200 `POST /api/narrate` response: transient audio bytes. The Blob
 * is never persisted server-side and its object URL is revoked client-side
 * after playback.
 */
export interface NarrateResponse {
  /** MIME type of the audio (always `audio/mpeg` for MP3). */
  format: "audio/mpeg";
  /** Raw MP3 bytes. */
  audio: Uint8Array;
}

/**
 * Standard error payload returned by `/api/narrate`. Uses a stable machine
 * `code` (never a raw provider message) and a localized `messageKey`.
 */
export interface NarrateError {
  /** Machine-readable error code. */
  code:
    | "invalid_input"
    | "unsupported_locale"
    | "narration_unavailable"
    | "narration_timeout"
    | "rate_limited";
  /** Localized message key (resolved via next-intl catalogs). */
  messageKey: string;
}
