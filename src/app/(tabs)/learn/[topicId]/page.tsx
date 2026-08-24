import Link from "next/link";
import { notFound } from "next/navigation";

import { DocCard } from "@/components/learn/DocCard";
import { DocMiniTOC } from "@/components/learn/DocMiniTOC";
import { GenerateTopicInput } from "@/components/learn/GenerateTopicInput";
import { ModelMissList } from "@/components/learn/ModelMissList";
import { TopicCoverCard } from "@/components/learn/TopicCoverCard";
import { MarkdownMath } from "@/components/shared/MarkdownMath";
import { ButtonLink, buttonClasses } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { modelMissCounts } from "@/lib/attempts";
import { prisma } from "@/lib/db";
import { deserializeModelIndex } from "@/lib/modelIndex";
import { getDescendantCounts, getTopicDetail } from "@/lib/topics";
import { ACCENT_VAR, accentForRoot } from "@/lib/topicColors";

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

    return (
      <article className="flex justify-center gap-8 px-8 py-10">
        <div className="min-w-0 max-w-[68ch] flex-1">
          <Breadcrumb path={topic.path} topicId={topic.id} hasSiblings={topic.docCount > 1} />

          <div className="mb-3 flex items-center gap-2">
            {doc.isExemplar && (
              <span className="meta-caps inline-block rounded-chip bg-brand-tint px-2 py-0.5 text-[10px] text-brand-deep">
                Exemplar
              </span>
            )}
            <Link
              href={`/learn/${topic.id}/history`}
              className="text-[12px] text-cobalt hover:underline"
            >
              Attempt history
            </Link>
          </div>

          <ModelMissList misses={misses} topicId={topic.id} docId={doc.id} />

          <div className="rounded-card bg-paper-0 px-8 py-8 shadow-sheet">
            <MarkdownMath>{doc.contentMd}</MarkdownMath>
          </div>
        </div>

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
    <div className="mx-auto max-w-[860px] px-8 pt-16 pb-10">
      <Breadcrumb path={topic.path} topicId={topic.id} hasSiblings={false} />
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
                    numeral={c.docs}
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

function Breadcrumb({
  path,
  topicId,
  hasSiblings,
}: {
  path: string[];
  topicId: string;
  hasSiblings: boolean;
}) {
  return (
    <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-1.5 text-meta">
      <span className="text-ink-soft">{path.join("  ›  ")}</span>
      {hasSiblings && (
        <Link href={`/learn/${topicId}`} className="ml-2 text-cobalt hover:underline">
          All documents
        </Link>
      )}
    </nav>
  );
}

const ZERO = { docs: 0, verifiedProblems: 0 };

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}
