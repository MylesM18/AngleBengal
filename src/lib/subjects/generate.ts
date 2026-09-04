import "server-only";

import { callStructured } from "@/lib/ai/call";
import { AI_MODELS } from "@/lib/ai/config";
import { ApiError } from "@/lib/ai/errors";
import {
  SUBJECT_PLANNER_SYSTEM,
  SUBJECT_TOPIC_SYSTEM,
  renderTaxonomy,
  subjectPlannerUser,
  subjectTopicUser,
} from "@/lib/ai/prompts";
import {
  subjectPlanIsCoherent,
  subjectPlannerSchema,
  subjectTopicResultIsCoherent,
  subjectTopicSchema,
} from "@/lib/ai/schemas";
import { prisma } from "@/lib/db";
import { normalizeSubjectEmoji } from "@/lib/emoji";
import { uniqueSlug } from "@/lib/slug";
import { glyphForRootName } from "@/lib/symbols";
import { getTopicTree, type TopicNode } from "@/lib/topics";
import { createTopicPath } from "@/lib/topics/create";

/**
 * The subject layer's two flows (subjects spec §5.1): plan and create a whole
 * subject, and file one topic inside an existing subject. Both run on the
 * CLASSIFIER model: they are taxonomy planning, not document writing, and no
 * mental model doc is generated here. Docs stay on demand per topic.
 */

export type GenerateSubjectResult = {
  subjectId: string;
  name: string;
  emoji: string | null;
  created: number;
  existing: boolean;
};

export type AddTopicResult = { topicId: string; existing: boolean };

const OUT_OF_SCOPE_MESSAGE =
  "That is outside mathematics, physics, engineering, and economics. Try a subject within one of those fields.";

export async function generateSubject(request: string): Promise<GenerateSubjectResult> {
  const roots = await prisma.topic.findMany({
    where: { parentId: null },
    select: { id: true, name: true, emoji: true },
    orderBy: { createdAt: "asc" },
  });

  const plan = await callStructured({
    promptName: "subject-planner",
    model: AI_MODELS.CLASSIFIER,
    system: SUBJECT_PLANNER_SYSTEM,
    user: subjectPlannerUser(request, roots),
    schema: subjectPlannerSchema,
    schemaName: "subject_plan",
  });

  if (!plan.inScope) {
    throw new ApiError("OUT_OF_SCOPE", OUT_OF_SCOPE_MESSAGE);
  }
  if (!subjectPlanIsCoherent(plan)) {
    throw new ApiError(
      "AI_INVALID_OUTPUT",
      "The subject planner returned an incoherent plan. Try again.",
    );
  }

  // Postgres treats NULL parentIds as distinct, so @@unique([parentId, name])
  // does not dedupe roots; this name match is the guard (subjects spec §3).
  const canonicalName = plan.canonicalName.trim();
  const existing = roots.find(
    (root) => root.name.toLowerCase() === canonicalName.toLowerCase(),
  );
  if (existing) {
    return {
      subjectId: existing.id,
      name: existing.name,
      emoji: existing.emoji,
      created: 0,
      existing: true,
    };
  }

  const takenSlugs = new Set(
    (await prisma.topic.findMany({ select: { slug: true } })).map((topic) => topic.slug),
  );
  // The glyph stays the fallback emblem wherever the emoji is null, so a new
  // root keeps the same MathSymbol wiring the seed gives the named six.
  const symbol = await prisma.mathSymbol.findUnique({
    where: { glyph: glyphForRootName(canonicalName) },
    select: { id: true },
  });
  const emoji = normalizeSubjectEmoji(plan.emoji);

  // Sequential creates inside one transaction: the transaction-mode pooler
  // rejects parallel bursts, and a half-created subject must not survive.
  const created = await prisma.$transaction(async (tx) => {
    const rootSlug = uniqueSlug(canonicalName, takenSlugs);
    takenSlugs.add(rootSlug);
    const root = await tx.topic.create({
      data: {
        name: canonicalName,
        slug: rootSlug,
        parentId: null,
        symbolId: symbol?.id ?? null,
        emoji,
      },
      select: { id: true, name: true, emoji: true },
    });

    let count = 0;
    const seen = new Set<string>([canonicalName.toLowerCase()]);
    for (const raw of plan.topics) {
      const name = raw.trim();
      const key = name.toLowerCase();
      if (!name || seen.has(key)) continue;
      seen.add(key);
      const slug = uniqueSlug(name, takenSlugs);
      takenSlugs.add(slug);
      await tx.topic.create({
        data: { name, slug, parentId: root.id },
        select: { id: true },
      });
      count += 1;
    }
    return { root, count };
  });

  return {
    subjectId: created.root.id,
    name: created.root.name,
    emoji: created.root.emoji,
    created: created.count,
    existing: false,
  };
}

export async function addTopicToSubject(
  subjectId: string,
  request: string,
): Promise<AddTopicResult> {
  const subject = await prisma.topic.findUnique({
    where: { id: subjectId },
    select: { id: true, name: true, parentId: true },
  });
  if (!subject || subject.parentId !== null) {
    throw new ApiError("NOT_FOUND", "No subject with that id.");
  }

  const node = (await getTopicTree()).find((root) => root.id === subjectId);
  if (!node) {
    throw new ApiError("NOT_FOUND", "No subject with that id.");
  }

  const decision = await callStructured({
    promptName: "subject-topic",
    model: AI_MODELS.CLASSIFIER,
    system: SUBJECT_TOPIC_SYSTEM,
    user: subjectTopicUser(request, subject.name, renderTaxonomy([node])),
    schema: subjectTopicSchema,
    schemaName: "subject_topic",
  });

  if (!decision.belongs) {
    throw new ApiError(
      "OUT_OF_SCOPE",
      `That does not belong to ${subject.name}. Try a topic of this subject, or create it as its own subject from the Learn page.`,
    );
  }
  if (!subjectTopicResultIsCoherent(decision)) {
    throw new ApiError(
      "AI_INVALID_OUTPUT",
      "The librarian returned an incoherent filing. Try again.",
    );
  }

  if (decision.existingTopicId) {
    // Hallucination guard: the id must live inside THIS subject's subtree.
    if (!collectSubtreeIds(node).has(decision.existingTopicId)) {
      throw new ApiError(
        "AI_INVALID_OUTPUT",
        "The librarian pointed at a topic outside this subject. Try again.",
      );
    }
    return { topicId: decision.existingTopicId, existing: true };
  }

  const topicId = await createTopicPath(subject.id, decision.newTopicPath ?? []);
  return { topicId, existing: false };
}

function collectSubtreeIds(node: TopicNode): Set<string> {
  const ids = new Set<string>([node.id]);
  const walk = (children: TopicNode[]): void => {
    for (const child of children) {
      ids.add(child.id);
      walk(child.children);
    }
  };
  walk(node.children);
  return ids;
}
