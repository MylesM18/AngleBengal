import Link from "next/link";
import { notFound } from "next/navigation";

import { MarkdownMath } from "@/components/shared/MarkdownMath";
import { attemptHistory, attemptSummary } from "@/lib/attempts";
import { getTopicDetail } from "@/lib/topics";

export const dynamic = "force-dynamic";

/**
 * Attempt history for a topic (docs/07 Phase 5), optionally narrowed to the
 * attempts one model was blamed for. That filtered view is what the miss
 * counts on a document link to.
 */
export default async function HistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ topicId: string }>;
  searchParams: Promise<{ model?: string; doc?: string }>;
}) {
  const { topicId } = await params;
  const { model } = await searchParams;

  const topic = await getTopicDetail(topicId);
  if (!topic) notFound();

  const modelNumber = model ? Number.parseInt(model, 10) : undefined;
  const filtered = Number.isInteger(modelNumber) ? modelNumber : undefined;

  const [attempts, summary] = await Promise.all([
    attemptHistory(topicId, filtered !== undefined ? { modelNumber: filtered } : {}),
    attemptSummary(topicId),
  ]);

  return (
    <div className="mx-auto max-w-[860px] px-8 py-10">
      <nav aria-label="Breadcrumb" className="mb-3 text-[12px] text-ink-soft">
        {topic.path.join("  ›  ")}
      </nav>

      <h1 className="font-expanded text-[30px] leading-tight text-ink">
        {filtered !== undefined ? `Attempts blamed on Model ${filtered}` : "Attempt history"}
      </h1>

      <p className="mt-2 text-[13px] text-ink-soft">
        {summary.total} attempt{summary.total === 1 ? "" : "s"} on this topic ·{" "}
        {summary.correct} correct · {summary.diagnosed} diagnosed to a model
      </p>

      {filtered !== undefined && (
        <Link
          href={`/learn/${topicId}/history`}
          className="mt-2 inline-block text-[12.5px] text-cobalt hover:underline"
        >
          Show all attempts
        </Link>
      )}

      {attempts.length === 0 ? (
        <div className="stock-textured mt-6 rounded-card bg-kraft p-6">
          <p className="font-expanded mb-1 text-[16px] text-ink">Nothing here yet</p>
          <p className="max-w-[50ch] text-[13px] leading-relaxed text-ink">
            {filtered !== undefined
              ? "No attempt has been attributed to this model."
              : "Attempts show up here once you have practised this topic."}
          </p>
          <Link
            href={`/practice/${topicId}`}
            className="mt-4 inline-block rounded-input bg-brand px-3.5 py-2 text-[13px] font-semibold text-paper-0 hover:bg-brand-deep"
          >
            Practise this topic
          </Link>
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-2">
          {attempts.map((attempt) => (
            <li
              key={attempt.id}
              className="overflow-hidden rounded-card bg-paper-1 shadow-sheet"
            >
              <div
                className={`border-l-[4px] px-4 py-3 ${
                  attempt.correct ? "border-green" : "border-red"
                }`}
              >
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span
                    className={`text-[12.5px] font-bold ${
                      attempt.correct ? "text-green" : "text-red"
                    }`}
                  >
                    {attempt.correct ? "✓ Correct" : "✗ Wrong"}
                  </span>
                  <span className="text-[12.5px] text-ink">
                    You answered <strong>{attempt.submittedAnswer}</strong>
                  </span>
                  <span className="ml-auto text-[11.5px] text-ink-soft">
                    Difficulty {attempt.difficulty}
                    {attempt.hasSketch && " · sketch attached"}
                    {" · "}
                    {attempt.createdAt.toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                <div className="mt-1.5 max-w-[70ch] text-ink-soft">
                  <MarkdownMath className="text-[12.5px]">
                    {attempt.statementMd}
                  </MarkdownMath>
                </div>

                {!attempt.correct && (
                  <p className="mt-1.5 text-[12.5px]">
                    {attempt.diagnosedModelNum !== null ? (
                      <>
                        <span className="text-ink-soft">{attempt.diagnosisSymptom}</span>{" "}
                        {attempt.learnHref ? (
                          <Link href={attempt.learnHref} className="text-cobalt hover:underline">
                            Model {attempt.diagnosedModelNum}: {attempt.diagnosedModelTitle}
                          </Link>
                        ) : (
                          <span className="text-ink">
                            Model {attempt.diagnosedModelNum}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-ink-soft">Not attributed to a model.</span>
                    )}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
