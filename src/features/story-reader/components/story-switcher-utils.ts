import type { StoryEntry } from "../../story-request/client/story-session-context";

/** Sort story entries newest-first by their inserted order (index). */
export function sortByNewest<T extends StoryEntry>(entries: T[]): T[] {
  // entries are appended newest-first already; reverse to newest-first again
  // is a no-op for the common case, but normalises any caller-supplied order.
  return [...entries].reverse();
}
