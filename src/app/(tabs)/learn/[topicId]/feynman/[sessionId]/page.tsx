import { notFound } from "next/navigation";

import { Breadcrumb } from "@/components/learn/Breadcrumb";
import { MarkdownMath } from "@/components/shared/MarkdownMath";
import { BackButton } from "@/components/ui/BackButton";
import { ButtonLink } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import type { FeynmanReport } from "@/lib/ai/schemas";
import { prisma } from "@/lib/db";
import { anchorForModel } from "@/lib/modelIndex";
import { getTopicDetail } from "@/lib/topics";

export const dynamic = "force-dynamic";

const TIME_FORMAT: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
};

const VERDICT_LABELS = {
  solid: "Solid",
  wobbly: "Wobbly",
  missing: "Missing",
} as const;

type Exchange = { question: string; answer: string };
type SessionReport = FeynmanReport & { coverage: number };

function parseSessionJson(
  exchangesJson: string,
  reportJson: string,
): { exchanges: Exchange[]; report: SessionReport } | null {
  // Archived JSON is trusted at write time (Task 7 persists exactly what it
  // rendered), but a parse failure must 404, never crash.
  try {
    return {
      exchanges: JSON.parse(exchangesJson) as Exchange[],
      report: JSON.parse(reportJson) as SessionReport,
    };
  } catch {
    return null;
  }
}

export default async function FeynmanSessionPage({
  params,
}: {
  params: Promise<{ topicId: string; sessionId: string }>;
}) {
  const { topicId, sessionId } = await params;

  const [topic, session] = await Promise.all([
    getTopicDetail(topicId),
    prisma.feynmanSession.findUnique({
      where: { id: sessionId },
      select: {
        explanation: true,
        exchangesJson: true,
        reportJson: true,
        createdAt: true,
        doc: { select: { id: true, title: true, topicId: true } },
      },
    }),
  ]);
  if (!topic || !session || session.doc.topicId !== topicId) {
    notFound();
  }
  const parsed = parseSessionJson(session.exchangesJson, session.reportJson);
  if (!parsed) {
    notFound();
  }
  const { exchanges, report } = parsed;

  return (
    <div className="mx-auto max-w-[860px] px-4 pt-8 pb-10 sm:px-8 sm:pt-16">
      <div className="mb-3 flex flex-wrap items-center gap-2 [&>nav]:mb-0">
        <BackButton fallbackHref={`/learn/${topic.id}`} />
        <Breadcrumb pathNodes={topic.pathNodes} topicId={topic.id} hasSiblings={false} />
      </div>
      <h1 className="display-cut text-h1 text-ink">Gap report</h1>
      <p className="mt-2 text-meta text-ink-soft">
        {session.doc.title} · {session.createdAt.toLocaleString("en-US", TIME_FORMAT)}
      </p>

      <Sheet tone="paper-1" className="mt-6 overflow-hidden">
        <ul className="divide-y divide-hairline">
          {report.verdicts.map((verdict) => (
            <li key={verdict.modelNumber} className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-ui font-semibold text-ink">
                  Model {verdict.modelNumber}: {VERDICT_LABELS[verdict.verdict]}
                </span>
                <span className="ml-auto">
                  <ButtonLink
                    href={`/learn/${topicId}?doc=${session.doc.id}#${anchorForModel(verdict.modelNumber)}`}
                    variant="tertiary"
                    size="sm"
                  >
                    Reread Model {verdict.modelNumber}
                  </ButtonLink>
                </span>
              </div>
              <div className="mt-1.5 max-w-[70ch] text-ink-soft">
                <MarkdownMath variant="ui">{verdict.symptom}</MarkdownMath>
              </div>
            </li>
          ))}
        </ul>
      </Sheet>

      <p className="mt-4 text-ui text-ink">
        Accuracy {report.accuracy} · Simplicity {report.simplicity} · Coverage{" "}
        {report.coverage}
      </p>

      <h2 className="meta-caps mt-10">Your explanation</h2>
      <div className="mt-2 max-w-[70ch]">
        <MarkdownMath variant="ui">{session.explanation}</MarkdownMath>
      </div>

      {exchanges.length > 0 ? (
        <>
          <h2 className="meta-caps mt-10">The student&apos;s questions</h2>
          <div className="mt-2 flex flex-col gap-4">
            {exchanges.map((exchange, i) => (
              <div key={i} className="max-w-[70ch]">
                <div className="font-medium">
                  <MarkdownMath variant="ui">{exchange.question}</MarkdownMath>
                </div>
                <div className="mt-1 text-ink-soft">
                  <MarkdownMath variant="ui">{exchange.answer}</MarkdownMath>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
