import "server-only";

import { cache } from "react";

import { prisma } from "@/lib/db";
import { deserializeModelIndex } from "@/lib/modelIndex";
import { DEFAULT_GLYPH } from "@/lib/symbols";

/**
 * Topic tree assembly, shared by the API routes and the Learn server
 * components so both see identical counts (docs/04 "Topics").
 */

export type TopicNode = {
  id: string;
  name: string;
  slug: string;
  glyph: string;
  /** The subject's emoji, inherited root-down like the glyph. Data only
   *  since D-150: every emblem display renders the glyph. */
  emoji: string | null;
  /** Off the Learn shelves when true; the topic itself keeps working. */
  hidden: boolean;
  /** Epoch ms (serializable to client components); ascending is pin order. */
  favoritedAt: number | null;
  parentId: string | null;
  docCount: number;
  verifiedProblemCount: number;
  /** Practice generation constraint, owned per topic (docs/06 §3). */
  wordProblemsOnly: boolean;
  children: TopicNode[];
};

type TopicRow = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  wordProblemsOnly: boolean;
  emoji: string | null;
  hidden: boolean;
  favoritedAt: Date | null;
  symbol: { glyph: string } | null;
  _count: { modelDocs: number };
};

/**
 * Verified-problem counts come from a separate grouped query rather than
 * Prisma's `_count`, because `_count` cannot filter on `verified: true` and
 * the UI must never surface unverified problems (non-negotiable 2).
 */
const verifiedCountsByTopic = cache(async (): Promise<Map<string, number>> => {
  const grouped = await prisma.problem.groupBy({
    by: ["topicId"],
    where: { verified: true },
    _count: { _all: true },
  });
  return new Map(grouped.map((row) => [row.topicId, row._count._all]));
});

/**
 * Every topic's id, name and parent, once per request (D-117).
 *
 * The taxonomy is small (tens of rows) and four callers used to read it
 * separately: the tree, the descendant roll-up, the root-name map, and the
 * ancestor walk, which issued one query PER LEVEL. Against a pooled remote
 * database the round trip, not the row count, is the cost, so the whole table
 * is cheaper to hold once than to ask for repeatedly. React `cache` scopes it
 * to a single request, so a layout and its page share one read.
 */
export const allTopicRows = cache(
  async (): Promise<
    { id: string; name: string; parentId: string | null; createdAt: Date }[]
  > =>
    prisma.topic.findMany({
      select: { id: true, name: true, parentId: true, createdAt: true },
    }),
);

/**
 * Root topic ids in seed (creation) order, which is the order the Learn index
 * shelves them in: the taxonomy reads Arithmetic before Algebra on purpose.
 * Derived from the cached rows rather than its own ordered query (D-117).
 */
export async function getRootIdsInSeedOrder(): Promise<string[]> {
  return (await allTopicRows())
    .filter((row) => row.parentId === null)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((row) => row.id);
}

function buildTree(rows: TopicRow[], verified: Map<string, number>): TopicNode[] {
  const nodes = new Map<string, TopicNode>();
  for (const row of rows) {
    nodes.set(row.id, {
      id: row.id,
      name: row.name,
      slug: row.slug,
      glyph: row.symbol?.glyph ?? DEFAULT_GLYPH,
      emoji: row.emoji,
      hidden: row.hidden,
      favoritedAt: row.favoritedAt?.getTime() ?? null,
      parentId: row.parentId,
      docCount: row._count.modelDocs,
      verifiedProblemCount: verified.get(row.id) ?? 0,
      wordProblemsOnly: row.wordProblemsOnly,
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
  // Only roots carry a symbolId; the whole subtree wears the root's emblem
  // (spec §4), which is what `glyphForRoot(topic.path[0])` used to do. The
  // emoji inherits by exactly the same rule (subjects spec §7).
  const inheritEmblems = (list: TopicNode[], glyph: string, emoji: string | null): void => {
    for (const node of list) {
      node.glyph = glyph;
      node.emoji = emoji;
      inheritEmblems(node.children, glyph, emoji);
    }
  };
  for (const root of roots) inheritEmblems(root.children, root.glyph, root.emoji);

  sortByName(roots);

  return roots;
}

export const getTopicTree = cache(async (): Promise<TopicNode[]> => {
  const [rows, verified] = await Promise.all([
    prisma.topic.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        parentId: true,
        wordProblemsOnly: true,
        emoji: true,
        hidden: true,
        favoritedAt: true,
        symbol: { select: { glyph: true } },
        _count: { select: { modelDocs: true } },
      },
    }),
    verifiedCountsByTopic(),
  ]);
  return buildTree(rows, verified);
});

export type TopicDetail = {
  id: string;
  name: string;
  slug: string;
  glyph: string;
  /** The root's emoji, inherited like the glyph. Data only since D-150:
   *  every emblem display renders the glyph. */
  emoji: string | null;
  /** This topic's own shelf state (subjects spec §7). */
  hidden: boolean;
  favoritedAt: number | null;
  parentId: string | null;
  description: string | null;
  path: string[];
  pathNodes: TopicPathNode[];
  docCount: number;
  verifiedProblemCount: number;
  /** Practice generation constraint, owned per topic (docs/06 §3). */
  wordProblemsOnly: boolean;
  /** The topic's plain-spoken companion doc, or null before generation (perspective spec §7). */
  perspective: { id: string; contentMd: string; createdAt: Date } | null;
  modelDocs: {
    id: string;
    title: string;
    isExemplar: boolean;
    modelCount: number;
    depth: number;
    createdAt: Date;
  }[];
  children: { id: string; name: string; hidden: boolean; favoritedAt: number | null }[];
};

