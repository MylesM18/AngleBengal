import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { Children } from "react";
import Markdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

import { anchorForModel } from "@/lib/modelIndex";

/**
 * The one renderer for every piece of stored content: model docs, problem
 * statements, solutions, diagnoses, chat messages (docs/02).
 *
 * Bad LaTeX must never crash a page, so KaTeX runs with `throwOnError: false`
 * and renders the offending source in a subtle mono style instead
 * (docs/06 §7).
 */

const REHYPE_KATEX_OPTIONS = {
  throwOnError: false,
  errorColor: "#6B5F52",
  strict: false as const,
};

/** `Model 3 — Freeze the clock`, any dash variant, matching modelIndex.ts. */
const MODEL_HEADING_TEXT = /^Model[ \t]+(\d+)\b/;

function textOf(node: ReactNode): string {
  let out = "";
  Children.forEach(node, (child) => {
    if (child === null || child === undefined || typeof child === "boolean") return;
    if (typeof child === "string" || typeof child === "number") {
      out += String(child);
      return;
    }
    if (typeof child === "object" && "props" in child) {
      out += textOf((child.props as { children?: ReactNode }).children);
    }
  });
  return out;
}

/**
 * Gives every `## Model N` heading a stable `id`, which is what the mini-TOC
 * links to and what a diagnosis deep-links to as `#model-3`.
 */
function Heading2({ children, ...rest }: ComponentPropsWithoutRef<"h2">) {
  const match = MODEL_HEADING_TEXT.exec(textOf(children).trim());
  const id = match ? anchorForModel(Number.parseInt(match[1], 10)) : undefined;
  return (
    <h2 id={id} {...rest}>
      {children}
    </h2>
  );
}

export type MarkdownMathProps = {
  children: string;
  /** Extra classes on the wrapper. The `doc-prose` base is always applied. */
  className?: string;
};

export function MarkdownMath({ children, className }: MarkdownMathProps) {
  return (
    <div className={className ? `doc-prose ${className}` : "doc-prose"}>
      <Markdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, REHYPE_KATEX_OPTIONS]]}
        components={{ h2: Heading2 }}
      >
        {children}
      </Markdown>
    </div>
  );
}

export default MarkdownMath;
