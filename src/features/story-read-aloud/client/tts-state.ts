/**
 * Client-side AI narration state (spec 004, T014).
 *
 * The narration control is a small state machine rendered accessibly via
 * `aria-live`. It is deliberately separate from the storage so the hook stays
 * testable with `renderHook` and the component can reflect `busy`/`error`
 * states without touching audio APIs.
 */

export type NarrationStatus = "idle" | "busy" | "speaking" | "stopping" | "error";

/** Which voice path is active: AI, or the browser Web Speech fallback. */
export type NarrationMode = "ai" | "system";

export interface NarrationControlState {
  status: NarrationStatus;
  /** `ai` when a server narration is in flight/active; `system` for Web Speech. */
  mode: NarrationMode;
  /** Localized, accessible error message (only meaningful when status==='error'). */
  errorMessage: string;
}
