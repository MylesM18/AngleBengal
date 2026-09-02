"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useSyncExternalStore } from "react";

import { applyLatch, initialProgress, settleWrite, type ProgressState } from "@/lib/learn/readProgress";
import { findScrollport } from "@/lib/learn/scrollport";
import { ButtonLink } from "@/components/ui/Button";
import type { ModelIndexEntry } from "@/lib/modelIndex";

type ProgressContextValue = {
  readSet: ReadonlySet<number>;
  entries: ModelIndexEntry[];
  observe: (el: Element, modelNumber: number) => () => void;
};

const ProgressContext = createContext<ProgressContextValue | null>(null);

export function useDocProgressOptional(): { readSet: ReadonlySet<number>; entries: ModelIndexEntry[] } | null {
  const value = useContext(ProgressContext);
  return value ? { readSet: value.readSet, entries: value.entries } : null;
}

/**
 * Owns read state for one doc (spec 5): sentinels register themselves, the
 * one IntersectionObserver latches them as they cross into the scrollport,
 * writes go to the progress route optimistically and retry on the next latch.
 *
 * The state lives in a ref, mutated imperatively by `latch`/`post` outside of
 * render, and exposed to render via `useSyncExternalStore` rather than a raw
 * `stateRef.current` read: `eslint-plugin-react-hooks`'s `react-hooks/refs`
 * rule flags a ref access reachable from render, and this "force a re-render
 * to sync with an external mutable value" shape is exactly the case that hook
 * exists to cover.
 */
export function DocProgressProvider({
  docId,
  entries,
  initialRead,
  children,
}: {
  docId: string;
  entries: ModelIndexEntry[];
  initialRead: number[];
  children: React.ReactNode;
}) {
  const stateRef = useRef<ProgressState>(initialProgress(initialRead));
  const listenersRef = useRef(new Set<() => void>());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const targetsRef = useRef(new Map<Element, number>());

  const subscribe = useCallback((listener: () => void) => {
    listenersRef.current.add(listener);
    return () => listenersRef.current.delete(listener);
  }, []);
  const getSnapshot = useCallback(() => stateRef.current, []);
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const post = useCallback(
    (n: number) => {
      fetch(`/api/models/${docId}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelNumber: n }),
      })
        .then((response) => {
          stateRef.current = settleWrite(stateRef.current, n, response.ok);
        })
        .catch(() => {
          stateRef.current = settleWrite(stateRef.current, n, false);
        });
    },
    [docId],
  );

  const latch = useCallback(
    (n: number) => {
      const { state, toWrite } = applyLatch(stateRef.current, n);
      if (toWrite.length === 0) return;
      stateRef.current = state;
      for (const listener of listenersRef.current) listener();
      for (const write of toWrite) post(write);
    },
    [post],
  );

  const observe = useCallback(
    (el: Element, modelNumber: number) => {
      if (!observerRef.current) {
        observerRef.current = new IntersectionObserver(
          (observed) => {
            for (const entry of observed) {
              if (!entry.isIntersecting) continue;
              const n = targetsRef.current.get(entry.target);
              if (n !== undefined) latch(n);
            }
          },
          { root: findScrollport(el as HTMLElement), threshold: 0 },
        );
      }
      targetsRef.current.set(el, modelNumber);
      observerRef.current.observe(el);
      return () => {
        targetsRef.current.delete(el);
        observerRef.current?.unobserve(el);
      };
    },
    [latch],
  );

  useEffect(() => () => observerRef.current?.disconnect(), []);

  return (
    <ProgressContext.Provider value={{ readSet: state.read, entries, observe }}>
      {children}
    </ProgressContext.Provider>
  );
}

/**
 * The zero-height sentinel at a section's end plus its closure cue (spec 5.1,
 * 5.3). The cue appears exactly where the reader is looking when the latch
 * fires, opacity-only (spec 7 exception). Renders nothing outside a provider.
 */
export function SectionSeam({ modelNumber }: { modelNumber: number }) {
  const context = useContext(ProgressContext);
  const ref = useRef<HTMLDivElement | null>(null);
  const observe = context?.observe;

  useEffect(() => {
    if (!ref.current || !observe) return;
    return observe(ref.current, modelNumber);
  }, [observe, modelNumber]);

  if (!context) return null;
  const { readSet, entries } = context;
  const index = entries.findIndex((entry) => entry.number === modelNumber);
  const next = index >= 0 ? entries[index + 1] : undefined;
  const read = readSet.has(modelNumber);

  return (
    <div>
      <div ref={ref} aria-hidden className="h-px w-full" />
      {read && (
        <p className="animate-cue-fade mb-5 border-t border-hairline pt-2 text-meta text-ink-soft">
          {next ? `Model ${modelNumber} done · Next: ${next.title}` : "All models read"}
        </p>
      )}
    </div>
  );
}

/** The doc-end completion strip (spec 5.3). No confetti, ever. */
export function DocCompleteStrip({ topicId }: { topicId: string }) {
  const context = useContext(ProgressContext);
  if (!context) return null;
  const { readSet, entries } = context;
  if (entries.length === 0 || !entries.every((entry) => readSet.has(entry.number))) return null;
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-r-chip border-l-4 border-green bg-green-tint px-3 py-2">
      <p className="text-ui text-ink">
        <span aria-hidden className="text-green">✓</span> All models read
      </p>
      <ButtonLink href={`/practice/${topicId}`} variant="secondary" size="sm">
        Practice this topic
      </ButtonLink>
    </div>
  );
}
