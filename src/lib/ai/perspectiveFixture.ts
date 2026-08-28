/**
 * Test-only builder for perspective documents (docs/05 §9). Not a .test.ts
 * file, so vitest does not collect it; app code never imports it. The one
 * permitted em-dash lives here as the unicode escape below, because rejecting
 * that character is a behavior under test.
 */

export type PerspectiveFixtureOptions = {
  /** Drop this exact H2 heading (and its body) from the document. */
  omitHeading?: string;
  /** The line after the title. Pass null to omit the subtitle entirely. */
  subtitle?: string | null;
  /** False renders "What it really is" without its blockquote. */
  blockquote?: boolean;
  /** True appends a sentence containing an em-dash. */
  emDash?: boolean;
  /** Pad with filler sentences until at least this many words. 0 = no filler. */
  words?: number;
};

const PADDING =
  "The measurement holds steady because the reasoning is anchored to something physical that does not move.";

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

export function buildPerspectiveDoc(options: PerspectiveFixtureOptions = {}): string {
  const {
    omitHeading,
    subtitle = "*Trigonometry is measuring what you cannot reach.*",
    blockquote = true,
    emDash = false,
    words = 1_400,
  } = options;

  const parts: string[] = ["# The Art of Measuring the Unreachable"];
  if (subtitle) parts.push("", subtitle);

  const section = (heading: string, body: string) => {
    if (heading === omitHeading) return;
    parts.push("", `## ${heading}`, "", body);
  };

  section(
    "The question nobody handed you",
    "You are standing on a shoreline watching a ship. You need its distance and you cannot walk on water.",
  );
  section(
    "Building it from nothing",
    "Start with two stakes and a sightline. The angle between them is something you can copy and carry home.",
  );
  section(
    "What it really is",
    blockquote
      ? "> Trigonometry is measuring what you cannot reach.\n\nEverything else is bookkeeping around that one act."
      : "Trigonometry is measuring what you cannot reach. Everything else is bookkeeping around that one act.",
  );
  section(
    "Why the rules are what they are",
    "Sine had to be a ratio because only a ratio survives scaling. Tangent has no value at $90$ degrees because the sightline never lands.",
  );
  section(
    "Proof it works",
    "Take an orange and a toothpick and scale the whole sky down to a tabletop. The angles do not care about the scale.",
  );
  section(
    "Where it lives today",
    "Your phone finds you by timing signals from satellites and cutting angles between them.",
  );
  section(
    "From perspective to practice",
    "Model 1, The Shadow Ratio, will let you turn any angle you can see into a length you cannot.",
  );

  let doc = parts.join("\n");
  if (emDash) doc += "\nA final thought \u2014 that dash is forbidden.";
  while (words > 0 && countWords(doc) < words) doc += `\n${PADDING}`;
  return `${doc}\n`;
}
