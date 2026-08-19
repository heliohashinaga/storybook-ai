"use client";

import { useEffect } from "react";

/**
 * Resets the window scroll to the top when a page mounts. Next.js keeps the
 * scroll position across `router.replace` navigations between routes that
 * render the same component (e.g. the tall story form -> the reader in the
 * demo/playground), and its scroll restoration can run *after* a child mount
 * effect. Running once on mount, then again on the `load` event (and via a
 * rAF), covers that async timing so the destination page always opens at the
 * top. Purely presentational — renders nothing.
 */
export function ScrollToTop() {
  useEffect(() => {
    const scrollTop = () => window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    requestAnimationFrame(scrollTop);
    window.addEventListener("load", scrollTop);
    return () => window.removeEventListener("load", scrollTop);
  }, []);
  return null;
}
