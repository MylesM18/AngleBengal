import "server-only";

import { ApiError } from "@/lib/ai/errors";
import { prisma } from "@/lib/db";
import { uniqueSlug } from "@/lib/slug";
import { glyphForRootName } from "@/lib/symbols";

/**
 * Creates (or reuses) each node along `names`, starting under
 * `startParentId` (null means the path is rooted and may create a new root).
 * Returns the leaf topic id.
 *
 * Extracted verbatim from resolveTopic (src/lib/models/generate.ts) so the
 * subject topic-add flow (subjects spec §5.2) files under a subject with the
 * same level-by-level reuse rule: "Calculus > Applications > Related Rates"
 * never duplicates Calculus or Applications.
 */
export async function createTopicPath(
  startParentId: string | null,
  names: string[],
): Promise<string> {
  const takenSlugs = new Set(
    (await prisma.topic.findMany({ select: { slug: true } })).map((topic) => topic.slug),
  );

  let parentId: string | null = startParentId;
  for (const rawName of names) {
    const name = rawName.trim();
    if (!name) continue;

    const existing: { id: string } | null = await prisma.topic.findFirst({
      where: { name, parentId },
      select: { id: true },
    });

    if (existing) {
      parentId = existing.id;
      continue;
    }

    const slug = uniqueSlug(name, takenSlugs);
    takenSlugs.add(slug);
    // A new ROOT gets the same glyph D-078 would have hashed for it, resolved
    // to a MathSymbol row so the cover reads from the database like every
    // other root. Subtopics inherit their root's at read time.
    const symbolId =
      parentId === null
        ? ((
            await prisma.mathSymbol.findUnique({
              where: { glyph: glyphForRootName(name) },
              select: { id: true },
            })
          )?.id ?? null)
        : null;

    const created: { id: string } = await prisma.topic.create({
      data: { name, slug, parentId, symbolId },
      select: { id: true },
    });
    parentId = created.id;
  }

  if (parentId === null || parentId === startParentId) {
    throw new ApiError("AI_INVALID_OUTPUT", "The classifier returned an empty topic path.");
  }
  return parentId;
}
