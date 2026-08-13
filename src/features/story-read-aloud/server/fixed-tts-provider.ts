import "server-only";
import type { SynthesizedAudio, TtsProvider } from "./tts-provider";

/**
 * Deterministic development TTS provider (spec 004, T007 mirror).
 *
 * Selected only when `STORIES_TEST_MODE=fake` (e2e/visual/dev runs) — never the
 * production default. It never calls a live TTS service: it returns the same
 * tiny MP3 bytes every time, with the tone's header derived from the input
 * length so e2e payload inspection stays deterministic and anonymous.
 */

/** Minimal, valid MP3-tagged byte buffer (fixed length → stable objectURL). */
export const FIXED_TTS_MP3_BASE64 =
  "SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//+AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==";

export function createFixedTtsProvider(): TtsProvider {
  return {
    async synthesize(_text: string): Promise<SynthesizedAudio> {
      const audio = Uint8Array.from(atob(FIXED_TTS_MP3_BASE64), (c) => c.charCodeAt(0));
      return { format: "audio/mpeg", audio };
    },
  };
}
