import "server-only";

import { callText } from "@/lib/ai/call";
import { AI_MODELS } from "@/lib/ai/config";
import { ApiError } from "@/lib/ai/errors";
import { deepenUser, generatorRetryUser, generatorSystem } from "@/lib/ai/prompts";
import { validateModelDoc } from "@/lib/ai/validateModelDoc";
import { isUniqueViolation, prisma } from "@/lib/db";
import {
  deserializeModelIndex,
  parseDocTitle,
  parseModelIndex,
  serializeModelIndex,
} from "@/lib/modelIndex";
import { getTopicPath } from "@/lib/topics";

/**
 * "Generate more study" (spec §5): the next level of a topic's chain.
 *
 * Separate from `generateModelDoc` because it skips classification and topic
 * creation entirely: the destination topic is already known, it is the source
 * document's own.
 *
 * Nothing is written until the generation passes structural validation, the
 * same non-negotiable 3 that governs level 1.
 */

export type DeepenResult = {
  docId: string;
  topicId: string;
  depth: number;
  /** True when an existing level was handed back instead of generating one. */
  reused: boolean;
};

export async function deepenModelDoc(sourceDocId: string): Promise<DeepenResult> {
  const source = await prisma.mentalModelDoc.findUnique({
    where: { id: sourceDocId },
    select: { id: true, topicId: true, depth: true, title: true, contentMd: true },
  });
  if (!source) {
    throw new ApiError("NOT_FOUND", `No model document with id ${sourceDocId}.`);
  }

  const targetDepth = source.depth + 1;

  // Return-existing: no model call, no cost, no duplicate.
  const already = await prisma.mentalModelDoc.findUnique({
    where: { topicId_depth: { topicId: source.topicId, depth: targetDepth } },
    select: { id: true },
  });
  if (already) {
    return { docId: already.id, topicId: source.topicId, depth: targetDepth, reused: true };
  }

  // Every earlier level contributes model TITLES only. The immediate parent is
  // the only one that contributes full text, so input stays flat as depth grows.
  const ancestors = await prisma.mentalModelDoc.findMany({
    where: { topicId: source.topicId, depth: { lt: targetDepth } },
    select: { depth: true, modelIndexJson: true },
    orderBy: { depth: "asc" },
  });
  const ancestorTitles = ancestors.flatMap((doc) =>
    deserializeModelIndex(doc.modelIndexJson).map(
      (entry) => `Level ${doc.depth}, Model ${entry.number}: ${entry.title}`,
    ),
  );

  const topicPath = await getTopicPath(source.topicId);
  const topicName = topicPath[topicPath.length - 1] ?? "this topic";

  const system = await generatorSystem();
  const baseUser = deepenUser(topicName, topicPath, targetDepth, source.contentMd, ancestorTitles);

  let contentMd = await callText({
    promptName: "generator",
    model: AI_MODELS.GENERATOR,
    system,
    user: baseUser,
  });

  let validation = validateModelDoc(contentMd);

  if (!validation.ok) {
    // Exactly one retry, same as level 1 (docs/05 §2.3).
    contentMd = await callText({
      promptName: "generator",
      model: AI_MODELS.GENERATOR,
      system,
      user: generatorRetryUser(baseUser, validation.failures),
    });
    validation = validateModelDoc(contentMd);
  }

  if (!validation.ok) {
    throw new ApiError(
      "GENERATION_INVALID",
      "The deeper document did not meet the required structure after a retry. Nothing was saved.",
      { failures: validation.failures, topicPath },
    );
  }

  const index = parseModelIndex(contentMd);
  const title = parseDocTitle(contentMd, `Mental Models for ${topicName}, Level ${targetDepth}`);

  try {
    const doc = await prisma.mentalModelDoc.create({
      data: {
        topicId: source.topicId,
        title,
        contentMd,
        modelIndexJson: serializeModelIndex(index),
        isExemplar: false,
        depth: targetDepth,
      },
      select: { id: true },
    });
    return { docId: doc.id, topicId: source.topicId, depth: targetDepth, reused: false };
  } catch (error) {
    // The button was double-clicked and the other request won the unique
    // constraint. Hand back the winner rather than failing the reader.
    if (isUniqueViolation(error)) {
      const winner = await prisma.mentalModelDoc.findUnique({
        where: { topicId_depth: { topicId: source.topicId, depth: targetDepth } },
        select: { id: true },
      });
      if (winner) {
        return { docId: winner.id, topicId: source.topicId, depth: targetDepth, reused: true };
      }
    }
    throw error;
  }
}
