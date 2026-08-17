/** Screen modes exposed by the routing state machine (Spec 009). */
export type ScreenMode = "form" | "reader";

/**
 * Deterministically maps a URL `pathname` to the screen mode it represents.
 * `usePathname()` is the single source of truth for the screen mode; the app
 * never receives a `mode` prop and never duplicates it. Unknown or root paths
 * resolve to the `form` screen.
 *
 * - `/form` (or bare `/`) → `form`
 * - `/reader` → `reader`
 * - any other path → `form` (unknown destinations fall back to the form)
 */
export function deriveScreenFromPath(path: string): ScreenMode {
  const normalized = path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
  return normalized === "/reader" ? "reader" : "form";
}
