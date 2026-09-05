import "server-only";

import { prisma } from "@/lib/db";
import { isResumablePath } from "@/lib/resume/resumePath";

/**
 * The one resume row (D-156). Single-user app, so the row id is fixed; the
 * client reports location as it changes and the root page redirects to it.
 * Every read degrades to null on any failure: resume is a convenience, and
 * a broken row must never keep the app from opening.
 */

const ROW_ID = "owner";

export type ResumeContext = {
  /** Reader scroll offset within the learn doc the path points at. */
  scrollTop?: number;
  /** The problem that was on screen at the practice path. */
  problemId?: string;
};

export type ResumeRecord = { path: string; context: ResumeContext };

function parseContext(raw: string): ResumeContext {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    const record = parsed as Record<string, unknown>;
    const context: ResumeContext = {};
    if (typeof record.scrollTop === "number" && Number.isFinite(record.scrollTop)) {
      context.scrollTop = Math.max(0, record.scrollTop);
    }
    if (typeof record.problemId === "string" && /^[a-z0-9]{1,64}$/i.test(record.problemId)) {
      context.problemId = record.problemId;
    }
    return context;
  } catch {
    return {};
  }
}

export async function readResume(): Promise<ResumeRecord | null> {
  try {
    const row = await prisma.resumeState.findUnique({ where: { id: ROW_ID } });
    if (!row || !isResumablePath(row.path)) return null;
    return { path: row.path, context: parseContext(row.contextJson) };
  } catch {
    return null;
  }
}

export async function writeResume(path: string, context: ResumeContext): Promise<void> {
  const contextJson = JSON.stringify(context);
  await prisma.resumeState.upsert({
    where: { id: ROW_ID },
    create: { id: ROW_ID, path, contextJson },
    update: { path, contextJson },
  });
}
