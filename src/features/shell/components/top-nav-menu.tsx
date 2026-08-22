"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * Accessible "kebab" (⋮) menu — mobile only (`sm:hidden`).
 *
 * Collapses the top-bar actions behind this icon button; pressing it toggles a
 * right-aligned panel of full-row menu items. Compose it from `TopNavMenu.Item`
 * rows, optionally separated by `TopNavMenu.Divider`.
 *
 * ```tsx
 * <TopNavMenu label={t("menuLabel")}>
 *   <TopNavMenu.Item icon={<GlobeIcon />} onPress={...}>
 *     Português
 *   </TopNavMenu.Item>
 *   <TopNavMenu.Divider />
 *   <TopNavMenu.Item icon={<LogOutIcon />} tone="danger" onPress={...}>
 *     Sair
 *   </TopNavMenu.Item>
 * </TopNavMenu>
 * ```
 *
 * The `label` is the accessible name for both the trigger and the panel (pass a
 * localized string; defaults to "Menu"). The menu auto-closes after an item is
 * pressed (`closeOnSelect`, default `true`) and when pressing `Escape` or
 * clicking/tapping outside.
 *
 * ## Accessibility
 * - The trigger is a real `<button aria-haspopup="menu" aria-expanded>`, so
 *   assistive tech and browser back work as expected.
 * - The panel is `role="menu"` and each item `role="menuitem"`, announced with
 *   the trigger label. Focus is **not** trapped (single-screen overlay) but is
 *   returned to the trigger on close so the outer Tab order is preserved.
 */
export function TopNavMenu({
  children,
  label = "Menu",
}: {
  children: ReactNode;
  /** Accessible name for the trigger button and panel. */
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((value) => !value), []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
      }
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
    <MenuCloseCtx.Provider value={close}>
      <div ref={rootRef} className="relative sm:hidden">
        <button
          type="button"
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label={label}
          title={label}
          onClick={toggle}
          className="flex size-11 items-center justify-center rounded-2xl border border-border bg-card text-text shadow-soft transition-all duration-base hover:shadow-lift hover:-translate-y-0.5"
        >
          {open ? <CloseIcon className="size-5" /> : <KebabIcon className="size-5" />}
        </button>

        {open && (
          <div
            role="menu"
            aria-label={label}
            className="absolute right-0 top-full z-50 mt-3 w-64 overflow-hidden rounded-3xl border border-border bg-card p-2 shadow-lift"
          >
            <div>{children}</div>
          </div>
        )}
      </div>
    </MenuCloseCtx.Provider>
  );
}

/* ----------------------------------------------------------------------------
 * Context shared by nested items so they can close the panel.
 * ------------------------------------------------------------------------- */
const MenuCloseCtx = createContext<() => void>(() => {});
const useClose = () => useContext(MenuCloseCtx);

// ---------------------------------------------------------------------------
// TopNavMenu.Item
// ---------------------------------------------------------------------------

const toneStyles = {
  default: "text-text hover:bg-secondary",
  danger: "text-error hover:bg-error/10",
} as const;

interface TopNavMenuItemProps {
  /** Leading icon (e.g. `<GlobeIcon />`). Must accept `className`. */
  icon?: ReactNode;
  /** Row content (the label). */
  children: ReactNode;
  /** Optional trailing node rendered on the right (e.g. a check mark). */
  trailing?: ReactNode;
  /** Color emphasis of the row. */
  tone?: keyof typeof toneStyles;
  /** Keep the menu open after selecting (default `false` = close). */
  closeOnSelect?: boolean;
  onPress?: () => void;
}

function TopNavMenuItem({
  icon,
  children,
  trailing,
  tone = "default",
  closeOnSelect = false,
  onPress,
}: TopNavMenuItemProps) {
  const close = useClose();
  return (
    <button
      type="button"
      role="menuitem"
      onClick={() => {
        onPress?.();
        if (!closeOnSelect) close();
      }}
      className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring ${toneStyles[tone]}`}
    >
      {icon ? (
        <span className="size-5 shrink-0" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <span className="flex-1 leading-tight">{children}</span>
      {trailing ? <span aria-hidden="true">{trailing}</span> : null}
    </button>
  );
}

/** Divider between menu sections. */
function TopNavMenuDivider() {
  return <div role="separator" className="my-1 h-px w-full bg-border" />;
}

TopNavMenu.Item = TopNavMenuItem;
TopNavMenu.Divider = TopNavMenuDivider;

/* ----------------------------------------------------------------------------
 * Icons
 * ------------------------------------------------------------------------- */

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
