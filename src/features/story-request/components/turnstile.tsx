"use client";

import { useEffect, useRef } from "react";
import { isTurnstileSiteKeyConfigured, TURNSTILE_SCRIPT_SRC } from "./turnstile-config";

/**
 * Cloudflare Turnstile widget (feature 019 — demo anti-bot).
 *
 * Renders the **non-interactive** challenge invisibly on the story-request form
 * and reports the resulting single-use token (or an error) to the parent. The
 * parent blocks submission until a token is available and sends it via the
 * `cf-turnstile-token` header.
 *
 * Privacy: non-interactive mode does not set cookies nor collect identity; the
 * token is anonymous, short-lived and single-use. No-op when the site key is not
 * configured (feature off — the form behaves as today).
 */

export interface TurnstileApi {
  render(
    container: HTMLElement | string,
    opts: {
      sitekey: string;
      callback?: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
      theme?: "light" | "dark" | "auto";
    }
  ): string;
  reset(container: HTMLElement | string): void;
  remove(container: HTMLElement | string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

interface TurnstileProps {
  /** Called with the fresh single-use token whenever the challenge resolves. */
  onTokenChange: (token: string) => void;
  /** Called when the widget fails to load/render/resolve. */
  onError: (errored: boolean) => void;
  /** Incrementing counter that forces a widget reset (new token after a failed submit). */
  resetKey: number;
}

export function Turnstile({ onTokenChange, onError, resetKey }: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Render the widget once the site key + script are ready.
  useEffect(() => {
    if (!isTurnstileSiteKeyConfigured()) return;
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;

    function mount() {
      if (disposed || !window.turnstile || !container) return;
      window.turnstile.render(container, {
        sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY as string,
        callback: (token) => {
          if (!disposed) onTokenChange(token);
        },
        "expired-callback": () => {
          if (!disposed) onTokenChange("");
        },
        "error-callback": () => {
          if (!disposed) onError(true);
        },
        theme: "auto",
      });
    }

    if (window.turnstile) {
      mount();
      return undefined;
    }

    let script = document.querySelector<HTMLScriptElement>(`script[src="${TURNSTILE_SCRIPT_SRC}"]`);
    if (!script) {
      script = document.createElement("script");
      script.src = TURNSTILE_SCRIPT_SRC;
      script.async = true;
      script.setAttribute("data-now", "");
      script.onload = () => {
        if (!disposed) mount();
      };
      script.onerror = () => {
        if (!disposed) onError(true);
      };
      document.head.appendChild(script);
    } else {
      // Script already present but not yet loaded → wait for it.
      script.onload = () => {
        if (!disposed) mount();
      };
      if (window.turnstile) mount();
    }

    return () => {
      disposed = true;
      if (container && window.turnstile) {
        try {
          window.turnstile.remove(container);
        } catch {
          /* ignore */
        }
      }
    };
  }, [onTokenChange, onError]);

  // Force a reset when the parent asks (e.g. after a blocked submit).
  useEffect(() => {
    if (!isTurnstileSiteKeyConfigured() || !containerRef.current || !window.turnstile) return;
    try {
      window.turnstile.reset(containerRef.current);
    } catch {
      /* ignore */
    }
  }, [resetKey]);

  if (!isTurnstileSiteKeyConfigured()) return null;
  return <div ref={containerRef} data-testid="turnstile-widget" aria-hidden="true" />;
}
