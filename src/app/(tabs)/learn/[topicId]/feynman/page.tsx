import { notFound, redirect } from "next/navigation";

import { Breadcrumb } from "@/components/learn/Breadcrumb";
import { FeynmanLive } from "@/components/learn/FeynmanLive";
import { BackButton } from "@/components/ui/BackButton";
import { prisma } from "@/lib/db";
import { getTopicDetail } from "@/lib/topics";

export const dynamic = "force-dynamic";

export default async function FeynmanPage({
  params,
  searchParams,
}: {
  params: Promise<{ topicId: string }>;
  searchParams: Promise<{ doc?: string }>;
}) {
  const { topicId } = await params;
  const { doc: docParam } = await searchParams;
  if (!docParam) {
    redirect(`/learn/${topicId}`);
  }

  const [topic, doc] = await Promise.all([
    getTopicDetail(topicId),
    prisma.mentalModelDoc.findUnique({
      where: { id: docParam },
      select: { id: true, title: true, topicId: true },
    }),
  ]);
  if (!topic) {
    notFound();
  }
  if (!doc || doc.topicId !== topicId) {
    redirect(`/learn/${topicId}`);
  }

  return (
    <div className="mx-auto max-w-[860px] px-4 pt-8 pb-10 sm:px-8 sm:pt-16">
      <div className="mb-3 flex flex-wrap items-center gap-2 [&>nav]:mb-0">
        <BackButton fallbackHref={`/learn/${topic.id}`} />
        <Breadcrumb pathNodes={topic.pathNodes} topicId={topic.id} hasSiblings={false} />
      </div>
      <FeynmanLive topicId={topicId} docId={doc.id} docTitle={doc.title} />
    </div>
  );
}
