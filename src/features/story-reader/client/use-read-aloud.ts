"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Locale → BCP-47 tag used to pick a matching speech synthesis voice.
 * Only pt-BR and en are shipped (see spec 003, CLARIFICATION 2026-08-12).
 */
const LOCALE_TO_VOICE_TAG: Record<string, string> = {
  "pt-BR": "pt-BR",
  en: "en",
};

/**
 * Returns a browser speech-synthesis voice that best matches `locale`, or
 * `null` when no suitable voice is available (e.g. unsupported browser).
 */
function pickVoice(locale: string, voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const langTag = LOCALE_TO_VOICE_TAG[locale];
  if (!langTag) {
    // Unknown locale: fall back to any voice whose primary subtag matches.
    const primary = locale.split("-")[0]!;
    return voices.find((v) => v.lang.toLowerCase().startsWith(primary.toLowerCase())) ?? null;
  }
  const matchLang = (lang: string) => lang.toLowerCase().replace(/_/g, "-");
  return (
    voices.find((v) => v.lang.includes(matchLang(langTag))) ??
    voices.find((v) => v.lang.startsWith(langTag.split("-")[0]!.toLowerCase())) ??
    null
  );
}

export interface UseReadAloudOptions {
  /** The text to read aloud (current scene body/subtitle). */
  text: string;
  /** Active locale (e.g. "pt-BR" or "en") used to choose the voice. */
  locale: string;
  /** Called when speech starts playing, so parent state can follow. */
  onStart?: () => void;
  /** Called when speech ends or is cancelled, so parent state can follow. */
  onEnd?: () => void;
}

export interface UseReadAloudResult {
  /** Whether speech is currently being spoken (single start/stop control). */
  speaking: boolean;
  /** False when the browser has no speech-synthesis support (hide the control). */
  supported: boolean;
  /** Starts reading on first call; stops speech if already speaking. */
  toggle: () => void;
  /** Cancels any in-flight speech (used on scene change). */
  stop: () => void;
}

/**
 * Progressive, local-only text-to-speech for a single scene (spec 003, US2).
 *
 * Uses the browser's native `speechSynthesis` — no network transmission, so it
 * preserves anonymity. Exposes a **single start/stop** control (`toggle`): the
 * internal `paused` state of Web Speech is never surfaced as a separate button.
 * Callers MUST invoke `stop()` (or unmount) before navigating to another scene
 * so two scenes never overlap.
 */
export function useReadAloud({
  text,
  locale,
  onStart,
  onEnd,
}: UseReadAloudOptions): UseReadAloudResult {
  const onStartRef = useRef(onStart);
  const onEndRef = useRef(onEnd);
  useEffect(() => {
    onStartRef.current = onStart;
  }, [onStart]);
  useEffect(() => {
    onEndRef.current = onEnd;
  }, [onEnd]);
  const supported = useMemo(
    () =>
      typeof window !== "undefined" &&
      typeof window.speechSynthesis === "object" &&
      window.speechSynthesis !== null,
    []
  );
  const [speaking, setSpeaking] = useState(false);
  const speakingRef = useRef(false);

  const setSpeakingBoth = useCallback((next: boolean) => {
    speakingRef.current = next;
    setSpeaking(next);
    if (next) onStartRef.current?.();
    else onEndRef.current?.();
  }, []);

  const stop = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setSpeakingBoth(false);
  }, [supported, setSpeakingBoth]);

  const toggle = useCallback(() => {
    if (!supported) return;
    if (speakingRef.current) {
      stop();
      return;
    }
    if (!text) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = LOCALE_TO_VOICE_TAG[locale] ?? locale;

    const available = window.speechSynthesis.getVoices();
    const voice = pickVoice(locale, available);
    if (voice) utterance.voice = voice;
    utterance.volume = 1;
    utterance.rate = 1;
    utterance.pitch = 1;

    utterance.onend = () => setSpeakingBoth(false);
    utterance.onerror = () => setSpeakingBoth(false);

    setSpeakingBoth(true);
    window.speechSynthesis.speak(utterance);
  }, [supported, stop, text, locale, setSpeakingBoth]);

  // Load voices asynchronously on first access (voices load lazily in some browsers).
  useEffect(() => {
    if (!supported) return;
    const load = () => window.speechSynthesis.getVoices();
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load, { once: true });
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", load);
      window.speechSynthesis.cancel();
    };
  }, [supported]);

  // On unmount / supported-flag change, cancel any in-flight narration so a
  // scene change never leaves a dangling utterance (spec 003, US2).
  useEffect(() => {
    if (!supported) return;
    return () => window.speechSynthesis.cancel();
  }, [supported]);

  return { speaking, supported, toggle, stop };
}
