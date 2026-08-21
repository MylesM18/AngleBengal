import "server-only";

import { callStructured } from "@/lib/ai/call";
import { AI_MODELS } from "@/lib/ai/config";
import { DIAGNOSTIC_SYSTEM, diagnosticUser } from "@/lib/ai/prompts";
import { diagnosticSchema, MIN_DIAGNOSIS_CONFIDENCE } from "@/lib/ai/schemas";
import { prisma } from "@/lib/db";
import { deserializeModelIndex } from "@/lib/modelIndex";
import { compareToAnswer } from "@/lib/math/compare";
import { parseAnswer } from "@/lib/math/answer";
import { ApiError } from "@/lib/ai/errors";

/**
 * Grading and wrong-answer diagnosis (docs/02 flow C, docs/05 §5).
 *
 * The diagnosis is the differentiator: a wrong answer is attributed to the
 * specific mental model that failed, with a deep link back to it. It is also
 * the place where guessing does the most damage, so a low-confidence result is
 * suppressed rather than shown (docs/04).
 */

export type Diagnosis = {
  docId: string;
  modelNumber: number;
  modelTitle: string;
  symptom: string;
  explanationMd: string;
  confidence: number;
  learnHref: string;
};

export type AttemptResult = {
  correct: boolean;
  solutionMd: string;
  diagnosis: Diagnosis | null;
  /** Per-part outcomes for multi answers, so the UI can mark each input. */
  parts: { name: string; label: string; match: boolean }[] | null;
};

export async function submitAttempt(input: {
  problemId: string;
  submittedAnswer: string;
  sketchPngBase64?: string | null;
  ocrBlocks?: unknown;
}): Promise<AttemptResult> {
  const problem = await prisma.problem.findUnique({
    where: { id: input.problemId },
    select: {
      id: true,
      topicId: true,
      statementMd: true,
      answerJson: true,
      solutionMd: true,
      verified: true,
    },
  });

  if (!problem) throw new ApiError("NOT_FOUND", "That problem does not exist.");
  if (!problem.verified) {
    // Should be unreachable: unverified problems are never served.
    throw new ApiError("NOT_FOUND", "That problem is not available.");
  }

  const expected = parseAnswer(problem.answerJson);
  if (!expected) {
    throw new ApiError("INTERNAL", "This problem's stored answer could not be read.");
  }

  const comparison = compareToAnswer(expected, input.submittedAnswer);
  const ocrText = ocrBlocksToText(input.ocrBlocks);

  const diagnosis = comparison.match
    ? null
    : await diagnose({
        statementMd: problem.statementMd,
        solutionMd: problem.solutionMd,
        submittedAnswer: input.submittedAnswer,
        topicId: problem.topicId,
        ocrText,
      });

  await prisma.attempt.create({
    data: {
      problemId: problem.id,
      submittedAnswer: input.submittedAnswer,
      correct: comparison.match,
      sketchPng: decodeSketch(input.sketchPngBase64),
      ocrTextJson: input.ocrBlocks ? JSON.stringify(input.ocrBlocks) : null,
      diagnosedDocId: diagnosis?.docId ?? null,
      diagnosedModelNum: diagnosis?.modelNumber ?? null,
      diagnosisSymptom: diagnosis?.symptom ?? null,
      diagnosisMd: diagnosis?.explanationMd ?? null,
      diagnosisConfidence: diagnosis?.confidence ?? null,
    },
  });

  return {
    correct: comparison.match,
    solutionMd: problem.solutionMd,
    diagnosis,
    parts: comparison.parts ?? null,
  };
}

/**
 * Returns null whenever the app would otherwise be guessing: no document, a
 * failed call, a model number the document does not contain, or confidence
 * below the floor. The UI renders the plain wrong state in that case and never
 * a fabricated attribution (docs/06 §3).
 */
