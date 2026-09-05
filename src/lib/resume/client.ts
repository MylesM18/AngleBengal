"use client";

import type { ProblemWorkState } from "@/lib/resume/workState";

/**
 * The client half of resume (D-156): one module-level record of "where the
 * app is" posted debounced to /api/state/resume, and one work saver posting
 * the in-progress sketch to /api/problems/[id]/work. Module scope for the
 * same reason practiceSession.ts is module scope: the writers (layout
 * tracker, learn reader, practice panel) sit in different trees.
 *
 * Everything here is fire-and-forget: resume is a convenience, so failures
 * are swallowed and the next change retries. On pagehide the pending state
 * goes out through sendBeacon; payloads past the beacon budget fall back to
 * a keepalive fetch, and in the worst case only the last debounce window of
 * work is lost.
 */

const RESUME_DEBOUNCE_MS = 1000;
const WORK_DEBOUNCE_MS = 1500;

type ResumeReport = { path: string; scrollTop?: number; problemId?: string };

let record: ResumeReport | null = null;
let resumeTimer: number | null = null;

let workProblemId: string | null = null;
let workBuilder: (() => ProblemWorkState) | null = null;
let workDirty = false;
let workTimer: number | null = null;

let lifecycleInstalled = false;

function currentAppPath(): string {
  return window.location.pathname + window.location.search;
}

function postJson(url: string, payload: unknown, beacon: boolean): void {
  const body = JSON.stringify(payload);
  if (beacon && typeof navigator.sendBeacon === "function") {
    const ok = navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
    if (ok) return;
  }
  void fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: beacon,
  }).catch(() => {
    // Swallowed on purpose: the next change retries.
  });
}

function flushResume(beacon = false): void {
  if (resumeTimer !== null) {
    clearTimeout(resumeTimer);
    resumeTimer = null;
  }
  if (!record) return;
  postJson("/api/state/resume", record, beacon);
}

function scheduleResume(): void {
  if (resumeTimer !== null) clearTimeout(resumeTimer);
  resumeTimer = window.setTimeout(() => {
    resumeTimer = null;
    flushResume();
  }, RESUME_DEBOUNCE_MS);
}

/**
 * Record the current location. The reader's scroll offset is dropped on a
 * path change (it belongs to that document), but the in-progress problem id
 * survives navigation: it means "the problem being worked on", and only a
 * later problem load replaces it. That is what brings the same problem back
 * after a detour through Learn.
 */
export function reportPath(path: string): void {
  installLifecycleFlush();
  if (record?.path === path) return;
  record = {
    path,
    ...(record?.problemId !== undefined ? { problemId: record.problemId } : {}),
  };
  scheduleResume();
}

/** Merge surface detail (scroll offset, problem id) into the record. */
export function reportDetail(detail: { scrollTop?: number; problemId?: string }): void {
  installLifecycleFlush();
  if (!record) record = { path: currentAppPath() };
  record = { ...record, ...detail };
  scheduleResume();
}

/**
 * Arm the work saver for one problem. The builder is read at flush time so
 * a save always carries the latest state; between suspendProblemWork and
 * the next begin, change notes are dropped, which is what keeps a canvas
 * reset from overwriting the previous problem's saved work.
 */
export function beginProblemWork(problemId: string, builder: () => ProblemWorkState): void {
  installLifecycleFlush();
  workProblemId = problemId;
  workBuilder = builder;
  workDirty = false;
}

/** Flush any pending save, then stop attributing changes to that problem. */
export function suspendProblemWork(): void {
  flushWork();
  workProblemId = null;
  workBuilder = null;
  workDirty = false;
}

/** Called on every sketch or answer change; debounced into one POST. */
export function noteProblemWork(): void {
  if (!workProblemId) return;
  workDirty = true;
  if (workTimer !== null) clearTimeout(workTimer);
  workTimer = window.setTimeout(() => {
    workTimer = null;
    flushWork();
  }, WORK_DEBOUNCE_MS);
}

function flushWork(beacon = false): void {
  if (workTimer !== null) {
    clearTimeout(workTimer);
    workTimer = null;
  }
  if (!workDirty || !workProblemId || !workBuilder) return;
  workDirty = false;
  postJson(`/api/problems/${workProblemId}/work`, { state: workBuilder() }, beacon);
}

function installLifecycleFlush(): void {
  if (lifecycleInstalled || typeof window === "undefined") return;
  lifecycleInstalled = true;
  window.addEventListener("pagehide", () => {
    flushResume(true);
    flushWork(true);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      flushResume(true);
      flushWork(true);
    }
  });
}
