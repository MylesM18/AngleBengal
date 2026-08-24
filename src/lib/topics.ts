import "server-only";

import { cache } from "react";

import { prisma } from "@/lib/db";
import { deserializeModelIndex } from "@/lib/modelIndex";

/**
 * Topic tree assembly, shared by the API routes and the Learn server
 * components so both see identical counts (docs/04 "Topics").
 */

export type TopicNode = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  docCount: number;
  verifiedProblemCount: number;
  children: TopicNode[];
};

type TopicRow = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  _count: { modelDocs: number };
};

/**
 * Verified-problem counts come from a separate grouped query rather than
 * Prisma's `_count`, because `_count` cannot filter on `verified: true` and
 * the UI must never surface unverified problems (non-negotiable 2).
 */
async function verifiedCountsByTopic(): Promise<Map<string, number>> {
  const grouped = await prisma.problem.groupBy({
    by: ["topicId"],
    where: { verified: true },
    _count: { _all: true },
  });
  return new Map(grouped.map((row) => [row.topicId, row._count._all]));
}

function buildTree(rows: TopicRow[], verified: Map<string, number>): TopicNode[] {
  const nodes = new Map<string, TopicNode>();
  for (const row of rows) {
    nodes.set(row.id, {
      id: row.id,
      name: row.name,
      slug: row.slug,
      parentId: row.parentId,
      docCount: row._count.modelDocs,
      verifiedProblemCount: verified.get(row.id) ?? 0,
      children: [],
    });
  }

  const roots: TopicNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  const sortByName = (list: TopicNode[]): void => {
    list.sort((a, b) => a.name.localeCompare(b.name));
    for (const node of list) sortByName(node.children);
  };
  sortByName(roots);

  return roots;
}

export async function getTopicTree(): Promise<TopicNode[]> {
  const [rows, verified] = await Promise.all([
    prisma.topic.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        parentId: true,
        _count: { select: { modelDocs: true } },
      },
    }),
    verifiedCountsByTopic(),
  ]);
  return buildTree(rows, verified);
}

export type TopicDetail = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  description: string | null;
  path: string[];
  docCount: number;
  verifiedProblemCount: number;
  modelDocs: {
    id: string;
    title: string;
    isExemplar: boolean;
    modelCount: number;
    createdAt: Date;
  }[];
};

/** Root-to-leaf name path, used by breadcrumbs and the generation progress row. */
export async function getTopicPath(topicId: string): Promise<string[]> {
  const path: string[] = [];
  let currentId: string | null = topicId;

  // The taxonomy is at most a handful of levels deep; the guard is only to
  // make a cyclic parent chain fail loudly instead of hanging.
  for (let depth = 0; currentId && depth < 12; depth += 1) {
    const topic: { name: string; parentId: string | null } | null =
      await prisma.topic.findUnique({
        where: { id: currentId },
        select: { name: true, parentId: true },
      });
    if (!topic) break;
    path.unshift(topic.name);
    currentId = topic.parentId;
  }

  return path;
}

export async function getTopicDetail(topicId: string): Promise<TopicDetail | null> {
  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    select: {
      id: true,
      name: true,
      slug: true,
      parentId: true,
      description: true,
      modelDocs: {
        select: { id: true, title: true, isExemplar: true, modelIndexJson: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!topic) return null;

  const [verifiedProblemCount, path] = await Promise.all([
    prisma.problem.count({ where: { topicId, verified: true } }),
    getTopicPath(topicId),
  ]);

  return {
    id: topic.id,
    name: topic.name,
    slug: topic.slug,
    parentId: topic.parentId,
    description: topic.description,
    path,
    docCount: topic.modelDocs.length,
    verifiedProblemCount,
    modelDocs: topic.modelDocs.map((doc) => ({
      id: doc.id,
      title: doc.title,
      isExemplar: doc.isExemplar,
      modelCount: deserializeModelIndex(doc.modelIndexJson).length,
      createdAt: doc.createdAt,
    })),
  };
}

/**
 * topic id -> its ROOT ancestor's name, for accent lookup. A document under
 * "Distance-Rate-Time" has to take Algebra's cobalt, not an accent hashed from
 * its own leaf name (docs/08: accents are owned by root topics).
 */
export async function getRootNameByTopicId(): Promise<Map<string, string>> {
  const rows = await prisma.topic.findMany({ select: { id: true, name: true, parentId: true } });
  const byId = new Map(rows.map((row) => [row.id, row]));

  const rootNames = new Map<string, string>();
  for (const row of rows) {
    let current = row;
    for (let depth = 0; current.parentId && depth < 12; depth += 1) {
      const parent = byId.get(current.parentId);
      if (!parent) break;
      current = parent;
    }
    rootNames.set(row.id, current.name);
  }
  return rootNames;
}

export type DescendantCounts = { docs: number; verifiedProblems: number };

/**
 * Pure roll-up: a topic's own counts plus every descendant's, keyed by topic
 * id. Every topic in `topics` gets an entry, even with nothing beneath it.
 * Kept free of the database so the arithmetic can be read on its own (D-054).
 */
export function rollUpCounts(
  topics: { id: string; parentId: string | null }[],
  own: Map<string, DescendantCounts>,
): Map<string, DescendantCounts> {
  const totals = new Map<string, DescendantCounts>();
  for (const topic of topics) totals.set(topic.id, { docs: 0, verifiedProblems: 0 });
  const parentOf = new Map(topics.map((topic) => [topic.id, topic.parentId]));

  for (const topic of topics) {
    const mine = own.get(topic.id);
    if (!mine) continue;
    let currentId: string | null = topic.id;
    // Same depth guard as getTopicPath: a cyclic parent chain fails loudly.
    for (let depth = 0; currentId && depth < 12; depth += 1) {
      const bucket = totals.get(currentId);
      if (!bucket) break;
      bucket.docs += mine.docs;
      bucket.verifiedProblems += mine.verifiedProblems;
      currentId = parentOf.get(currentId) ?? null;
    }
  }
  return totals;
}

/**
 * topic id -> counts for the topic AND everything beneath it (spec 3a cover
 * numerals, 3c counts line, the Practice button's enabled state). One
 * request-scoped value: React `cache` dedupes the three queries across the
 * layout and the page that both read it.
 */
export const getDescendantCounts = cache(
  async (): Promise<Map<string, DescendantCounts>> => {
    const [topics, docs, problems] = await Promise.all([
      prisma.topic.findMany({ select: { id: true, parentId: true } }),
      prisma.mentalModelDoc.groupBy({ by: ["topicId"], _count: { _all: true } }),
      prisma.problem.groupBy({
        by: ["topicId"],
        where: { verified: true },
        _count: { _all: true },
      }),
    ]);

    const own = new Map<string, DescendantCounts>();
    for (const row of docs) {
      own.set(row.topicId, { docs: row._count._all, verifiedProblems: 0 });
    }
    for (const row of problems) {
      const bucket = own.get(row.topicId) ?? { docs: 0, verifiedProblems: 0 };
      bucket.verifiedProblems = row._count._all;
      own.set(row.topicId, bucket);
    }
    return rollUpCounts(topics, own);
  },
);
