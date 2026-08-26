/**
 * Seeds the starter taxonomy (docs/03) and ingests the DRT exemplar as the
 * first mental model document.
 *
 * Idempotent: re-running upserts topics by (parentId, name) and leaves an
 * already-seeded exemplar in place rather than duplicating it.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import { PrismaClient } from "@prisma/client";

import { parseDocTitle, parseModelIndex, serializeModelIndex } from "../src/lib/modelIndex";
import { uniqueSlug } from "../src/lib/slug";
import { glyphForRootName } from "../src/lib/symbols";
import { seedSymbols } from "./symbols";

const prisma = new PrismaClient();

/** Nested tuple tree: [name, children]. Mirrors docs/03 "Seed". */
type TaxonomyNode = [string, TaxonomyNode[]?];

const TAXONOMY: TaxonomyNode[] = [
  [
    "Algebra",
    [
      ["Linear Equations"],
      ["Word Problems", [["Distance-Rate-Time"], ["Mixture"], ["Work Rate"]]],
      ["Quadratics"],
      ["Systems of Equations"],
    ],
  ],
  ["Geometry", [["Triangles"], ["Circles"], ["Coordinate Geometry"]]],
  ["Trigonometry", [["Right Triangle Trig"], ["Identities"], ["Unit Circle"]]],
  [
    "Precalculus",
    [["Functions"], ["Exponentials & Logarithms"], ["Sequences & Series"]],
  ],
  [
    "Calculus",
    [
      ["Limits"],
      ["Derivatives"],
      ["Applications", [["Related Rates"], ["Optimization"]]],
      ["Integrals"],
    ],
  ],
  [
    "Statistics & Probability",
    [["Descriptive Stats"], ["Probability"], ["Distributions"]],
  ],
];

const EXEMPLAR_RELATIVE_PATH = "content/exemplars/drt-mental-models.md";
const EXEMPLAR_TOPIC_NAME = "Distance-Rate-Time";

async function seedTaxonomy(glyphToSymbolId: Map<string, string>): Promise<Map<string, string>> {
  const takenSlugs = new Set(
    (await prisma.topic.findMany({ select: { slug: true } })).map((t) => t.slug),
  );
  /** topic name -> id. Names in the starter taxonomy are unique. */
  const idsByName = new Map<string, string>();

  async function walk(nodes: TaxonomyNode[], parentId: string | null): Promise<void> {
    for (const [name, children] of nodes) {
      const existing = await prisma.topic.findFirst({
        where: { name, parentId },
        select: { id: true },
      });

      let id: string;
      if (existing) {
        id = existing.id;
      } else {
        const slug = uniqueSlug(name, takenSlugs);
        takenSlugs.add(slug);
        const created = await prisma.topic.create({
          data: {
            name,
            slug,
            parentId,
            // Only roots carry a glyph; subtopics inherit their root's.
            symbolId: parentId ? null : (glyphToSymbolId.get(glyphForRootName(name)) ?? null),
          },
          select: { id: true },
        });
        id = created.id;
      }

      idsByName.set(name, id);
      if (children?.length) await walk(children, id);
    }
  }

  await walk(TAXONOMY, null);
  return idsByName;
}

async function seedExemplar(topicId: string): Promise<void> {
  const existing = await prisma.mentalModelDoc.findFirst({
    where: { isExemplar: true },
    select: { id: true, title: true },
  });
  if (existing) {
    console.log(`  exemplar already seeded (${existing.title}), leaving it alone`);
    return;
  }

  const absolute = path.join(process.cwd(), EXEMPLAR_RELATIVE_PATH);
  const contentMd = await readFile(absolute, "utf8");

  const index = parseModelIndex(contentMd);
  if (index.length < 3) {
    throw new Error(
      `Parsed only ${index.length} models from the exemplar at ${EXEMPLAR_RELATIVE_PATH}. ` +
        "The heading parser and the document have diverged; see DECISIONS.md D-001.",
    );
  }

  const title = parseDocTitle(contentMd, "Mental Models for Distance-Rate-Time");

  await prisma.mentalModelDoc.create({
    data: {
      topicId,
      title,
      contentMd,
      modelIndexJson: serializeModelIndex(index),
      isExemplar: true,
    },
  });

  console.log(`  exemplar seeded: "${title}" with ${index.length} models`);
  for (const entry of index) {
    console.log(`    #${entry.anchor}  Model ${entry.number}: ${entry.title}`);
  }
}

async function main(): Promise<void> {
  console.log("Seeding symbols...");
  const glyphToSymbolId = await seedSymbols(prisma);
  console.log(`  ${glyphToSymbolId.size} symbols present`);

  console.log("Seeding taxonomy...");
  const idsByName = await seedTaxonomy(glyphToSymbolId);
  console.log(`  ${idsByName.size} topics present`);

  const drtId = idsByName.get(EXEMPLAR_TOPIC_NAME);
  if (!drtId) {
    throw new Error(`Seed taxonomy is missing "${EXEMPLAR_TOPIC_NAME}"; cannot file the exemplar.`);
  }

  console.log("Seeding exemplar document...");
  await seedExemplar(drtId);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
