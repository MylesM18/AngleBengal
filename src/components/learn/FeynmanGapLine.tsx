import { ButtonLink } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { anchorForModel } from "@/lib/modelIndex";

type GapVerdict = {
  modelNumber: number;
  verdict: "solid" | "wobbly" | "missing";
  symptom: string;
};

function parseGaps(reportJson: string): GapVerdict[] | null {
  // A malformed archived report must degrade to nothing, never crash the page.
  try {
    const report = JSON.parse(reportJson) as { verdicts?: unknown };
    if (!Array.isArray(report.verdicts)) return null;
    return (report.verdicts as GapVerdict[]).filter((v) => v.verdict !== "solid");
  } catch {
    return null;
  }
}

export function FeynmanGapLine({
  session,
  topicId,
}: {
  session: { id: string; reportJson: string } | null;
  topicId: string;
}) {
  if (!session) return null;
  const gaps = parseGaps(session.reportJson);
  if (!gaps || gaps.length === 0) return null;

  return (
    <Notice
      kind="info"
      className="mb-6"
      action={
        <ButtonLink
          href={`/learn/${topicId}/feynman/${session.id}`}
          variant="tertiary"
          size="sm"
        >
          See the full report
        </ButtonLink>
      }
    >
      <p className="font-medium">Explanation gaps</p>
      <ul className="mt-1.5 flex flex-col gap-1 text-ui">
        {gaps.map((gap) => (
          <li key={gap.modelNumber}>
            <a
              href={`#${anchorForModel(gap.modelNumber)}`}
              className="underline-offset-2 hover:underline"
            >
              {gap.verdict === "missing"
                ? `Your last explanation never used Model ${gap.modelNumber}.`
                : `Model ${gap.modelNumber} wobbled in your last explanation.`}
            </a>
          </li>
        ))}
      </ul>
    </Notice>
  );
}
