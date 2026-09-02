import { notFound } from "next/navigation";

import { Breadcrumb } from "@/components/learn/Breadcrumb";
import { CopyLinkToaster } from "@/components/learn/CopyLinkToaster";
import { DocBody } from "@/components/learn/DocBody";
import { DocCard } from "@/components/learn/DocCard";
import { DocMiniTOC } from "@/components/learn/DocMiniTOC";
import { DocCompleteStrip, DocProgressProvider } from "@/components/learn/DocProgress";
import { DocTabStrip } from "@/components/learn/DocTabStrip";
import { FocusToggle } from "@/components/learn/FocusToggle";
import { GenerateMoreStudy } from "@/components/learn/GenerateMoreStudy";
import { GenerateTopicInput } from "@/components/learn/GenerateTopicInput";
import { ModelMissList } from "@/components/learn/ModelMissList";
import { PerspectiveTabs } from "@/components/learn/PerspectiveTabs";
import { RevealScope } from "@/components/learn/RevealScope";
import { TopicCoverCard } from "@/components/learn/TopicCoverCard";
import { ButtonLink, buttonClasses } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Sheet } from "@/components/ui/Sheet";
import { modelMissCounts } from "@/lib/attempts";
import { prisma } from "@/lib/db";
import { getDocCards } from "@/lib/learn/docCards";
import { parseDocTabs } from "@/lib/learn/docTabs";
import { deserializeModelIndex } from "@/lib/modelIndex";
import { checkpointAvailability } from "@/lib/problems/serve";
import { getDescendantCounts, getTopicDetail } from "@/lib/topics";
import { ACCENT_VAR, accentForRoot } from "@/lib/topicColors";

type Params = { topicId: string };
type Search = { doc?: string; docs?: string; active?: string; new?: string };

/**
 * A topic, and optionally one of its documents.
 *
 * When the topic holds exactly one document it opens directly rather than
 * showing a one-card list (DECISIONS.md D-008), which is what makes
 * "opening Distance-Rate-Time shows the exemplar" true in one click.
 */
