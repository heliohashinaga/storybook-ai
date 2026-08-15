"use client";

/**
 * Tiny app-wide signal for "go home / back to the story form".
 *
 * The top-nav brand mark lives in the shell (`TopNav`), while the story-form /
 * reader state lives in the feature (`StoryRequestApp`), which are siblings in
 * the same route tree. `router.push("/")` alone is a client-side no-op when the
 * app is already on `/`: Next.js keeps the same mounted tree, so the in-memory
 * story stays shown and the reader never returns to the form.
 *
 * This module lets any UI request "home" and have the feature reset to the
 * form (same behavior as the reader's "new story" button). It is a plain module
 * to stay tiny and testable; listeners subscribe in an effect and return an
 * unsubscribe function.
 */

export type HomeRequestListener = () => void;

const listeners = new Set<HomeRequestListener>();

/** Subscribe to "home requested" events. Returns an unsubscribe function. */
export function onHomeRequested(listener: HomeRequestListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Emit a "home requested" event to all active listeners. */
export function requestHome(): void {
  listeners.forEach((listener) => listener());
}
