import { notFound } from "next/navigation";

import { PracticeWorkspace } from "@/components/practice/PracticeWorkspace";
import { poolCounts } from "@/lib/problems/serve";
import { readResume } from "@/lib/resume/store";
import { getTopicDetail } from "@/lib/topics";

export const dynamic = "force-dynamic";

export default async function PracticeTopicPage({
  params,
}: {
  params: Promise<{ topicId: string }>;
}) {
  const { topicId } = await params;
  const [topic, counts, resume] = await Promise.all([
    getTopicDetail(topicId),
    poolCounts(topicId),
    readResume(),
  ]);
  if (!topic) notFound();

  return (
    <PracticeWorkspace
      topicId={topic.id}
      topicPath={topic.path}
      initialCounts={counts}
      wordProblemsOnly={topic.wordProblemsOnly}
      // The recorded in-progress problem (D-156). Passed regardless of which
      // topic it belongs to: serving is topic-scoped with a fallback to a
      // fresh pick, so a stale id self-heals on the first load.
      initialProblemId={resume?.context.problemId ?? null}
    />
  );
}
