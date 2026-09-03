"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { MarkdownMath } from "@/components/shared/MarkdownMath";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";

type Stage = "write" | "asking" | "defend" | "grading";

type StudentQuestion = { modelNumber: number | null; question: string };

const TEXTAREA_CLASSES =
  "w-full resize-y rounded-input border border-hairline bg-paper-0 px-3 py-2 text-ui text-ink placeholder:text-ink-faint disabled:opacity-60";

export function FeynmanLive({
  topicId,
  docId,
  docTitle,
}: {
  topicId: string;
  docId: string;
  docTitle: string;
}) {
  const router = useRouter();
  const draftKey = `feynman-draft:${docId}`;

  const [stage, setStage] = useState<Stage>("write");
  const [explanation, setExplanation] = useState("");
  const [questions, setQuestions] = useState<StudentQuestion[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [failure, setFailure] = useState<"questions" | "grade" | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);

  useEffect(() => {
    // localStorage can throw (privacy modes); a lost draft must never crash.
    try {
      const stored = window.localStorage.getItem(draftKey);
      if (stored) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setExplanation(stored);
        setDraftRestored(true);
      }
    } catch {
      // Ignore: the draft is a convenience, not state of record.
    }
  }, [draftKey]);

  function updateExplanation(value: string) {
    setExplanation(value);
    try {
      window.localStorage.setItem(draftKey, value);
    } catch {
      // Ignore: the draft is a convenience, not state of record.
    }
  }

  function clearDraft() {
    setExplanation("");
    setDraftRestored(false);
    try {
      window.localStorage.removeItem(draftKey);
    } catch {
      // Ignore: the draft is a convenience, not state of record.
    }
  }

  function updateAnswer(index: number, value: string) {
    setAnswers((prev) => prev.map((answer, i) => (i === index ? value : answer)));
  }

  async function submitExplanation() {
    setStage("asking");
    setFailure(null);
    try {
      const response = await fetch("/api/feynman/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docId, explanation }),
      });
      if (!response.ok) throw new Error("questions request failed");
      const payload = (await response.json()) as { questions: StudentQuestion[] };
      setQuestions(payload.questions);
      setAnswers(payload.questions.map(() => ""));
      setStage("defend");
    } catch {
      setStage("write");
      setFailure("questions");
    }
  }

  async function submitAnswers() {
    setStage("grading");
    setFailure(null);
    try {
      const exchanges = questions.map((question, i) => ({
        question: question.question,
        answer: answers[i] ?? "",
      }));
      const response = await fetch("/api/feynman/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docId, explanation, exchanges }),
      });
      if (!response.ok) throw new Error("grade request failed");
      const payload = (await response.json()) as { sessionId: string };
      try {
        window.localStorage.removeItem(draftKey);
      } catch {
        // Ignore: the draft is a convenience, not state of record.
      }
      router.replace(`/learn/${topicId}/feynman/${payload.sessionId}`);
    } catch {
      setStage("defend");
      setFailure("grade");
    }
  }

  const writing = stage === "write" || stage === "asking";

  return (
    <div>
      <h1 className="display-cut text-h1 text-ink">
        {writing ? `Explain ${docTitle} from memory` : "The student has questions"}
      </h1>
      {writing ? (
        <p className="mt-2 text-meta text-ink-soft">
          The Feynman technique: teach it in plain words, find out what you actually
          know.
        </p>
      ) : null}

      {failure !== null ? (
        <Notice
          kind="error"
          className="mt-6"
          action={
            <Button
              variant="secondary"
              size="sm"
              className="max-lg:tap-target"
              onClick={failure === "questions" ? submitExplanation : submitAnswers}
            >
              Retry
            </Button>
          }
        >
          {failure === "questions"
            ? "The student could not be reached. Your writing is safe."
            : "Grading failed. Your writing is safe."}
        </Notice>
      ) : null}

      {writing ? (
        <div className="mt-6">
          {draftRestored ? (
            <div className="mb-2 flex items-center gap-3 text-meta text-ink-soft">
              <span>Draft restored from your last visit.</span>
              <Button variant="tertiary" size="sm" onClick={clearDraft}>
                Clear
              </Button>
            </div>
          ) : null}
          <textarea
            className={TEXTAREA_CLASSES}
            rows={10}
            value={explanation}
            onChange={(event) => updateExplanation(event.target.value)}
            placeholder="Write like you are teaching a friend who has never seen this topic. Plain words, no peeking."
            disabled={stage === "asking"}
          />
          <div className="mt-3">
            <Button
              variant="primary"
              size="md"
              className="max-lg:tap-target"
              onClick={submitExplanation}
              disabled={explanation.trim() === ""}
              loading={stage === "asking"}
            >
              Submit explanation
            </Button>
          </div>
          <p aria-live="polite" className="mt-2 text-meta text-ink-soft">
            {stage === "asking" ? "The student is reading your explanation..." : ""}
          </p>
        </div>
      ) : (
        <div className="mt-6">
          <h2 className="meta-caps">Your explanation</h2>
          <div className="mt-2 max-w-[70ch] text-ink-soft">
            <MarkdownMath variant="ui">{explanation}</MarkdownMath>
          </div>
          <div className="mt-6 flex flex-col gap-5">
            {questions.map((question, i) => (
              <div key={i}>
                <div className="max-w-[70ch] font-medium text-ink">
                  <MarkdownMath variant="ui">{question.question}</MarkdownMath>
                </div>
                <textarea
                  className={`${TEXTAREA_CLASSES} mt-2`}
                  rows={4}
                  value={answers[i] ?? ""}
                  onChange={(event) => updateAnswer(i, event.target.value)}
                  placeholder="Answer in plain words."
                  disabled={stage === "grading"}
                />
              </div>
            ))}
          </div>
          <div className="mt-3">
            <Button
              variant="primary"
              size="md"
              className="max-lg:tap-target"
              onClick={submitAnswers}
              disabled={answers.length === 0 || answers.some((a) => a.trim() === "")}
              loading={stage === "grading"}
            >
              Finish and grade
            </Button>
          </div>
          <p aria-live="polite" className="mt-2 text-meta text-ink-soft">
            {stage === "grading" ? "Grading against this doc's models..." : ""}
          </p>
        </div>
      )}
    </div>
  );
}
