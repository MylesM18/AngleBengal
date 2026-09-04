import "server-only";

import { callStructured, callText } from "@/lib/ai/call";
import { AI_MODELS } from "@/lib/ai/config";
import { ApiError } from "@/lib/ai/errors";
import {
  CLASSIFIER_SYSTEM,
  classifierUser,
  generatorRetryUser,
  generatorSystem,
  generatorUser,
} from "@/lib/ai/prompts";
import { classifierResultIsCoherent, classifierSchema } from "@/lib/ai/schemas";
import { validateModelDoc } from "@/lib/ai/validateModelDoc";
import { isUniqueViolation, prisma } from "@/lib/db";
import { parseDocTitle, parseModelIndex, serializeModelIndex } from "@/lib/modelIndex";
import { uniqueSlug } from "@/lib/slug";
import { glyphForRootName } from "@/lib/symbols";
import { getTopicPath, getTopicTree } from "@/lib/topics";

/**
 * Flow A (docs/02): classify -> create topic path if needed -> generate ->
 * validate -> save.
 *
 * Nothing is written to the database until a generation passes structural
 * validation (non-negotiable 3), so a failed run leaves no orphan topics
 * behind either: topic creation happens only after classification succeeds,
 * and the doc write is the last step.
 */

export type GenerateResult = {
  docId: string;
  topicId: string;
  topicPath: string[];
};

export async function generateModelDoc(request: string): Promise<GenerateResult> {
  const topics = await getTopicTree();

  const classification = await callStructured({
    promptName: "classifier",
    model: AI_MODELS.CLASSIFIER,
    system: CLASSIFIER_SYSTEM,
    user: classifierUser(request, topics),
    schema: classifierSchema,
    schemaName: "topic_classification",
  });

  if (!classification.isMath) {
    throw new ApiError(
      "NOT_MATH",
      "That is outside mathematics, physics, engineering, and economics. Try something like \"related rates\", \"unit circle\", or \"mixture problems\".",
    );
  }

  if (!classifierResultIsCoherent(classification)) {
    throw new ApiError(
      "AI_INVALID_OUTPUT",
      "The classifier returned both an existing topic and a new path. Try again.",
    );
  }

  const topicId = await resolveTopic(classification.existingTopicId, classification.newTopicPath);
  const topicPath = await getTopicPath(topicId);
  const topicName = classification.canonicalName || topicPath[topicPath.length - 1];

  // A topic holds exactly one level 1 document (@@unique([topicId, depth])),
  // so asking again for a topic that already has one costs nothing. This is
  // what closes the duplicate-generation hole the old unconditional create
  // left open.
  const existingLevelOne = await prisma.mentalModelDoc.findUnique({
    where: { topicId_depth: { topicId, depth: 1 } },
    select: { id: true },
  });
  if (existingLevelOne) {
    return { docId: existingLevelOne.id, topicId, topicPath };
  }

  const system = await generatorSystem();
  const baseUser = generatorUser(topicName, topicPath);

  let contentMd = await callText({
    promptName: "generator",
    model: AI_MODELS.GENERATOR,
    system,
    user: baseUser,
  });

  let validation = validateModelDoc(contentMd);

  if (!validation.ok) {
    // Exactly one retry, with the specific failures appended (docs/05 §2.3).
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
      "The generated document did not meet the required structure after a retry. Nothing was saved.",
      { failures: validation.failures, topicPath },
    );
  }

  const index = parseModelIndex(contentMd);
  const title = parseDocTitle(contentMd, `Mental Models for ${topicName}`);

  try {
    const doc = await prisma.mentalModelDoc.create({
      data: {
        topicId,
        title,
        contentMd,
        modelIndexJson: serializeModelIndex(index),
        isExemplar: false,
        depth: 1,
      },
      select: { id: true },
    });
    return { docId: doc.id, topicId, topicPath };
  } catch (error) {
    // Two generations for the same topic finished at once. The database picked
    // a winner; hand it back rather than failing the reader.
    if (isUniqueViolation(error)) {
      const winner = await prisma.mentalModelDoc.findUnique({
        where: { topicId_depth: { topicId, depth: 1 } },
        select: { id: true },
      });
      if (winner) return { docId: winner.id, topicId, topicPath };
    }
    throw error;
  }
}

/**
 * Returns the id of the topic to file under, creating any missing nodes along
 * a new path. Reuses an existing node at each level so "Calculus > Applications
 * > Related Rates" does not duplicate Calculus or Applications.
 */
async function resolveTopic(
  existingTopicId: string | null,
  newTopicPath: string[] | null,
): Promise<string> {
  if (existingTopicId) {
    const found = await prisma.topic.findUnique({
      where: { id: existingTopicId },
      select: { id: true },
    });
    if (found) return found.id;
    // The classifier hallucinated an id. Fall through only if we have a path.
    if (!newTopicPath?.length) {
      throw new ApiError(
        "AI_INVALID_OUTPUT",
        "The classifier returned a topic that does not exist. Try again.",
      );
    }
  }

  if (!newTopicPath?.length) {
    throw new ApiError("AI_INVALID_OUTPUT", "The classifier returned no destination topic.");
  }

  const takenSlugs = new Set(
    (await prisma.topic.findMany({ select: { slug: true } })).map((topic) => topic.slug),
  );

  let parentId: string | null = null;
  for (const rawName of newTopicPath) {
    const name = rawName.trim();
    if (!name) continue;

    const existing: { id: string } | null = await prisma.topic.findFirst({
      where: { name, parentId },
      select: { id: true },
    });

    if (existing) {
      parentId = existing.id;
      continue;
    }

    const slug = uniqueSlug(name, takenSlugs);
    takenSlugs.add(slug);
    // A new ROOT gets the same glyph D-078 would have hashed for it, resolved
    // to a MathSymbol row so the cover reads from the database like every
    // other root. Subtopics inherit their root's at read time.
    const symbolId =
      parentId === null
        ? ((
            await prisma.mathSymbol.findUnique({
              where: { glyph: glyphForRootName(name) },
              select: { id: true },
            })
          )?.id ?? null)
        : null;

    const created: { id: string } = await prisma.topic.create({
      data: { name, slug, parentId, symbolId },
      select: { id: true },
    });
    parentId = created.id;
  }

  if (!parentId) {
    throw new ApiError("AI_INVALID_OUTPUT", "The classifier returned an empty topic path.");
  }
  return parentId;
}
