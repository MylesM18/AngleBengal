import Link from "next/link";
import { notFound } from "next/navigation";

import { DocCard } from "@/components/learn/DocCard";
import { DocMiniTOC } from "@/components/learn/DocMiniTOC";
import { ModelMissList } from "@/components/learn/ModelMissList";
import { MarkdownMath } from "@/components/shared/MarkdownMath";
import { modelMissCounts } from "@/lib/attempts";
import { prisma } from "@/lib/db";
import { deserializeModelIndex } from "@/lib/modelIndex";
import { getTopicDetail } from "@/lib/topics";
import { accentForRoot } from "@/lib/topicColors";

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

  return (
    <div className="mx-auto max-w-[860px] px-8 py-10">
      <Breadcrumb path={topic.path} topicId={topic.id} hasSiblings={false} />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-expanded text-[30px] leading-tight text-ink">{topic.name}</h1>
        <Link
          href={`/practice/${topic.id}`}
          className="rounded-input bg-brand px-3.5 py-2 text-[13.5px] font-semibold text-paper-0 transition-transform hover:bg-brand-deep active:translate-y-px"
        >
          Practice this topic
        </Link>
      </div>

      <p className="mt-2 text-[13px] text-ink-soft">
        {topic.docCount} {topic.docCount === 1 ? "document" : "documents"}
        {" · "}
        {topic.verifiedProblemCount} verified{" "}
        {topic.verifiedProblemCount === 1 ? "problem" : "problems"}
      </p>

      {topic.modelDocs.length === 0 ? (
        <div className="stock-textured mt-8 rounded-card bg-kraft p-6">
          <p className="font-expanded mb-1 text-[16px] text-ink">No models here yet</p>
          <p className="max-w-[48ch] text-[13.5px] leading-relaxed text-ink">
            Generating mental models for a topic arrives in Phase 1. Until then, the seeded
            Distance-Rate-Time document under Algebra shows the shape every generated document
            has to match.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {topic.modelDocs.map((doc) => (
            <DocCard key={doc.id} topicId={topic.id} doc={doc} accent={accent} />
          ))}
        </div>
      )}
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
    <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-1.5 text-[12px]">
      <span className="text-ink-soft">{path.join("  ›  ")}</span>
      {hasSiblings && (
        <Link href={`/learn/${topicId}`} className="ml-2 text-cobalt hover:underline">
          All documents
        </Link>
      )}
    </nav>
  );
}
