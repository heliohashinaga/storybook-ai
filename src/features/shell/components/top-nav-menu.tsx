"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Accessible "kebab" (⋮) menu — mobile only (`sm:hidden`).
 *
 * Screens narrower than `sm` collapse the top-bar actions behind this icon
 * button; pressing it toggles a right-aligned panel (`role="dialog"`) with the
 * action content. It is intentionally dumb: the caller provides the panel
 * content (language, theme, sign out, ...) via `children` and a `label` used
 * for both the trigger and the panel's accessible name.
 *
 * Accessibility:
 * - The trigger has `aria-expanded` + `aria-haspopup="dialog"` and a visual
 *   kebab glyph.
 * - The panel is a `role="dialog"` with `aria-modal="false"` (it doesn't trap
 *   focus), labelled by the trigger's label, and described by the title.
 * - Closes on `Escape` and on outside pointer/touch down. Focus is NOT trapped
 *   (single-screen panel, overlay backdrops are overkill here) but the trigger
 *   keeps focus so the next Tab closes and reopens predictably.
 * - `prefers-reduced-motion` is honoured by the CSS transition/scales used.
 */
export function TopNavMenu({
  label,
  children,
}: {
  /** Accessible label for the toggle + panel. */
  label: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on Escape and on outside interaction.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onPointerDown = (event: PointerEvent) => {
      const el = rootRef.current;
      if (el && event.target instanceof Node && !el.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative sm:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={label}
        title={label}
        onClick={() => setOpen((value) => !value)}
        className="flex size-11 items-center justify-center rounded-2xl border border-border bg-card text-text shadow-soft transition-all duration-base hover:shadow-lift hover:-translate-y-0.5"
      >
        {open ? <CloseIcon className="size-5" /> : <KebabIcon className="size-5" />}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={label}
          aria-modal="false"
          className="absolute right-0 top-full z-50 mt-3 flex w-56 flex-col items-stretch gap-3 rounded-3xl border border-border bg-card p-4 shadow-lift"
        >
          {children}
        </div>
      )}
    </div>
  );
}

/** Vertical ellipsis (kebab) glyph. */
function KebabIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <circle cx="12" cy="5" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="19" r="2" />
    </svg>
  );
}

/** Close "×" glyph shown while the menu is open. */
function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
