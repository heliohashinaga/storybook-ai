import type { NarrateRequest } from "../tts.contract";

/**
 * Deterministic fake TTS fixtures for unit/contract tests (spec 004, T007).
 *
 * These are test fixtures only — they never call a live TTS service. They let
 * the provider/route/hook tests verify happy-path audio synthesis, typed error
 * mapping, and the anonymous `/api/narrate` payload shape without any network
 * or provider credentials.
 */

/** Small, valid-looking MP3 byte sequence (predicted by headers). */
const MP3_BYTES = new TextEncoder().encode("ID3\x03\x00\x00\x00\x00\x00\x00fake-mp3-tone");

/** Format marker on the synthesised Blob (used by naturalness proxy T017). */
export const FAKE_TTS_FORMAT = "audio/mpeg";

/** How a successful `synthesize()` is shaped internally. */
export interface FakeTtsResult {
  format: typeof FAKE_TTS_FORMAT;
  audio: Uint8Array;
}

/** Failure kinds the fake can be configured to throw. */
export type FakeTtsFailure =
  { kind: "unavailable" } | { kind: "timeout" } | { kind: "invalid" } | { kind: "over_limit" };

/** Builds a deterministic MP3 Blob for playback via `<audio>`. */
export function fakeMp3Blob(): Blob {
  return new Blob([MP3_BYTES], { type: FAKE_TTS_FORMAT });
}

/** Deterministic `synthesize` result. */
export function fakeSynthesize(_sceneText: string): FakeTtsResult {
  return { format: FAKE_TTS_FORMAT, audio: MP3_BYTES };
}

/** A request that always satisfies the NarrateRequest contract. */
export function fakeNarrateRequest(overrides: Partial<NarrateRequest> = {}): NarrateRequest {
  return { sceneText: "Era uma vez uma estrelinha no céu.", locale: "pt-BR", ...overrides };
}
