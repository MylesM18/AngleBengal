import Link from "next/link";

import { GenerateTopicInput } from "@/components/learn/GenerateTopicInput";
import { TopicCoverCard } from "@/components/learn/TopicCoverCard";
import { TopicRail } from "@/components/learn/TopicRail";
import { Icon } from "@/components/ui/Icon";
import { Sheet } from "@/components/ui/Sheet";
import { prisma } from "@/lib/db";
import { deserializeModelIndex } from "@/lib/modelIndex";
import { accentForRoot } from "@/lib/topicColors";
import { getDescendantCounts, getTopicTree, type DescendantCounts } from "@/lib/topics";

/** Reads the database on every request: the topic tree and doc list change
 *  whenever a document is generated, so this must not be prerendered. */
export const dynamic = "force-dynamic";

/** Spec 3a: the eight most recent documents, one row each. */
const RECENT_TAKE = 8;
/** Spec 3a fallback: past this many roots the cover grid stops reading as a shelf. */
const COVER_GRID_MAX_ROOTS = 12;
const ZERO: DescendantCounts = { docs: 0, verifiedProblems: 0 };

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/**
 * Learn index (spec 3a): a cover per root topic with its descendant doc count
 * as the numeral, the generate action, and the recent documents so the seeded
 * exemplar is one click from the front door.
 */
export default async function LearnIndexPage() {
  const [tree, counts, rootOrder, docs] = await Promise.all([
    getTopicTree(),
    getDescendantCounts(),
    // Seed order (creation order), not the tree's alphabetical order: the
    // taxonomy reads Arithmetic before Algebra on purpose.
    prisma.topic.findMany({
      where: { parentId: null },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.mentalModelDoc.findMany({
      select: {
        id: true,
        title: true,
        isExemplar: true,
        modelIndexJson: true,
        createdAt: true,
        topic: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: RECENT_TAKE,
    }),
  ]);

  const rootById = new Map(tree.map((root) => [root.id, root]));
  const roots = rootOrder.flatMap((row) => {
    const root = rootById.get(row.id);
    return root ? [root] : [];
  });

  return (
    <div className="h-full overflow-y-auto p-2">
      <div className="grid grid-cols-1 gap-6 pt-8 sm:pt-16 lg:grid-cols-[minmax(280px,1fr)_2fr]">
        <header>
          <h1 className="display-cut text-display text-ink">Learn</h1>
          <p className="mt-3 max-w-[40ch] text-ui text-ink-soft">
            Mental models for any math topic, filed into a tree you can browse. Open a cover, or
            generate a new set.
          </p>
          <GenerateTopicInput />
        </header>

        <section aria-labelledby="learn-topics">
          <h2 id="learn-topics" className="sr-only">
            Topics
          </h2>

          {roots.length > COVER_GRID_MAX_ROOTS ? (
            <Sheet tone="paper-1" className="animate-enter-sheet py-2">
              <TopicRail topics={tree} />
            </Sheet>
          ) : (
            <ul aria-label="Topic covers" className="animate-enter-sheet grid grid-cols-1 gap-6 sm:grid-cols-2">
              {roots.map((root) => {
                const c = counts.get(root.id) ?? ZERO;
                return (
                  <li key={root.id}>
                    <TopicCoverCard
                      href={`/learn/${root.id}`}
                      name={root.name}
                      numeral={c.docs}
                      meta={`${plural(c.docs, "model")} · ${plural(c.verifiedProblems, "problem")}`}
                      accent={accentForRoot(root.name)}
                    />
                  </li>
                );
              })}
            </ul>
          )}

          <h2 className="meta-caps mt-10 text-ink-soft">Recent</h2>
          <Sheet tone="paper-1" className="mt-2 overflow-hidden">
            {docs.length === 0 ? (
              <p className="px-4 py-6 text-ui text-ink-soft">
                No documents yet. Generate one, or run <code>npx prisma db seed</code> to load the
                exemplar.
              </p>
            ) : (
              <ul className="divide-y divide-hairline">
                {docs.map((doc) => {
                  const modelCount = deserializeModelIndex(doc.modelIndexJson).length;
                  return (
                    <li key={doc.id}>
                      <Link
                        href={`/learn/${doc.topic.id}?doc=${doc.id}`}
                        className="flex items-start gap-3 px-4 py-3 transition-colors duration-150 ease-paper hover:bg-paper-0"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-meta text-ink-soft">
                            {doc.topic.name} · {plural(modelCount, "model")}
                            {doc.isExemplar ? " · Exemplar" : ""}
                            {" · "}
                            {doc.createdAt.toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </p>
                          <p className="truncate text-ui font-medium text-ink">{doc.title}</p>
                        </div>
                        <Icon name="plus" className="mt-0.5 shrink-0 text-ink-soft" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Sheet>
        </section>
      </div>
    </div>
  );
}
