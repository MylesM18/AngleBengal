import Link from "next/link";
import { notFound } from "next/navigation";

import { getTopicDetail } from "@/lib/topics";

export default async function PracticeTopicPage({
  params,
}: {
  params: Promise<{ topicId: string }>;
}) {
  const { topicId } = await params;
  const topic = await getTopicDetail(topicId);
  if (!topic) notFound();

  return (
    <div className="mx-auto max-w-[640px] px-8 py-16">
      <p className="mb-3 text-[12px] text-ink-soft">{topic.path.join("  ›  ")}</p>
      <h1 className="font-expanded text-[30px] leading-tight text-ink">{topic.name}</h1>

      <div className="stock-textured mt-6 rounded-card bg-kraft p-6">
        <p className="font-expanded mb-1 text-[16px] text-ink">Not built yet</p>
        <p className="max-w-[50ch] text-[13.5px] leading-relaxed text-ink">
          Problem generation, verification and diagnosis arrive in Phase 3. This topic has{" "}
          {topic.verifiedProblemCount} verified{" "}
          {topic.verifiedProblemCount === 1 ? "problem" : "problems"} so far.
        </p>
        <Link
          href={`/learn/${topic.id}`}
          className="mt-4 inline-block rounded-input border-[1.5px] border-ink bg-paper-0 px-3 py-1.5 text-[13px] font-semibold text-ink"
        >
          Back to the models
        </Link>
      </div>
    </div>
  );
}
