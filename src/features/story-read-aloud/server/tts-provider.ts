import "server-only";

/**
 * Server-only boundary for AI narration (spec 004 US1-3).
 *
 * Mirrors the story-generation provider seam: the UI, route, and runtime only
 * interact with a `TtsProvider`, never with a raw provider adapter or SDK.
 * The provider turns an anonymous scene's text into transient audio bytes
 * (e.g. MP3) that the client plays via a Blob. Raw provider output never
 * crosses this boundary — only typed results or typed `TtsProviderError`s.
 *
 * Privacy: the provider receives **only** `text` and `locale` (never an
 * identifier, exact age, or any other field), respects the anonymous contract,
 * and the audio is transient (zero persistence).
 */

/**
 * Provided audio transmission MIME type. MP3 is the canonical format: the
 * OpenRouter adapter requests `response_format: "mp3"` and the fixed/test
 * provider emits MP3 bytes, so this is always `audio/mpeg`.
 */
export type TtsAudioFormat = "audio/mpeg";

export interface TtsSynthesisOptions {
  /** Active story locale (e.g. "pt-BR" or "en"), used to pick a voice. */
  locale: "pt-BR" | "en";
}

export interface SynthesizedAudio {
  /** MIME type of the returned audio (always `audio/mpeg`, MP3). */
  format: TtsAudioFormat;
  /** Raw audio bytes (UTF-8 safe buffer), played as a transient Blob. */
  audio: Uint8Array;
}

/** Stable provider failure kinds (mirrors `ProviderError`). */
export type TtsProviderErrorKind = "unavailable" | "timeout" | "invalid" | "over_limit";

export interface TtsProviderErrorInit {
  kind: TtsProviderErrorKind;
  message: string;
}

/** Typed, transport-agnostic provider error. */
export class TtsProviderError extends Error {
  readonly kind: TtsProviderErrorKind;

  constructor(init: TtsProviderErrorInit) {
    super(init.message);
    this.name = "TtsProviderError";
    this.kind = init.kind;
  }
}

export interface TtsProvider {
  /**
   * Synthesizes speech for `text` as transient MP3 bytes.
   * Throws a typed `TtsProviderError` on failure — never returns partial audio.
   */
  synthesize(text: string, opts: TtsSynthesisOptions): Promise<SynthesizedAudio>;
}