export default async function TopicPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const { topicId } = await params;
  const search = await searchParams;

  const topic = await getTopicDetail(topicId);
  if (!topic) notFound();

  const accent = accentForRoot(topic.path[0] ?? topic.name);

  const tabs = parseDocTabs(search, topic.modelDocs.map((doc) => doc.id));
  // D-008 is untouched: a topic holding exactly one document still opens it
  // directly rather than showing a one-card grid. A topic with a chain has
  // more than one document, so it keeps its index page.
  const openIds =
    tabs.open.length > 0
      ? tabs.open
      : topic.modelDocs.length === 1
        ? [topic.modelDocs[0].id]
        : [];
  const selectedDocId = tabs.active ?? openIds[0] ?? null;

  if (selectedDocId) {
    const doc = await prisma.mentalModelDoc.findUnique({
      where: { id: selectedDocId },
      select: {
        id: true,
        title: true,
        contentMd: true,
        modelIndexJson: true,
        isExemplar: true,
        depth: true,
      },
    });
    if (!doc) notFound();

    const index = deserializeModelIndex(doc.modelIndexJson);
    // Independent reads, so they go together: awaiting them in turn cost two
    // round trips to the pooler before this page could render (D-117).
    const [misses, lastAttempt, cards, availability, initialRead] = await Promise.all([
      modelMissCounts(doc.id),
      prisma.attempt.findFirst({
        where: { problem: { topicId: topic.id } },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      // Spec 9.2: an extractor failure renders the doc cardless, never broken.
      getDocCards(doc.id, doc.contentMd, index).catch(() => null),
      checkpointAvailability(doc.id).catch(() => null),
      // Spec 9.2: a failed read renders everything unread rather than blocking.
      prisma.docReadProgress
        .findMany({ where: { docId: doc.id }, select: { modelNumber: true } })
        .then((rows) => rows.map((row) => row.modelNumber))
        .catch(() => [] as number[]),
    ]);
    const lastPracticed = lastAttempt
      ? `Last practiced ${lastAttempt.createdAt.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })}`
      : "Not practiced yet";

    const tabLabels = topic.modelDocs
      .filter((entry) => openIds.includes(entry.id))
      .map((entry) => ({ id: entry.id, depth: entry.depth, isExemplar: entry.isExemplar }))
      .sort((a, b) => openIds.indexOf(a.id) - openIds.indexOf(b.id));

    return (
      <article className="flex justify-center gap-8 px-3 py-6 sm:px-8 sm:py-10">
        <DocProgressProvider docId={doc.id} entries={index} initialRead={initialRead}>
        <div className="min-w-0 max-w-[68ch] flex-1">
          <div className="focus-hide mb-4 flex items-center justify-between gap-4 [&>nav]:mb-0">
            <Breadcrumb pathNodes={topic.pathNodes} topicId={topic.id} hasSiblings={topic.docCount > 1} />
            <span className="flex items-center gap-2">
              <FocusToggle />
              <ButtonLink href={`/learn/${topic.id}/history`} variant="tertiary" size="sm">
                History
              </ButtonLink>
            </span>
          </div>

          <Sheet tone="paper-0" className="animate-enter-sheet overflow-hidden">
            <PerspectiveTabs
              topicId={topic.id}
              perspective={topic.perspective ? { contentMd: topic.perspective.contentMd } : null}
              autoFire={search.new === "1" && !topic.perspective}
            >
              <div className="focus-hide">
                <DocTabStrip topicId={topic.id} tabs={tabLabels} activeId={doc.id} />
              </div>

              <h1 className="display-cut px-4 pb-5 pt-6 text-h1 text-ink sm:px-8 sm:pt-8">{doc.title}</h1>

              <div className="stock-textured flex flex-wrap items-center gap-3 border-y border-hairline bg-kraft px-4 py-2.5 text-meta text-ink sm:px-8">
                {doc.isExemplar && (
                  <span className="inline-flex h-6 items-center rounded-chip bg-paper-0 px-2 text-ui font-medium text-ink">
                    Exemplar
                  </span>
                )}
                <span>
                  {index.length} {index.length === 1 ? "model" : "models"}
                </span>
                <span>{lastPracticed}</span>
                <span className="ml-auto">
                  <GenerateMoreStudy topicId={topic.id} sourceDocId={doc.id} openIds={openIds} />
                </span>
              </div>

              <div className="px-4 py-6 sm:px-8 sm:py-8">
                <RevealScope replayKey={doc.id}>
                  <ModelMissList misses={misses} />
                  <CopyLinkToaster>
                    <DocBody
                      docId={doc.id}
                      contentMd={doc.contentMd}
                      models={index}
                      accent={accent}
                      cards={cards}
                      availability={availability}
                    />
                  </CopyLinkToaster>
                  <DocCompleteStrip topicId={topic.id} />
                </RevealScope>
              </div>
            </PerspectiveTabs>
          </Sheet>
        </div>

        {/* `xl`, not `lg`: at the lg edge the 320px topic rail and this 210px
            column both appeared and left the reading measure at 374px. See D-061. */}
        <div className="hidden xl:block">
          <DocMiniTOC entries={index} accent={accent} />
        </div>
        </DocProgressProvider>
      </article>
    );
  }

  const counts = await getDescendantCounts();
  const totals = counts.get(topic.id) ?? ZERO;
  const canPractice = totals.verifiedProblems > 0;
  const empty = topic.modelDocs.length === 0 && topic.children.length === 0;
  const countLine = [
    plural(totals.docs, "model document"),
    plural(totals.verifiedProblems, "verified problem"),
    ...(topic.children.length > 0 ? [plural(topic.children.length, "subtopic")] : []),
  ].join(" · ");

  return (
    <div className="mx-auto max-w-[860px] px-4 pt-8 pb-10 sm:px-8 sm:pt-16">
      <Breadcrumb pathNodes={topic.pathNodes} topicId={topic.id} hasSiblings={false} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="display-cut text-h1 text-ink">{topic.name}</h1>
        {canPractice ? (
          <ButtonLink href={`/practice/${topic.id}`} size="md">
            Practice this topic
          </ButtonLink>
        ) : (
          <span
            aria-disabled="true"
            title="No verified problems beneath this topic yet"
            className={buttonClasses({
              variant: "primary",
              size: "md",
              tone: "brand",
              className: "pointer-events-none opacity-50",
            })}
          >
            Practice this topic
          </span>
        )}
      </div>
      <p className="mt-2 text-meta text-ink-soft">{countLine}</p>

      {topic.modelDocs.length > 0 ? (
        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
          {topic.modelDocs.map((doc) => (
            <DocCard key={doc.id} topicId={topic.id} doc={doc} accent={accent} />
          ))}
        </div>
      ) : null}

      {topic.children.length > 0 ? (
        <>
          <h2 className="meta-caps mt-10">Subtopics</h2>
          <ul aria-label="Subtopics" className="mt-3 grid grid-cols-1 gap-6 sm:grid-cols-2">
            {topic.children.map((child) => {
              const c = counts.get(child.id) ?? ZERO;
              return (
                <li key={child.id}>
                  <TopicCoverCard
                    href={`/learn/${child.id}`}
                    name={child.name}
                    glyph={topic.glyph}
                    meta={`${plural(c.docs, "model")} · ${plural(c.verifiedProblems, "problem")}`}
                    accent={accent}
                  />
                </li>
              );
            })}
          </ul>
        </>
      ) : null}

      {empty ? (
        <EmptyState
          shape="wedge"
          accent={ACCENT_VAR[accent]}
          title="No models here yet"
          line="Generate the first mental model document for this topic."
          action={<GenerateTopicInput initialValue={topic.name} compact />}
          className="mt-8"
        />
      ) : null}
    </div>
  );
}

const ZERO = { docs: 0, verifiedProblems: 0 };

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}
