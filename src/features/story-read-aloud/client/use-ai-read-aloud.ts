"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useReadAloud, type UseReadAloudOptions } from "../../story-reader/client/use-read-aloud";
import type { NarrationMode, NarrationStatus } from "./tts-state";

/**
 * AI narration hook (spec 004, US1-US3).
 *
 * Extends the progressive `useReadAloud` (Web Speech) pattern: on `toggle()`
 * it requests transient audio for the anonymous scene text from the server's
 * `/api/narrate` endpoint, plays it via a transient `URL.createObjectURL`
 * Blob, and revokes the URL on stop/scene change. Behavior:
 *
 * - `AI_NARRATION_ENABLED=true` (server-controlled): the server synthesizes AI
 *   audio; `mode` is `'ai'`. Provider failure (502/504/422) sets an accessible
 *   `error` state — **never** falling back to Web Speech (US2).
 * - `AI_NARRATION_ENABLED=false`: `/api/narrate` answers 204 and we delegate to
 *   the wrapped `useReadAloud` (browser Web Speech); `mode` is `'system'`.
 *
 * Privacy: only anonymous scene text is sent; the audio Blob is transient and
 * its object URL is revoked when stopped or when the scene changes (US3). The
 * endpoint is called only when the user activates "listen".
 */

export interface UseAiReadAloudOptions extends Omit<UseReadAloudOptions, "text"> {
  /** The anonymous scene text to narrate (current scene body). */
  text: string;
  /** Localized error string shown to the user when AI narration fails. */
  errorLabel?: string;
}

export interface UseAiReadAloudResult {
  /** True while AI audio is playing or a server narration is loading. */
  speaking: boolean;
  /** False only when neither AI (fetch) nor Web Speech can ever work. */
  supported: boolean;
  /** Current narration status for accessible state rendering. */
  status: NarrationStatus;
  /** `ai` for server narration, `system` for Web Speech fallback. */
  mode: NarrationMode;
  /** Localized error message (status === 'error'). */
  errorMessage: string;
  /** Single start/stop control — the only way the user triggers narration. */
  toggle: () => void;
  /** Stops any in-flight AI audio or system speech (used on scene change). */
  stop: () => void;
}

export function useAiReadAloud({
  text,
  locale,
  errorLabel = "",
}: UseAiReadAloudOptions): UseAiReadAloudResult {
  const system = useReadAloud({
    text,
    locale,
    // Surface Web Speech start/stop on the accessible control so the label
    // toggles "Ouvir" → "Parar leitura" and back (US4.2).
    onStart: () => setStatus("speaking"),
    onEnd: () => setStatus((prev) => (prev === "speaking" ? "idle" : prev)),
  });
  const [status, setStatus] = useState<NarrationStatus>("idle");
  const [mode, setMode] = useState<NarrationMode>("ai");
  const [errorMessage, setErrorMessage] = useState("");
  const objectUrlRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const startedRef = useRef(false);

  const stop = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    const audio = audioRef.current;
    if (audio) audio.pause();
    audioRef.current = null;
    system.stop();
    startedRef.current = false;
    setStatus("idle");
  }, [system]);

  const playAiAudio = useCallback(
    async (initiator: Response): Promise<boolean> => {
      if (!initiator.ok) return false;
      const blob = await initiator.blob();
      // Pause system speech so the two voices never overlap.
      system.stop();
      setMode("ai");
      setStatus("speaking");
      startedRef.current = true;
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      const done = () => {
        if (objectUrlRef.current === url) URL.revokeObjectURL(url);
        objectUrlRef.current = null;
        audioRef.current = null;
        startedRef.current = false;
        setStatus("idle");
      };
      audio.onended = done;
      audio.onerror = done;
      const played = audio.play();
      if (played && typeof played.catch === "function") played.catch(done);
      return true;
    },
    [system]
  );

  const toggle = useCallback(() => {
    if (!text) return;

    // A single control: if something is already playing/loading, stop it.
    // `system.speaking` covers the Web Speech fallback (204) path, whose
    // speech `startedRef` is never set — otherwise a second toggle here would
    // leave the state stranded on `busy`.
    if (startedRef.current || status === "busy" || system.speaking) {
      stop();
      return;
    }

    setMode("ai");
    setErrorMessage("");
    setStatus("busy");

    fetch("/api/narrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sceneText: text, locale }),
    })
      .then(async (response) => {
        if (response.status === 204) {
          // AI narration disabled server-side → delegate to Web Speech.
          // onStart/onEnd on `useReadAloud` keep `status` in sync so the
          // control shows "parar leitura" while the system speech plays.
          setMode("system");
          system.toggle();
          return;
        }
        if (!response.ok) throw new Error(String(response.status));
        const played = await playAiAudio(response);
        if (!played) throw new Error("no-audio");
      })
      .catch(() => {
        // Accessible error, never a Web Speech retry (US2).
        setMode("ai");
        setErrorMessage(errorLabel);
        setStatus("error");
      });
  }, [text, locale, status, system, stop, playAiAudio, errorLabel]);

  // On unmount, revoke any transient object URL (zero persistence, US3).
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      if (audioRef.current) audioRef.current.pause();
      audioRef.current = null;
    };
  }, []);

  const speaking = status === "speaking" || status === "busy";
  // The AI path (fetch + <audio>) always exists client-side, so the control is
  // available whenever there is text; `system.supported` only gates the Web
  // Speech fallback (204) path.
  const supported = Boolean(text);

  return { speaking, supported, status, mode, errorMessage, toggle, stop };
}
