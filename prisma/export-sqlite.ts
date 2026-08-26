/**
 * Dumps every table out of the SQLite dev database so it can be replayed into
 * Postgres with cuids intact.
 *
 *   npx tsx prisma/export-sqlite.ts
 *
 * MUST run BEFORE the datasource switch: the generated Prisma client is
 * provider-specific, so a single process cannot hold a SQLite client and a
 * Postgres client at once. `prisma/dev.db` is only ever read here, which is
 * what keeps it usable as the rollback.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const OUT_DIR = path.join(process.cwd(), "prisma", "backup");
const OUT_FILE = path.join(OUT_DIR, "dump.json");

async function main(): Promise<void> {
  const [
    topics,
    modelDocs,
    problems,
    problemModelTags,
    attempts,
    chatSessions,
    chatMessages,
    aiCallLogs,
  ] = await Promise.all([
    prisma.topic.findMany(),
    prisma.mentalModelDoc.findMany(),
    prisma.problem.findMany(),
    prisma.problemModelTag.findMany(),
    prisma.attempt.findMany(),
    prisma.chatSession.findMany(),
    prisma.chatMessage.findMany(),
    prisma.aiCallLog.findMany(),
  ]);

  const dump = {
    exportedAt: new Date().toISOString(),
    topics,
    modelDocs,
    problems,
    problemModelTags,
    // Bytes come back as a Uint8Array and JSON has no binary, so sketches
    // ride across as base64 and the importer turns them back into Buffers.
    attempts: attempts.map((attempt) => ({
      ...attempt,
      sketchPng: attempt.sketchPng ? Buffer.from(attempt.sketchPng).toString("base64") : null,
    })),
    chatSessions,
    chatMessages,
    aiCallLogs,
  };

  await mkdir(OUT_DIR, { recursive: true });
  // Dates serialize to ISO strings through Date.prototype.toJSON.
  await writeFile(OUT_FILE, `${JSON.stringify(dump, null, 2)}\n`, "utf8");

  console.log(`Wrote ${OUT_FILE}`);
  console.log(`  Topic: ${topics.length}`);
  console.log(`  MentalModelDoc: ${modelDocs.length}`);
  console.log(`  Problem: ${problems.length}`);
  console.log(`  ProblemModelTag: ${problemModelTags.length}`);
  console.log(`  Attempt: ${attempts.length}`);
  console.log(`  ChatSession: ${chatSessions.length}`);
  console.log(`  ChatMessage: ${chatMessages.length}`);
  console.log(`  AiCallLog: ${aiCallLogs.length}`);
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
