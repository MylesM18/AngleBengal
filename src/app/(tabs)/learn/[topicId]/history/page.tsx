import Link from "next/link";
import { notFound } from "next/navigation";

import { Breadcrumb } from "@/components/learn/Breadcrumb";
import { MarkdownMath } from "@/components/shared/MarkdownMath";
import { ButtonLink } from "@/components/ui/Button";
import { ChipLink, chipClasses } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { Sheet } from "@/components/ui/Sheet";
import { attemptHistory, attemptSummary } from "@/lib/attempts";
import { cx } from "@/lib/cx";
import { prisma } from "@/lib/db";
import { getTopicDetail } from "@/lib/topics";

export const dynamic = "force-dynamic";

type Params = { topicId: string };
type Search = { model?: string; doc?: string };

const TIME_FORMAT: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
};

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/**
 * Attempt history for one topic (spec 3e): one paper-1 sheet of hairline
 * rows, a check or cross per attempt, the blamed model as a chip, and the
 * wedge EmptyState when nothing has been practised yet. `?model=N` filters
 * to the attempts blamed on that model.
 */
export default async function HistoryPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const { topicId } = await params;
  const { model } = await searchParams;
  const topic = await getTopicDetail(topicId);
  if (!topic) notFound();

  const modelNumber = model ? Number.parseInt(model, 10) : undefined;
  const filtered = Number.isInteger(modelNumber) ? modelNumber : undefined;
  const [attempts, summary, feynmanSessions] = await Promise.all([
    attemptHistory(topicId, filtered !== undefined ? { modelNumber: filtered } : {}),
    attemptSummary(topicId),
    prisma.feynmanSession.findMany({
      where: { doc: { topicId } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        createdAt: true,
        accuracy: true,
        simplicity: true,
        coverage: true,
        doc: { select: { title: true } },
      },
    }),
  ]);

  const title = filtered !== undefined ? `Attempts blamed on Model ${filtered}` : "Attempt history";
  const emptyLine =
    filtered !== undefined
      ? "No attempt has been attributed to this model."
      : "Attempts show up here once you have practised this topic.";

  return (
    <div className="mx-auto max-w-[860px] px-4 pt-8 pb-10 sm:px-8 sm:pt-16">
      <Breadcrumb pathNodes={topic.pathNodes} topicId={topic.id} hasSiblings={false} />
      <h1 className="display-cut text-h1 text-ink">{title}</h1>
      <p className="mt-2 text-meta text-ink-soft">
        {plural(summary.total, "attempt")} on this topic · {summary.correct} correct · {summary.diagnosed}{" "}
        diagnosed to a model
      </p>
      {filtered !== undefined ? (
        <ButtonLink href={`/learn/${topicId}/history`} variant="tertiary" size="sm" className="mt-3">
          Show all attempts
        </ButtonLink>
      ) : null}

      {attempts.length === 0 ? (
        <EmptyState
          shape="wedge"
          accent="var(--color-brand)"
          title="Nothing here yet"
          line={emptyLine}
          action={
            <ButtonLink href={`/practice/${topicId}`} size="md">
              Practise this topic
            </ButtonLink>
          }
          className="mt-6"
        />
      ) : (
        <Sheet tone="paper-1" className="mt-6 overflow-hidden">
          <ul className="divide-y divide-hairline">
            {attempts.map((a) => (
              <li key={a.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span
                    className={cx(
                      "inline-flex items-center gap-1 text-ui font-semibold",
                      a.correct ? "text-green" : "text-red",
                    )}
                  >
                    <Icon name={a.correct ? "check" : "cross"} size={14} />
                    {a.correct ? "Correct" : "Wrong"}
                  </span>
                  <span className="text-ui text-ink">
                    You answered <strong>{a.submittedAnswer}</strong>
                  </span>
                  {a.diagnosedModelNum !== null ? (
                    a.learnHref ? (
                      <ChipLink href={a.learnHref} variant="action" title={a.diagnosedModelTitle ?? undefined}>
                        Model {a.diagnosedModelNum}
                      </ChipLink>
                    ) : (
                      <span className={chipClasses({ variant: "meta" })} title={a.diagnosedModelTitle ?? undefined}>
                        Model {a.diagnosedModelNum}
                      </span>
                    )
                  ) : null}
                  <span className="ml-auto text-meta text-ink-soft">
                    Difficulty {a.difficulty}
                    {a.hasSketch ? " · sketch attached" : ""} · {a.createdAt.toLocaleString("en-US", TIME_FORMAT)}
                  </span>
                </div>
                <div className="mt-1.5 max-w-[70ch] text-ink-soft">
                  <MarkdownMath variant="ui">{a.statementMd}</MarkdownMath>
                </div>
                {!a.correct && a.diagnosedModelNum !== null && a.diagnosisSymptom ? (
                  <p className="mt-1.5 text-ui text-ink-soft">{a.diagnosisSymptom}</p>
                ) : null}
                {!a.correct && a.diagnosedModelNum === null ? (
                  <p className="mt-1.5 text-ui text-ink-soft">Not attributed to a model.</p>
                ) : null}
              </li>
            ))}
          </ul>
        </Sheet>
      )}

      {feynmanSessions.length > 0 ? (
        <>
          <h2 className="meta-caps mt-10">Explanations</h2>
          <Sheet tone="paper-1" className="mt-3 overflow-hidden">
            <ul className="divide-y divide-hairline">
              {feynmanSessions.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/learn/${topicId}/feynman/${s.id}`}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 hover:bg-paper-0"
                  >
                    <span className="text-ui font-medium text-ink">{s.doc.title}</span>
                    <span className="text-ui text-ink-soft">
                      Accuracy {s.accuracy} · Simplicity {s.simplicity} · Coverage {s.coverage}
                    </span>
                    <span className="ml-auto text-meta text-ink-soft">
                      {s.createdAt.toLocaleString("en-US", TIME_FORMAT)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Sheet>
        </>
      ) : null}
    </div>
  );
}
