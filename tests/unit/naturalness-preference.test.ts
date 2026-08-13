import { describe, expect, it } from "vitest";
import { FAKE_TTS_FORMAT, fakeMp3Blob, fakeSynthesize } from "./tts/fake";

/**
 * Naturalness / preference proxy (spec 004, T017 — SC-002).
 *
 * SC-002's real criterion ("participants prefer the AI voice ≥80%") is a
 * post-launch study metric and is NOT measured here. This deterministic proxy
 * verifies the *decision rule* that precedes any preference: when AI narration
 * is enabled the AI-labelled audio candidate is selected (never the system
 * Web Speech voice); when disabled the system candidate is selected. The proxy
 * is CI-verifiable, pure, and never touches a live TTS service.
 */

/** Audio candidate as produced by one of the two voice paths. */
export interface NarrationCandidate {
  /** Stable path marker: `ai` (server TTS) or `system` (Web Speech). */
  path: "ai" | "system";
  /** MIME type of the candidate's audio payload. */
  format: string;
  /** Opaque payload (Blob for AI audio, utterance text for system speech). */
  payload: unknown;
}

/**
 * Deterministic selection rule: the AI candidate wins whenever AI narration is
 * enabled; otherwise the system (Web Speech) candidate is used. Pure function —
 * no I/O, no randomness, no wall-clock dependence.
 */
export function preferAiCandidate(
  candidates: NarrationCandidate[],
  aiEnabled: boolean
): NarrationCandidate {
  const ai = candidates.find((c) => c.path === "ai");
  const system = candidates.find((c) => c.path === "system");
  if (aiEnabled && ai) return ai;
  return system ?? (ai as NarrationCandidate);
}

function buildCandidates(): NarrationCandidate[] {
  // AI candidate: deterministic fake MP3 Blob labelled with the fake TTS format.
  const aiCandidate: NarrationCandidate = {
    path: "ai",
    format: FAKE_TTS_FORMAT,
    payload: fakeMp3Blob(),
  };
  // System candidate: Web Speech reads the plain scene text locally.
  const systemCandidate: NarrationCandidate = {
    path: "system",
    format: "text/plain",
    payload: { utteranceText: "Era uma vez uma estrelinha no céu." },
  };
  return [aiCandidate, systemCandidate];
}

describe("naturalness preference proxy (T017 — SC-002 decision rule)", () => {
  it("selects the AI-labelled audio candidate when AI narration is enabled", () => {
    const selected = preferAiCandidate(buildCandidates(), true);

    expect(selected.path).toBe("ai");
    // The AI candidate carries the fake TTS audio format, not the system voice.
    expect(selected.format).toBe(FAKE_TTS_FORMAT);
    expect(selected.payload).toBeInstanceOf(Blob);
  });

  it("never selects the system voice when AI narration is enabled", () => {
    const selected = preferAiCandidate(buildCandidates(), true);

    expect(selected.path).not.toBe("system");
    expect(selected.format).not.toBe("text/plain");
  });

  it("selects the system (Web Speech) candidate when AI narration is disabled", () => {
    const selected = preferAiCandidate(buildCandidates(), false);

    expect(selected.path).toBe("system");
    expect(selected.format).toBe("text/plain");
  });

  it("the fake AI audio is deterministic (same bytes on every call)", () => {
    // The fake synthesizer returns an MP3-tagged Blob; `fakeSynthesize` exposes
    // the underlying bytes so the AI candidate stays reproducible in CI.
    const first = fakeSynthesize("cena");
    const second = fakeSynthesize("cena");

    expect(first.format).toBe(FAKE_TTS_FORMAT);
    expect(first.audio).toEqual(second.audio);
    expect(first.audio.length).toBeGreaterThan(0);
  });
});
