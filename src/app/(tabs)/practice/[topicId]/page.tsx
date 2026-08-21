import { notFound } from "next/navigation";

import { PracticeWorkspace } from "@/components/practice/PracticeWorkspace";
import { poolCounts } from "@/lib/problems/serve";
import { getTopicDetail } from "@/lib/topics";

export const dynamic = "force-dynamic";

export default async function PracticeTopicPage({
  params,
}: {
  params: Promise<{ topicId: string }>;
}) {
  const { topicId } = await params;
  const [topic, counts] = await Promise.all([
    getTopicDetail(topicId),
    poolCounts(topicId),
  ]);
  if (!topic) notFound();

  return (
    <PracticeWorkspace topicId={topic.id} topicPath={topic.path} initialCounts={counts} />
  );
}
