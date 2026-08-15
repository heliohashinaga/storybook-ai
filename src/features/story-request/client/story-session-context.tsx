"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { GeneratedStory, SafeError } from "../../story-generation/server/schemas";
import type { Locale, Theme } from "./story-preferences-schema";

/**
 * In-memory story session state machine (T030) with multi-story history (T048).
 *
 * Holds the anonymous request status, an append-only list of approved stories
 * (newest-first), the active story id, and the typed sanitized failure — all
 * strictly in React memory. The session is never serialized to durable browser
 * storage: exact age and generated stories live only in this in-memory state
 * and evaporate on navigation/refresh, which is exactly what the privacy
 * contract requires.
 *
 * Multi-story behavior (US3, T048):
 * - `succeed` APPENDS the new story (newest-first); it never replaces the
 *   active story nor discards earlier ones ("generate another" semantics).
 * - There is NO cap on the number of stories.
 * - `accessStory(id)` selects a previous story without changing the list.
 * - `reset` clears the whole history and returns to idle.
 * - `story` is kept as a compatibility alias of `activeStory`.
 */

export type StorySessionStatus = "idle" | "submitting" | "success" | "failed";

/** A single approved story together with its session entry id. */
export interface StoryEntry {
  id: string;
  story: GeneratedStory;
}

export interface StorySessionState {
  status: StorySessionStatus;
  /**
   * Approved stories, newest first (in-memory only). Append-only: `succeed`
   * adds, `reset` clears. Never persisted.
   */
  stories: StoryEntry[];
  /** Id of the currently selected story (null until any generation succeeds). */
  activeId: string | null;
  /**
   * Anonymized last-preferences reused for "generate another" (T050): the
   * exact age, story language and theme stay in memory only — never sent (the
   * payload carries derived ageBand/locale/theme) and never serialized.
   */
  lastPreferences: { age: number; locale: Locale; theme: Theme; sceneCount: number } | null;
  /** Typed, sanitized failure (only code/messageKey/retryable; never raw content). */
  failure: SafeError | null;
}

/** Persisted (stored) slice — the derived fields are computed on read. */
interface StoredSessionState {
  status: StorySessionStatus;
  stories: StoryEntry[];
  activeId: string | null;
  lastPreferences: { age: number; locale: Locale; theme: Theme; sceneCount: number } | null;
  failure: SafeError | null;
}

export interface StorySessionValue extends Omit<StorySessionState, "stories"> {
  stories: StoryEntry[];
  /** Active approved story (derived from activeId; newest when none selected). */
  activeStory: GeneratedStory | null;
  /** Compatibility alias of `activeStory` (kept for current single-story UIs). */
  story: GeneratedStory | null;
}

export interface StorySessionActions {
  /** Marks the request as in-flight; clears any previous failure. */
  begin: () => void;
  /** Moves to success appending the story (newest-first); selects it.
   *  Stores the anonymized prefs for "generate another" reuse (T050). */
  succeed: (
    story: GeneratedStory,
    prefs?: { age: number; locale: Locale; theme: Theme; sceneCount: number }
  ) => void;
  /** Moves to failed, keeping the story list and selection. */
  fail: (failure: SafeError) => void;
  /** Selects a story by id without replacing the list. */
  accessStory: (id: string) => void;
  /** Returns to idle, clearing the whole history and prefs. */
  reset: () => void;
  /**
   * True when at least one approved story exists in the session. Used as the
   * session gate: `/reader` without a session redirects to `/form` (Spec 009).
   */
  hasSession: () => boolean;
}

export type StorySession = StorySessionValue & StorySessionActions;

const initialSession: StoredSessionState = {
  status: "idle",
  stories: [],
  activeId: null,
  lastPreferences: null,
  failure: null,
};

interface StorySessionContextValue extends StorySessionValue {
  begin: () => void;
  succeed: (
    story: GeneratedStory,
    prefs?: { age: number; locale: Locale; theme: Theme; sceneCount: number }
  ) => void;
  fail: (failure: SafeError) => void;
  accessStory: (id: string) => void;
  reset: () => void;
  hasSession: () => boolean;
}

const StorySessionContext = createContext<StorySessionContextValue | null>(null);

export function StorySessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StoredSessionState>(initialSession);
  // Monotonic id source: stable per entry, deterministic, in-memory only.
  const idRef = useRef(0);
  const nextId = useCallback(() => {
    idRef.current += 1;
    return `story-${idRef.current}`;
  }, []);

  const begin = useCallback(() => {
    setState((prev) => ({ ...prev, status: "submitting", failure: null }));
  }, []);

  const succeed = useCallback(
    (
      story: GeneratedStory,
      prefs?: { age: number; locale: Locale; theme: Theme; sceneCount: number }
    ) => {
      const id = nextId();
      setState((prev) => ({
        status: "success" as const,
        // Append newest-first; never replaces or discards earlier stories.
        stories: [{ id, story }, ...prev.stories],
        activeId: id,
        lastPreferences: prefs ?? prev.lastPreferences,
        failure: null,
      }));
    },
    [nextId]
  );

  const fail = useCallback((failure: SafeError) => {
    setState((prev) => ({ ...prev, status: "failed", failure }));
  }, []);

  const accessStory = useCallback((id: string) => {
    setState((prev) =>
      prev.stories.some((entry) => entry.id === id) ? { ...prev, activeId: id } : prev
    );
  }, []);

  const reset = useCallback(() => {
    setState(initialSession);
  }, []);

  // Derive the active story from stories + activeId (newest by default).
  const active = useMemo(() => {
    if (!state.activeId && state.stories.length > 0) {
      return state.stories[0]!.story;
    }
    return state.stories.find((e) => e.id === state.activeId)?.story ?? null;
  }, [state.stories, state.activeId]);

  const value = useMemo<StorySessionContextValue>(
    () => ({
      ...state,
      status: state.status,
      stories: state.stories,
      activeId: state.activeId,
      failure: state.failure,
      activeStory: active,
      story: active, // compat alias of activeStory
      begin,
      succeed,
      fail,
      accessStory,
      reset,
      hasSession: () => state.stories.length > 0,
    }),
    [state, active, begin, succeed, fail, accessStory, reset]
  );

  return <StorySessionContext.Provider value={value}>{children}</StorySessionContext.Provider>;
}

export function useStorySession(): StorySession {
  const context = useContext(StorySessionContext);
  if (!context) {
    throw new Error("useStorySession must be used within a StorySessionProvider");
  }
  return context;
}
