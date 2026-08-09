"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { GeneratedStory, SafeError } from "../../story-generation/server/schemas";

/**
 * In-memory story session state machine (T030).
 *
 * Holds the anonymous request status, the active approved story, and the typed
 * sanitized failure — all strictly in React memory. The session is never
 * serialized to any durable browser storage: exact age and generated stories
 * live only in this in-memory state and evaporate on navigation/refresh,
 * which is exactly what the privacy contract requires.
 */

export type StorySessionStatus = "idle" | "submitting" | "success" | "failed";

export interface StorySessionState {
  status: StorySessionStatus;
  /** Active approved story (in-memory only; null until a generation succeeds). */
  story: GeneratedStory | null;
  /** Typed, sanitized failure (only code/messageKey/retryable; never raw content). */
  failure: SafeError | null;
}

export interface StorySessionActions {
  /** Marks the request as in-flight; clears any previous failure. */
  begin: () => void;
  /** Moves to success and stores the approved active story. */
  succeed: (story: GeneratedStory) => void;
  /** Moves to failed, keeping the typed sanitized error. */
  fail: (failure: SafeError) => void;
  /** Returns to idle, discarding the active story and any failure. */
  reset: () => void;
}

export type StorySession = StorySessionState & StorySessionActions;

const initialSession: StorySessionState = {
  status: "idle",
  story: null,
  failure: null,
};

interface StorySessionContextValue extends StorySessionState {
  begin: () => void;
  succeed: (story: GeneratedStory) => void;
  fail: (failure: SafeError) => void;
  reset: () => void;
}

const StorySessionContext = createContext<StorySessionContextValue | null>(null);

export function StorySessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StorySessionState>(initialSession);

  const begin = useCallback(() => {
    setState((prev) => ({ status: "submitting", story: prev.story, failure: null }));
  }, []);

  const succeed = useCallback((story: GeneratedStory) => {
    setState({ status: "success", story, failure: null });
  }, []);

  const fail = useCallback((failure: SafeError) => {
    setState({ status: "failed", story: null, failure });
  }, []);

  const reset = useCallback(() => {
    setState(initialSession);
  }, []);

  const value = useMemo<StorySessionContextValue>(
    () => ({ ...state, begin, succeed, fail, reset }),
    [state, begin, succeed, fail, reset]
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
