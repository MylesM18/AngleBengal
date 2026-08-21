"use client";

import { useSyncExternalStore } from "react";

/**
 * What the practice panel is currently showing, readable by the tutor drawer.
 *
 * The drawer and the practice panel are siblings under the app shell, so the
 * active problem has to cross the tree somehow. This is a module-level store
 * read through `useSyncExternalStore`: no dependency, no provider, and no
 * global state library. CLAUDE.md reserves Zustand for the practice-session
 * sketchpad (Phase 4), and this is not that.
 *
 * `revealed` exists because docs/05 §6 drops the DO NOT REVEAL guard once the
 * student has seen the solution, but the schema has no column recording a
 * reveal (DECISIONS.md D-022). The client knows, so the client reports it.
 */

export type PracticeSession = {
  problemId: string | null;
  /** True once solved correctly or revealed via Show solution. */
  revealed: boolean;
};

const EMPTY: PracticeSession = { problemId: null, revealed: false };

let state: PracticeSession = EMPTY;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function setActiveProblem(problemId: string | null): void {
  if (state.problemId === problemId && !state.revealed) return;
  state = { problemId, revealed: false };
  emit();
}

export function markRevealed(): void {
  if (state.revealed || !state.problemId) return;
  state = { ...state, revealed: true };
  emit();
}

export function clearActiveProblem(): void {
  if (state === EMPTY) return;
  state = EMPTY;
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = (): PracticeSession => state;
/** The server never has an active problem, so the drawer renders consistently. */
const getServerSnapshot = (): PracticeSession => EMPTY;

export function usePracticeSession(): PracticeSession {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
