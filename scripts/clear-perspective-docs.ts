/**
 * One-off cleanup for the perspective direct-voice change (DECISIONS.md
 * D-141): deletes every PerspectiveDoc and PerspectiveReadProgress row in a
 * single transaction so each topic regenerates lazily, in the new voice,
 * through PerspectivePane's existing auto-POST on mount. Progress rows go
 * with the docs because their section indexes point into the deleted text
 * (see the schema comment on PerspectiveReadProgress).
 *
 * Run once from the repo root, AFTER the new prompt is deployed:
 *
 *   npx tsx scripts/clear-perspective-docs.ts
 *
 * Safe to re-run: deleting zero rows is a no-op.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { PrismaClient } from "@prisma/client";

/**
 * tsx does not load .env on its own (the Prisma CLI does, this script is not
 * the CLI). Minimal loader: KEY=VALUE lines, optional quotes, existing
 * process.env wins so inline overrides keep working.
 */
function loadDotEnv(): void {
  let raw: string;
  try {
    raw = readFileSync(path.join(process.cwd(), ".env"), "utf8");
  } catch {
    return;
  }
  for (const line of raw.split("\n")) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  }
}

async function main(): Promise<void> {
  loadDotEnv();

  const prisma = new PrismaClient();
  try {
    const [progress, docs] = await prisma.$transaction([
      prisma.perspectiveReadProgress.deleteMany(),
      prisma.perspectiveDoc.deleteMany(),
    ]);
    console.log(
      `Cleared ${docs.count} perspective doc(s) and ${progress.count} reading-progress row(s).`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
