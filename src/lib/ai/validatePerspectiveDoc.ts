/**
 * Structural validation for a generated perspective document (docs/05 §9).
 *
 * Same regime as validateModelDoc: the mechanical half of non-negotiable 3,
 * applied to the perspective layer. One retry with these messages appended,
 * then a typed failure. Only the word FLOOR is a hard gate; the 1,400 ceiling
 * is stylistic, matching the prompt's stated target.
 *
 * The authored trig exemplar passes this gate; a test pins that, so the gate
 * and the locked exemplar cannot drift apart.
 */

export const PERSPECTIVE_MIN_WORDS = 700;

/** The seven required H2 titles, exact (spec §4.1 items 2-8). */
export const PERSPECTIVE_HEADINGS = [
  "The problem it solves",
  "Building it from nothing",
  "What it really is",
  "Why the rules are what they are",
  "Proof it works",
  "Where it lives today",
  "From perspective to practice",
] as const;

export type PerspectiveValidationResult = {
  ok: boolean;
  failures: string[];
  wordCount: number;
};

const EM_DASH = "\u2014";

/** H2 lines outside code fences, with their line indexes. */
function headingLines(lines: string[]): { text: string; index: number }[] {
  const found: { text: string; index: number }[] = [];
  let inFence = false;
  lines.forEach((line, index) => {
    if (/^[ \t]*(?:```|~~~)/.test(line)) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;
    const h2 = /^##[ \t]+(.+?)[ \t]*$/.exec(line);
    if (h2) found.push({ text: h2[1], index });
  });
  return found;
}

function wordCount(contentMd: string): number {
  return contentMd.split(/\s+/).filter(Boolean).length;
}

export function validatePerspectiveDoc(contentMd: string): PerspectiveValidationResult {
  const failures: string[] = [];
  const lines = contentMd.split(/\r?\n/);
  const words = wordCount(contentMd);

  // Title, then an italic one-line subtitle as the next non-empty line.
  const titleIndex = lines.findIndex((line) => /^#[ \t]+\S/.test(line));
  if (titleIndex === -1) {
    failures.push('Missing the "# {narrative title}" document title.');
  } else {
    const next = lines.slice(titleIndex + 1).find((line) => line.trim().length > 0);
    const italic = next ? /^(\*[^*].*\*|_[^_].*_)$/.test(next.trim()) : false;
    if (!italic) {
      failures.push(
        "The title must be followed by an italic one-line subtitle stating the topic's reframe.",
      );
    }
  }

  const headings = headingLines(lines);
  for (const required of PERSPECTIVE_HEADINGS) {
    if (!headings.some((heading) => heading.text === required)) {
      failures.push(`Missing the "## ${required}" section (exact title).`);
    }
  }

  // The identity reframe must be a blockquote inside "What it really is".
  const reframe = headings.find((heading) => heading.text === "What it really is");
  if (reframe) {
    const nextHeading = headings.find((heading) => heading.index > reframe.index);
    const end = nextHeading ? nextHeading.index : lines.length;
    const hasQuote = lines
      .slice(reframe.index + 1, end)
      .some((line) => /^[ \t]*>/.test(line));
    if (!hasQuote) {
      failures.push(
        '"What it really is" must contain a blockquoted sentence stating the identity reframe.',
      );
    }
  }

  if (contentMd.includes(EM_DASH)) {
    const count = contentMd.split(EM_DASH).length - 1;
    failures.push(
      `The document contains ${count} em-dash character${count === 1 ? "" : "s"}. House style forbids them: use commas, colons, parentheses, or hyphens.`,
    );
  }

  if (words < PERSPECTIVE_MIN_WORDS) {
    failures.push(
      `The document is ${words} words. The floor is ${PERSPECTIVE_MIN_WORDS}; aim for 700-1,400.`,
    );
  }

  return { ok: failures.length === 0, failures, wordCount: words };
}
