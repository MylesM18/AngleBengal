import Link from "next/link";

import { prisma } from "@/lib/db";
import { getRootNameByTopicId } from "@/lib/topics";
import { accentForRoot, ACCENT_VAR } from "@/lib/topicColors";

/** Reads the database on every request: the topic tree and doc list change
 *  whenever a document is generated, so this must not be prerendered. */
export const dynamic = "force-dynamic";

/**
 * Learn landing: no topic selected yet. Shows the documents that already
 * exist so the seeded exemplar is one click from the front door, rather than
 * a bare "pick something on the left".
 */
export default async function LearnIndexPage() {
  const rootNames = await getRootNameByTopicId();
  const docs = await prisma.mentalModelDoc.findMany({
    select: {
      id: true,
      title: true,
      isExemplar: true,
      topic: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 12,
  });

  return (
    <div className="mx-auto max-w-[760px] px-8 py-10">
      <h1 className="display-cut text-[30px] leading-tight text-ink">Learn</h1>
      <p className="mt-2 max-w-[54ch] text-[15px] leading-relaxed text-ink-soft">
        Mental models for a topic: what is true about a class of problems, not the steps to
        grind through one. Pick a topic on the left to read its models.
      </p>

      <section className="mt-8">
        <h2 className="meta-caps mb-3 text-ink-soft">
          {docs.length > 0 ? "Documents" : "No documents yet"}
        </h2>

        {docs.length === 0 ? (
          <div className="stock-textured rounded-card bg-kraft p-5">
            <p className="max-w-[46ch] text-[13.5px] leading-relaxed text-ink">
              Nothing has been generated yet. Run{" "}
              <code className="rounded-chip bg-paper-0 px-1.5 py-0.5 font-mono text-[12px]">
                npx prisma db seed
              </code>{" "}
              to load the starter taxonomy and the Distance-Rate-Time exemplar.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {docs.map((doc) => {
              const accent = accentForRoot(rootNames.get(doc.topic.id) ?? doc.topic.name);
              return (
                <li key={doc.id}>
                  <Link
                    href={`/learn/${doc.topic.id}?doc=${doc.id}`}
                    className="flex items-center gap-3 rounded-card bg-paper-1 p-3.5 shadow-sheet transition-all hover:-translate-y-px hover:shadow-lift"
                  >
                    <span
                      aria-hidden
                      className="h-9 w-1.5 shrink-0 rounded-[2px]"
                      style={{ backgroundColor: ACCENT_VAR[accent] }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14.5px] font-semibold text-ink">
                        {doc.title}
                      </span>
                      <span className="block text-[12px] text-ink-soft">{doc.topic.name}</span>
                    </span>
                    {doc.isExemplar && (
                      <span className="meta-caps shrink-0 rounded-chip bg-brand-tint px-1.5 py-0.5 text-[10px] text-brand-deep">
                        Exemplar
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
