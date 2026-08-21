import { notFound } from "next/navigation";

import { PracticePanel } from "@/components/practice/PracticePanel";
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
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-[45] flex-col border-r border-ink-faint/40">
        <PracticePanel topicId={topic.id} topicPath={topic.path} initialCounts={counts} />
      </div>

      {/* The sketchpad lands here in Phase 4 (docs/06 §4). */}
      <div className="stock-textured hidden min-w-0 flex-[55] items-center justify-center bg-desk p-8 lg:flex">
        <div className="max-w-[34ch] text-center">
          <p className="font-expanded mb-1 text-[15px] text-ink">Sketchpad</p>
          <p className="text-[12.5px] leading-relaxed text-ink-soft">
            Graph paper, pen and eraser, and handwriting cleanup arrive in Phase 4. Until
            then, work on paper and type the answer.
          </p>
        </div>
      </div>
    </div>
  );
}