async function diagnose(input: {
  statementMd: string;
  solutionMd: string;
  submittedAnswer: string;
  topicId: string;
  ocrText: string | null;
}): Promise<Diagnosis | null> {
  const doc = await prisma.mentalModelDoc.findFirst({
    where: { topicId: input.topicId },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, contentMd: true, modelIndexJson: true },
  });
  if (!doc) return null;

  let result;
  try {
    result = await callStructured({
      promptName: "diagnostic",
      model: AI_MODELS.GENERATOR,
      system: DIAGNOSTIC_SYSTEM,
      user: diagnosticUser({
        statementMd: input.statementMd,
        solutionMd: input.solutionMd,
        submittedAnswer: input.submittedAnswer,
        ocrText: input.ocrText,
        doc: { title: doc.title, contentMd: doc.contentMd },
      }),
      schema: diagnosticSchema,
      schemaName: "diagnosis",
    });
  } catch (error) {
    // A failed diagnosis must not fail the attempt: the student still gets
    // graded and still sees the solution (non-negotiable 4).
    console.error("Diagnostic call failed:", error instanceof Error ? error.message : error);
    return null;
  }

  // Suppressions are a real, expected behavior rather than a fault, so they
  // are logged: without this, "no attribution" is indistinguishable from a
  // broken diagnostic call when reading the output.
  if (result.confidence < MIN_DIAGNOSIS_CONFIDENCE) {
    console.info(
      `diagnosis suppressed: confidence ${result.confidence.toFixed(2)} below ${MIN_DIAGNOSIS_CONFIDENCE} (named Model ${result.failedModelNumber})`,
    );
    return null;
  }

  // Model 0 is the documented "Arithmetic slip" case: a real diagnosis, but
  // it points at no model section, so there is nothing to deep-link to.
  if (result.failedModelNumber === 0) {
    console.info(`diagnosis suppressed: arithmetic slip, no model to link to`);
    return null;
  }

  const index = deserializeModelIndex(doc.modelIndexJson);
  const entry = index.find((candidate) => candidate.number === result.failedModelNumber);
  if (!entry) {
    console.warn(
      `Diagnosis named model ${result.failedModelNumber}, which is not in doc ${doc.id}. Suppressed.`,
    );
    return null;
  }

  return {
    docId: doc.id,
    modelNumber: entry.number,
    modelTitle: entry.title || result.failedModelTitle,
    symptom: result.symptom,
    explanationMd: result.explanationMd,
    confidence: result.confidence,
    learnHref: `/learn/${input.topicId}?doc=${doc.id}#${entry.anchor}`,
  };
}

function ocrBlocksToText(blocks: unknown): string | null {
  if (!Array.isArray(blocks) || blocks.length === 0) return null;
  const lines = blocks
    .map((block) => {
      if (!block || typeof block !== "object") return null;
      const record = block as { kind?: string; latex?: string; text?: string };
      if (record.kind === "math" && record.latex) return record.latex;
      if (record.kind === "text" && record.text) return record.text;
      return null;
    })
    .filter((line): line is string => Boolean(line));
  return lines.length ? lines.join("\n") : null;
}

/**
 * Prisma's `Bytes` maps to `Uint8Array<ArrayBuffer>`, which Node's `Buffer`
 * does not satisfy (its backing store is `ArrayBufferLike`). Copying into a
 * plain Uint8Array is the honest conversion rather than a cast.
 */
function decodeSketch(base64: string | null | undefined): Uint8Array<ArrayBuffer> | null {
  if (!base64) return null;
  try {
    const buffer = Buffer.from(base64.replace(/^data:image\/\w+;base64,/, ""), "base64");
    // Allocate a fresh ArrayBuffer: wrapping the Buffer directly keeps its
    // ArrayBufferLike backing store, which Prisma's Bytes type rejects.
    const bytes = new Uint8Array(new ArrayBuffer(buffer.byteLength));
    bytes.set(buffer);
    return bytes;
  } catch {
    return null;
  }
}
