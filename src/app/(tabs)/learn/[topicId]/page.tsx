import { notFound } from "next/navigation";

import { Breadcrumb } from "@/components/learn/Breadcrumb";
import { DocCard } from "@/components/learn/DocCard";
import { DocMiniTOC } from "@/components/learn/DocMiniTOC";
import { DocReader } from "@/components/learn/DocReader";
import { GenerateTopicInput } from "@/components/learn/GenerateTopicInput";
import { ModelMissList } from "@/components/learn/ModelMissList";
import { TopicCoverCard } from "@/components/learn/TopicCoverCard";
import { ButtonLink, buttonClasses } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Sheet } from "@/components/ui/Sheet";
import { modelMissCounts } from "@/lib/attempts";
import { prisma } from "@/lib/db";
import { deserializeModelIndex } from "@/lib/modelIndex";
import { getDescendantCounts, getTopicDetail } from "@/lib/topics";
import { ACCENT_VAR, accentForRoot, glyphForRoot } from "@/lib/topicColors";

type Params = { topicId: string };
type Search = { doc?: string };

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
  const { doc: requestedDocId } = await searchParams;

  const topic = await getTopicDetail(topicId);
  if (!topic) notFound();

  const accent = accentForRoot(topic.path[0] ?? topic.name);
  const glyph = glyphForRoot(topic.path[0] ?? topic.name);

  const selectedDocId =
    requestedDocId && topic.modelDocs.some((d) => d.id === requestedDocId)
      ? requestedDocId
      : topic.modelDocs.length === 1
        ? topic.modelDocs[0].id
        : null;

  if (selectedDocId) {
    const doc = await prisma.mentalModelDoc.findUnique({
      where: { id: selectedDocId },
      select: { id: true, title: true, contentMd: true, modelIndexJson: true, isExemplar: true },
    });
    if (!doc) notFound();

    const index = deserializeModelIndex(doc.modelIndexJson);
    const misses = await modelMissCounts(doc.id);
    const lastAttempt = await prisma.attempt.findFirst({
      where: { problem: { topicId: topic.id } },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    const lastPracticed = lastAttempt
      ? `Last practiced ${lastAttempt.createdAt.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })}`
      : "Not practiced yet";

    return (
      <article className="flex justify-center gap-8 px-3 py-6 sm:px-8 sm:py-10">
        <div className="min-w-0 max-w-[68ch] flex-1">
          <div className="mb-4 flex items-center justify-between gap-4 [&>nav]:mb-0">
            <Breadcrumb pathNodes={topic.pathNodes} topicId={topic.id} hasSiblings={topic.docCount > 1} />
            <ButtonLink href={`/learn/${topic.id}/history`} variant="tertiary" size="sm">
              History
            </ButtonLink>
          </div>

          <Sheet tone="paper-0" className="animate-enter-sheet overflow-hidden">
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
            </div>

            <div className="px-4 py-6 sm:px-8 sm:py-8">
              <ModelMissList misses={misses} />
              <DocReader contentMd={doc.contentMd} models={index} accent={accent} />
            </div>
          </Sheet>
        </div>

        {/* `xl`, not `lg`: at the lg edge the 320px topic rail and this 210px
            column both appeared and left the reading measure at 374px. See D-061. */}
        <div className="hidden xl:block">
          <DocMiniTOC entries={index} accent={accent} />
        </div>
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
                    glyph={glyph}
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