/**
 * A breadcrumb needs the id alongside the name to link each ancestor, while
 * several other callers (prompts, chat context, practice header) only ever
 * wanted the plain name chain. `path` keeps that exact string[] shape so
 * none of those callers has to change; `pathNodes` is additive.
 */
export type TopicPathNode = { id: string; name: string };

/** Root-to-leaf node path (id + name), used by breadcrumbs and the generation progress row. */
export async function getTopicPathNodes(topicId: string): Promise<TopicPathNode[]> {
  // One read of the whole taxonomy, then walk it in memory (D-117). This used
  // to issue a findUnique per level, so a three-deep topic paid three
  // sequential round trips before the page could render.
  const byId = new Map((await allTopicRows()).map((row) => [row.id, row]));

  const pathNodes: TopicPathNode[] = [];
  let currentId: string | null = topicId;

  // The taxonomy is at most a handful of levels deep; the guard is only to
  // make a cyclic parent chain fail loudly instead of hanging.
  for (let depth = 0; currentId && depth < 12; depth += 1) {
    const topic = byId.get(currentId);
    if (!topic) break;
    pathNodes.unshift({ id: topic.id, name: topic.name });
    currentId = topic.parentId;
  }

  return pathNodes;
}

/** Root-to-leaf name path, used by breadcrumbs and the generation progress row. */
export async function getTopicPath(topicId: string): Promise<string[]> {
  const pathNodes = await getTopicPathNodes(topicId);
  return pathNodes.map((node) => node.name);
}

export async function getTopicDetail(topicId: string): Promise<TopicDetail | null> {
  // The ancestor walk now resolves from cached rows, so the root is known
  // before any of the three reads below. That lets all three run at once
  // instead of the old detail -> count -> root-glyph ladder (D-117).
  const pathNodes = await getTopicPathNodes(topicId);
  const rootId = pathNodes[0]?.id ?? topicId;

  const [topic, verifiedProblemCount, root] = await Promise.all([
    prisma.topic.findUnique({
      where: { id: topicId },
      select: {
        id: true,
        name: true,
        slug: true,
        parentId: true,
        description: true,
        wordProblemsOnly: true,
        hidden: true,
        favoritedAt: true,
        perspectiveDoc: { select: { id: true, contentMd: true, createdAt: true } },
        modelDocs: {
          select: {
            id: true,
            title: true,
            isExemplar: true,
            modelIndexJson: true,
            depth: true,
            createdAt: true,
          },
          orderBy: { depth: "asc" },
        },
        children: {
          select: { id: true, name: true, hidden: true, favoritedAt: true },
          orderBy: { name: "asc" },
        },
      },
    }),
    prisma.problem.count({ where: { topicId, verified: true } }),
    // The root owns the emblems; a leaf inherits them. pathNodes[0] IS the root.
    prisma.topic.findUnique({
      where: { id: rootId },
      select: { emoji: true, symbol: { select: { glyph: true } } },
    }),
  ]);
  if (!topic) return null;

  const path = pathNodes.map((node) => node.name);

  return {
    id: topic.id,
    name: topic.name,
    slug: topic.slug,
    glyph: root?.symbol?.glyph ?? DEFAULT_GLYPH,
    emoji: root?.emoji ?? null,
    hidden: topic.hidden,
    favoritedAt: topic.favoritedAt?.getTime() ?? null,
    parentId: topic.parentId,
    description: topic.description,
    path,
    pathNodes,
    docCount: topic.modelDocs.length,
    verifiedProblemCount,
    wordProblemsOnly: topic.wordProblemsOnly,
    perspective: topic.perspectiveDoc,
    modelDocs: topic.modelDocs.map((doc) => ({
      id: doc.id,
      title: doc.title,
      isExemplar: doc.isExemplar,
      modelCount: deserializeModelIndex(doc.modelIndexJson).length,
      depth: doc.depth,
      createdAt: doc.createdAt,
    })),
    children: topic.children.map((child) => ({
      id: child.id,
      name: child.name,
      hidden: child.hidden,
      favoritedAt: child.favoritedAt?.getTime() ?? null,
    })),
  };
}

/**
 * topic id -> its ROOT ancestor's name, for accent lookup. A document under
 * "Distance-Rate-Time" has to take Algebra's cobalt, not an accent hashed from
 * its own leaf name (docs/08: accents are owned by root topics).
 */
export async function getRootNameByTopicId(): Promise<Map<string, string>> {
  const rows = await allTopicRows();
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
    // `verifiedCountsByTopic` is the same read the tree does, and both run on
    // the Learn index. Sharing the cached call drops one round trip (D-117).
    const [topics, docs, problems] = await Promise.all([
      allTopicRows(),
      prisma.mentalModelDoc.groupBy({ by: ["topicId"], _count: { _all: true } }),
      verifiedCountsByTopic(),
    ]);

    const own = new Map<string, DescendantCounts>();
    for (const row of docs) {
      own.set(row.topicId, { docs: row._count._all, verifiedProblems: 0 });
    }
    for (const [topicId, count] of problems) {
      const bucket = own.get(topicId) ?? { docs: 0, verifiedProblems: 0 };
      bucket.verifiedProblems = count;
      own.set(topicId, bucket);
    }
    return rollUpCounts(topics, own);
  },
);
