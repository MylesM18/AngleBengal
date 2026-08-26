import Link from "next/link";

import { getRootNameByTopicId, getTopicTree, type TopicNode } from "@/lib/topics";
import { accentForRoot, ACCENT_VAR } from "@/lib/topicColors";

/** Reads the database on every request: problem pools and documents change
 *  whenever one is generated, so this must not be prerendered. */
export const dynamic = "force-dynamic";

function flatten(nodes: TopicNode[]): TopicNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children)]);
}

/**
 * Practice landing: no topic selected yet. The practice loop itself lives at
 * /practice/[topicId], so this route's only job is to get you into one.
 *
 * It lists two groups rather than one, because a topic needs a model document
 * before problems can be generated against it: topics whose pool is already
 * verified, and topics that have models but no pool yet. Showing only the
 * first would leave this page empty until something had been practised, which
 * is what made the Phase 0 placeholder read as broken (DECISIONS.md D-044).
 */
export default async function PracticeIndexPage() {
  const [tree, rootNames] = await Promise.all([getTopicTree(), getRootNameByTopicId()]);
  const topics = flatten(tree);

  const ready = topics
    .filter((topic) => topic.verifiedProblemCount > 0)
    .sort((a, b) => b.verifiedProblemCount - a.verifiedProblemCount);
  const needsProblems = topics
    .filter((topic) => topic.verifiedProblemCount === 0 && topic.docCount > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    /*
     * Same shape as /learn and /settings: an `h-full overflow-y-auto` scroller
     * (the shell's <main> is `overflow-hidden`, so every page brings its own),
     * with the compact padding pass on the inner column. At `sm` and up the
     * outer padding collapses to nothing and the column keeps today's exact
     * `px-8 py-10`; below `sm` it is 8px of side padding and a 32px top, which
     * is what /learn uses at the same breakpoint.
     */
    <div className="h-full overflow-y-auto p-2 sm:p-0">
      <div className="mx-auto max-w-[760px] py-8 sm:px-8 sm:py-10">
        <h1 className="display-cut text-h1 leading-tight text-ink">Practice</h1>
        <p className="mt-2 max-w-[54ch] text-ui leading-relaxed text-ink-soft">
          Verified problems tagged to the models they exercise. A wrong answer is diagnosed
          back to the model that failed, so pick the topic you want to be tested on.
        </p>

        {ready.length === 0 && needsProblems.length === 0 ? (
          <div className="stock-textured mt-8 rounded-card bg-kraft p-5">
            <p className="font-expanded mb-1 text-ui-lg text-ink">No topics are ready yet</p>
            <p className="max-w-[50ch] text-ui leading-relaxed text-ink">
              Problems are generated against a topic&apos;s mental models, so a topic needs a
              document first. Generate one from the{" "}
              <Link href="/learn" className="text-cobalt hover:underline">
                Learn tab
              </Link>
              , then come back here.
            </p>
          </div>
        ) : null}

        {ready.length > 0 && (
          <section className="mt-8">
            <h2 className="meta-caps mb-3 text-ink-soft">Ready to practice</h2>
            <ul className="flex flex-col gap-2">
              {ready.map((topic) => (
                <TopicRow
                  key={topic.id}
                  topic={topic}
                  rootName={rootNames.get(topic.id) ?? topic.name}
                  detail={`${topic.verifiedProblemCount} verified ${
                    topic.verifiedProblemCount === 1 ? "problem" : "problems"
                  }`}
                />
              ))}
            </ul>
          </section>
        )}

        {needsProblems.length > 0 && (
          <section className="mt-8">
            <h2 className="meta-caps mb-3 text-ink-soft">Models ready, no problems yet</h2>
            <p className="mb-3 max-w-[54ch] text-ui leading-relaxed text-ink-soft">
              These topics have mental models but an empty problem pool. Opening one offers to
              generate and verify a first set.
            </p>
            <ul className="flex flex-col gap-2">
              {needsProblems.map((topic) => (
                <TopicRow
                  key={topic.id}
                  topic={topic}
                  rootName={rootNames.get(topic.id) ?? topic.name}
                  detail={`${topic.docCount} ${topic.docCount === 1 ? "document" : "documents"}`}
                  muted
                />
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

function TopicRow({
  topic,
  rootName,
  detail,
  muted = false,
}: {
  topic: TopicNode;
  rootName: string;
  detail: string;
  muted?: boolean;
}) {
  const accent = accentForRoot(rootName);
  return (
    <li>
      <Link
        href={`/practice/${topic.id}`}
        className={`flex items-center gap-3 rounded-card p-3.5 shadow-sheet transition-all hover:-translate-y-px hover:shadow-lift ${
          muted ? "bg-paper-1/70" : "bg-paper-1"
        }`}
      >
        <span
          aria-hidden
          className="h-9 w-1.5 shrink-0 rounded-chip"
          style={{ backgroundColor: ACCENT_VAR[accent] }}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-ui font-semibold text-ink">{topic.name}</span>
          <span className="block text-meta text-ink-soft">
            {rootName === topic.name ? detail : `${rootName} · ${detail}`}
          </span>
        </span>
      </Link>
    </li>
  );
}
