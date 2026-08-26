/**
 * Replays prisma/backup/dump.json into Postgres with every cuid preserved, so
 * existing `?doc=` links, ProblemModelTag rows and Attempt.diagnosedDocId
 * references all keep their meaning.
 *
 *   npx tsx prisma/import-postgres.ts
 *
 * Run AFTER `npx prisma migrate dev --name init --skip-seed`, against an empty
 * database. It refuses to run twice, so a re-run cannot half-duplicate the
 * taxonomy.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import { PrismaClient } from "@prisma/client";

import { glyphForRootName } from "../src/lib/symbols";
import { seedSymbols } from "./symbols";

const prisma = new PrismaClient();
const DUMP_FILE = path.join(process.cwd(), "prisma", "backup", "dump.json");

type TopicRow = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  description: string | null;
  createdAt: string;
};
type DocRow = {
  id: string;
  topicId: string;
  title: string;
  contentMd: string;
  modelIndexJson: string;
  isExemplar: boolean;
  createdAt: string;
};
type ProblemRow = {
  id: string;
  topicId: string;
  statementMd: string;
  answerJson: string;
  solutionMd: string;
  difficulty: number;
  verified: boolean;
  createdAt: string;
};
type TagRow = { problemId: string; docId: string; modelNumber: number };
type AttemptRow = {
  id: string;
  problemId: string;
  submittedAnswer: string;
  correct: boolean;
  sketchPng: string | null;
  ocrTextJson: string | null;
  diagnosedDocId: string | null;
  diagnosedModelNum: number | null;
  diagnosisSymptom: string | null;
  diagnosisMd: string | null;
  diagnosisConfidence: number | null;
  createdAt: string;
};
type SessionRow = { id: string; title: string | null; createdAt: string };
type MessageRow = {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  contextJson: string | null;
  createdAt: string;
};
type LogRow = {
  id: string;
  promptName: string;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  ok: boolean;
  createdAt: string;
};

type Dump = {
  topics: TopicRow[];
  modelDocs: DocRow[];
  problems: ProblemRow[];
  problemModelTags: TagRow[];
  attempts: AttemptRow[];
  chatSessions: SessionRow[];
  chatMessages: MessageRow[];
  aiCallLogs: LogRow[];
};

/** Root-to-leaf level, so a parent is always inserted before its children. */
function levelOf(topic: TopicRow, byId: Map<string, TopicRow>): number {
  let level = 0;
  let current = topic;
  // Same guard as getTopicPath: a cyclic parent chain fails loudly.
  while (current.parentId && level < 12) {
    const parent = byId.get(current.parentId);
    if (!parent) break;
    current = parent;
    level += 1;
  }
  return level;
}

async function main(): Promise<void> {
  const dump = JSON.parse(await readFile(DUMP_FILE, "utf8")) as Dump;

  const alreadyThere = await prisma.topic.count();
  if (alreadyThere > 0) {
    throw new Error(
      `Refusing to import: Topic already holds ${alreadyThere} rows. This script runs once, against an empty database.`,
    );
  }

  // Every document imports at depth 1, so two documents on one topic would
  // collide on @@unique([topicId, depth]). Fail here, not half way through.
  const docsPerTopic = new Map<string, number>();
  for (const doc of dump.modelDocs) {
    docsPerTopic.set(doc.topicId, (docsPerTopic.get(doc.topicId) ?? 0) + 1);
  }
  const collisions = [...docsPerTopic.entries()].filter(([, count]) => count > 1);
  if (collisions.length > 0) {
    throw new Error(
      `Cannot import: these topics hold more than one document and all documents import at depth 1: ${collisions
        .map(([id, count]) => `${id} (${count})`)
        .join(", ")}`,
    );
  }

  const glyphToSymbolId = await seedSymbols(prisma);
  console.log(`MathSymbol: ${glyphToSymbolId.size}`);

  const byId = new Map(dump.topics.map((topic) => [topic.id, topic]));
  const byLevel = new Map<number, TopicRow[]>();
  for (const topic of dump.topics) {
    const level = levelOf(topic, byId);
    const bucket = byLevel.get(level) ?? [];
    bucket.push(topic);
    byLevel.set(level, bucket);
  }

  for (const level of [...byLevel.keys()].sort((a, b) => a - b)) {
    const rows = byLevel.get(level) ?? [];
    await prisma.topic.createMany({
      data: rows.map((topic) => ({
        id: topic.id,
        name: topic.name,
        slug: topic.slug,
        parentId: topic.parentId,
        description: topic.description,
        createdAt: new Date(topic.createdAt),
        // Only roots carry a glyph; the value is exactly what glyphForRoot
        // returned before the map moved into the database (D-078 preserved).
        symbolId: topic.parentId
          ? null
          : (glyphToSymbolId.get(glyphForRootName(topic.name)) ?? null),
      })),
    });
    console.log(`Topic level ${level}: ${rows.length}`);
  }

  await prisma.mentalModelDoc.createMany({
    data: dump.modelDocs.map((doc) => ({
      id: doc.id,
      topicId: doc.topicId,
      title: doc.title,
      contentMd: doc.contentMd,
      modelIndexJson: doc.modelIndexJson,
      isExemplar: doc.isExemplar,
      depth: 1,
      createdAt: new Date(doc.createdAt),
    })),
  });
  console.log(`MentalModelDoc: ${dump.modelDocs.length}`);

  await prisma.problem.createMany({
    data: dump.problems.map((problem) => ({
      ...problem,
      createdAt: new Date(problem.createdAt),
    })),
  });
  console.log(`Problem: ${dump.problems.length}`);

  await prisma.problemModelTag.createMany({ data: dump.problemModelTags });
  console.log(`ProblemModelTag: ${dump.problemModelTags.length}`);

  await prisma.attempt.createMany({
    data: dump.attempts.map((attempt) => ({
      ...attempt,
      sketchPng: attempt.sketchPng ? Buffer.from(attempt.sketchPng, "base64") : null,
      createdAt: new Date(attempt.createdAt),
    })),
  });
  console.log(`Attempt: ${dump.attempts.length}`);

  await prisma.chatSession.createMany({
    data: dump.chatSessions.map((session) => ({
      ...session,
      createdAt: new Date(session.createdAt),
    })),
  });
  console.log(`ChatSession: ${dump.chatSessions.length}`);

  await prisma.chatMessage.createMany({
    data: dump.chatMessages.map((message) => ({
      ...message,
      createdAt: new Date(message.createdAt),
    })),
  });
  console.log(`ChatMessage: ${dump.chatMessages.length}`);

  await prisma.aiCallLog.createMany({
    data: dump.aiCallLogs.map((log) => ({
      ...log,
      createdAt: new Date(log.createdAt),
    })),
  });
  console.log(`AiCallLog: ${dump.aiCallLogs.length}`);
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
