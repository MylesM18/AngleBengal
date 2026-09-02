"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useSyncExternalStore } from "react";

import { applyLatch, initialProgress, settleWrite, type ProgressState } from "@/lib/learn/readProgress";
import { findScrollport } from "@/lib/learn/scrollport";
import { Button, ButtonLink } from "@/components/ui/Button";
import { useReaderTabOptional } from "@/components/learn/ReaderTabContext";
import type { ModelIndexEntry } from "@/lib/modelIndex";

type SurfaceProgress = {
  readSet: ReadonlySet<number>;
  entries: ModelIndexEntry[];
  cueNoun: string;
  finalCue: string;
  observe: (el: Element, number: number) => () => void;
};

/**
 * Keyed by surface ("doc" | "perspective"): the doc page holds two progress
 * surfaces at once (spec 8), so the context is a map merged over the parent
 * rather than a single value. Nested providers for different surfaces (one
 * per pane) each add their own key and pass the rest of the map through,
 * so both surfaces resolve correctly regardless of nesting order.
 */
const ProgressContext = createContext<Record<string, SurfaceProgress>>({});

export function useReadProgress(surface: string): Omit<SurfaceProgress, "observe"> | null {
  const value = useContext(ProgressContext)[surface];
  if (!value) return null;
  const { observe, ...rest } = value;
  void observe;
  return rest;
}

/**
 * Owns read state for one surface (spec 5, spec 8): sentinels register
 * themselves, one IntersectionObserver latches them as they cross into the
 * scrollport, writes go to `write.url` optimistically (`{[write.key]: n}`)
 * and retry on the next latch. Providers for different surfaces nest by
 * merging into the parent map, so the doc and perspective surfaces coexist
 * on one page.
 *
 * The state lives in a ref, mutated imperatively by `latch`/`post` outside of
 * render, and exposed to render via `useSyncExternalStore` rather than a raw
 * `stateRef.current` read: `eslint-plugin-react-hooks`'s `react-hooks/refs`
 * rule flags a ref access reachable from render, and this "force a re-render
 * to sync with an external mutable value" shape is exactly the case that hook
 * exists to cover. Only `latch()` notifies listeners; `post`'s settled writes
 * mutate the ref without notifying, so a write settling never causes a cue to
 * flicker on its own.
 */
export function ReadProgressProvider({
  surface,
  entries,
  initialRead,
  write,
  cueNoun,
  finalCue,
  children,
}: {
  surface: string;
  entries: ModelIndexEntry[];
  initialRead: number[];
  write: { url: string; key: string };
  cueNoun: string;
  finalCue: string;
  children: React.ReactNode;
}) {
  const parent = useContext(ProgressContext);
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
      fetch(write.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [write.key]: n }),
      })
        .then((response) => {
          stateRef.current = settleWrite(stateRef.current, n, response.ok);
        })
        .catch(() => {
          stateRef.current = settleWrite(stateRef.current, n, false);
        });
    },
    [write.url, write.key],
  );

  const latch = useCallback(
    (n: number) => {
      const { state, toWrite } = applyLatch(stateRef.current, n);
      if (toWrite.length === 0) return;
      stateRef.current = state;
      for (const listener of listenersRef.current) listener();
      for (const w of toWrite) post(w);
    },
    [post],
  );

  const observe = useCallback(
    (el: Element, number: number) => {
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
      targetsRef.current.set(el, number);
      observerRef.current.observe(el);
      return () => {
        targetsRef.current.delete(el);
        observerRef.current?.unobserve(el);
      };
    },
    [latch],
  );

  useEffect(() => () => observerRef.current?.disconnect(), []);

  const value = useMemo(
    () => ({
      ...parent,
      [surface]: { readSet: state.read, entries, cueNoun, finalCue, observe },
    }),
    [parent, surface, entries, cueNoun, finalCue, observe, state.read],
  );

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

/**
 * The zero-height sentinel at a section's end plus its closure cue (spec 5.1,
 * 5.3, 8). Opacity-only reveal (spec 7 exception). Renders nothing when its
 * surface has no provider, which is also the post-generation window before
 * router.refresh lands (spec 8).
 */
export function SectionSeam({ number, surface = "doc" }: { number: number; surface?: string }) {
  const context = useContext(ProgressContext)[surface];
  const ref = useRef<HTMLDivElement | null>(null);
  const observe = context?.observe;

  useEffect(() => {
    if (!ref.current || !observe) return;
    return observe(ref.current, number);
  }, [observe, number]);

  if (!context) return null;
  const { readSet, entries, cueNoun, finalCue } = context;
  const index = entries.findIndex((entry) => entry.number === number);
  const next = index >= 0 ? entries[index + 1] : undefined;

  return (
    <div>
      <div ref={ref} aria-hidden className="h-px w-full" />
      {readSet.has(number) && (
        <p className="animate-cue-fade mb-5 border-t border-hairline pt-2 text-meta text-ink-soft">
          {next ? `${cueNoun} ${number} done · Next: ${next.title}` : finalCue}
        </p>
      )}
    </div>
  );
}

/** The doc-end completion strip (spec 5.3). No confetti, ever. */
export function DocCompleteStrip({ topicId }: { topicId: string }) {
  const progress = useReadProgress("doc");
  if (!progress || progress.entries.length === 0) return null;
  if (!progress.entries.every((entry) => progress.readSet.has(entry.number))) return null;
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

/**
 * The perspective's closing handoff (spec 8): visible once every narrative
 * section is read; the action flips to the Models pane, the intended reading
 * order made into a handoff.
 */
export function PerspectiveCompleteStrip() {
  const progress = useReadProgress("perspective");
  const tab = useReaderTabOptional();
  if (!progress || progress.entries.length === 0) return null;
  if (!progress.entries.every((entry) => progress.readSet.has(entry.number))) return null;
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-r-chip border-l-4 border-green bg-green-tint px-3 py-2">
      <p className="text-ui text-ink">
        <span aria-hidden className="text-green">✓</span> Perspective read
      </p>
      {tab && (
        <Button type="button" variant="tertiary" size="sm" onClick={() => tab.setActive("models")}>
          Now the models
        </Button>
      )}
    </div>
  );
}
