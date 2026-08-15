import type { StoryEntry } from "../../story-request/client/story-session-context";

/**
 * Return story entries in newest-first order. Entries are already stored
 * newest-first by the session context (index 0 = newest = active); this
 * returns a copy so callers never mutate the underlying list. (A naive
 * `.reverse()` would push the newest/active entry to the *end*, so it is
 * intentionally avoided.)
 */
export function sortByNewest<T extends StoryEntry>(entries: T[]): T[] {
  return [...entries];
}
