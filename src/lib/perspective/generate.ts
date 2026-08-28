import "server-only";

import { callText } from "@/lib/ai/call";
import { AI_MODELS } from "@/lib/ai/config";
import { ApiError } from "@/lib/ai/errors";
import { generatorRetryUser, perspectiveSystem, perspectiveUser } from "@/lib/ai/prompts";
import { validatePerspectiveDoc } from "@/lib/ai/validatePerspectiveDoc";
import { isUniqueViolation, prisma } from "@/lib/db";
import { deserializeModelIndex } from "@/lib/modelIndex";
import { getTopicPath } from "@/lib/topics";

/**
 * Perspective generation (perspective spec §7): the same shape as Flow A in
 * src/lib/models/generate.ts, minus classification (the topic already
 * exists). Idempotent by construction: an existing doc returns before any
 * AI call, and the unique constraint plus the refetch below make the
 * reader's auto-fire safe under a race with the button.
 */

export type PerspectiveResult = {
  id: string;
  topicId: string;
  contentMd: string;
  createdAt: Date;
  /** False when an existing doc was returned instead of generated. */
  created: boolean;
};

export async function generatePerspectiveDoc(topicId: string): Promise<PerspectiveResult> {
  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    select: { id: true, name: true },
  });
  if (!topic) {
    throw new ApiError("NOT_FOUND", `No topic with id ${topicId}.`);
  }

  const existing = await prisma.perspectiveDoc.findUnique({ where: { topicId } });
  if (existing) return { ...existing, created: false };

  const topicPath = await getTopicPath(topicId);
  // The level 1 document names the models the bridge section refers to.
  // A topic without one still gets a perspective; the prompt's
  // "(none recorded)" branch handles it.
  const levelOne = await prisma.mentalModelDoc.findUnique({
    where: { topicId_depth: { topicId, depth: 1 } },
    select: { modelIndexJson: true },
  });
  const models = levelOne ? deserializeModelIndex(levelOne.modelIndexJson) : [];

  const system = await perspectiveSystem();
  const baseUser = perspectiveUser(topic.name, topicPath, models);

  let contentMd = await callText({
    promptName: "perspective",
    model: AI_MODELS.GENERATOR,
    system,
    user: baseUser,
  });
  let validation = validatePerspectiveDoc(contentMd);

  if (!validation.ok) {
    // Exactly one retry, with the specific failures appended (docs/05 §9.3).
    contentMd = await callText({
      promptName: "perspective",
      model: AI_MODELS.GENERATOR,
      system,
      user: generatorRetryUser(baseUser, validation.failures),
    });
    validation = validatePerspectiveDoc(contentMd);
  }

  if (!validation.ok) {
    throw new ApiError(
      "GENERATION_INVALID",
      "The generated perspective did not meet the required structure after a retry. Nothing was saved.",
      { failures: validation.failures },
    );
  }

  try {
    const doc = await prisma.perspectiveDoc.create({ data: { topicId, contentMd } });
    return { ...doc, created: true };
  } catch (error) {
    // The auto-fire and the button finished at once. The database picked a
    // winner; hand it back rather than failing the reader (spec §7).
    if (isUniqueViolation(error)) {
      const winner = await prisma.perspectiveDoc.findUnique({ where: { topicId } });
      if (winner) return { ...winner, created: false };
    }
    throw error;
  }
}
