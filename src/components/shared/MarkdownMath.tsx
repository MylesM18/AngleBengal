import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { Children } from "react";
import Markdown from "react-markdown";
import type { ExtraProps } from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

import { normalizeMathDelimiters } from "@/lib/mathDelimiters";
import { anchorForModel } from "@/lib/modelIndex";

/**
 * The one renderer for every piece of stored content: model docs, problem
 * statements, solutions, diagnoses, chat messages (docs/02).
 *
 * Bad LaTeX must never crash a page, so KaTeX runs with `throwOnError: false`
 * and renders the offending source in a subtle mono style instead
 * (docs/06 §7).
 *
 * Delimiters are normalized first: remark-math only understands `$`, and a
 * model that emits `\(...\)` would otherwise show the student raw LaTeX,
 * which non-negotiable 5 forbids.
 */

const REHYPE_KATEX_OPTIONS = {
  throwOnError: false,
  errorColor: "#6B5F52",
  strict: false as const,
};

/** `Model 3 — Freeze the clock`, any dash variant, matching modelIndex.ts. */
const MODEL_HEADING_TEXT = /^Model[ \t]+(\d+)\b/;

/**
 * What react-markdown hands a component override: the element's own props
 * plus its `node`, the internal hast node.
 */
type MarkdownProps<T extends keyof React.JSX.IntrinsicElements> = ComponentPropsWithoutRef<T> &
  ExtraProps;

/**
 * Everything but `node`, which every override below strips before spreading.
 * React serializes an unknown object prop onto a DOM element as
 * `node="[object Object]"`, and for the reading sheet that string is baked
 * into cached HTML that outlives deployments.
 */
function domProps<T extends ExtraProps>(props: T): Omit<T, "node"> {
  const rest = { ...props };
  delete rest.node;
  return rest;
}

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
function Heading2({ children, ...rest }: MarkdownProps<"h2">) {
  const match = MODEL_HEADING_TEXT.exec(textOf(children).trim());
  const id = match ? anchorForModel(Number.parseInt(match[1], 10)) : undefined;
  return (
    <h2 id={id} {...domProps(rest)}>
      {children}
    </h2>
  );
}

/**
 * GFM tables render header cells without a `scope`, which leaves assistive
 * tech to guess the association and fails the `td-has-header` audit on a
 * large table. Every markdown header cell is a column header.
 */
function TableHeader(props: MarkdownProps<"th">) {
  return <th scope="col" {...domProps(props)} />;
}

/**
 * The CSS `display: block` scroll route on tables stripped their table
 * semantics from assistive tech, wasting the `scope="col"` work above. Real
 * table layout returns and this wrapper owns horizontal scrolling instead
 * (mobile fix plan Phase 6, R18, D-162). No role and no ARIA on the table
 * itself: it announces itself.
 */
function TableScroller(props: MarkdownProps<"table">) {
  return (
    <div className="table-scroll" tabIndex={0} aria-label="Scrollable table">
      <table {...domProps(props)} />
    </div>
  );
}

/**
 * The same wrapper without the keyboard affordance, for the ui and chat
 * voices. `tabIndex` is what a keyboard needs to scroll a wide reading-sheet
 * table, but ProblemRibbon renders the ui voice inside a `button`, and the
 * button content model forbids a focusable descendant: a tabbable div there
 * would be a dead tab stop, clipped and inert while the ribbon is collapsed.
 * These voices had no focusable scroller before this phase either, so the
 * overflow route is the whole change for them.
 */
function TablePlainScroller(props: MarkdownProps<"table">) {
  return (
    <div className="table-scroll">
      <table {...domProps(props)} />
    </div>
  );
}

export type MarkdownMathVariant = "reading" | "ui" | "chat";

export const MARKDOWN_VARIANT_CLASS: Record<MarkdownMathVariant, string> = {
  /** 17px Source Serif, the long-form voice: model docs, problem statements, solutions. */
  reading: "doc-prose",
  /** 14px Archivo, tight margins: history rows, answer preview, clean copy, diagnosis explanation. */
  ui: "doc-prose ui-prose",
  /** 14px Archivo with chat margins: tutor bubbles. */
  chat: "doc-prose chat-prose",
};

export type MarkdownMathProps = {
  children: string;
  /** Which prose voice renders the content. Defaults to the reading voice. */
  variant?: MarkdownMathVariant;
  /** Layout-only classes on the wrapper (margins, widths). Never type sizes: use `variant`. */
  className?: string;
};

/**
 * The markdown pipeline with no wrapper element.
 *
 * Split out of MarkdownMath so the server renderer in
 * src/lib/learn/docHtml.ts can produce exactly the inner HTML MarkdownMath
 * would have produced. Injecting a full MarkdownMath render would nest a
 * second `doc-prose` div inside the first. The seam is pinned by
 * src/lib/learn/docHtml.test.ts, which asserts the two paths emit identical
 * markup, so changing one without the other fails the suite.
 *
 * Changing this pipeline means bumping RENDER_VERSION in
 * src/lib/learn/docHtml.ts. The reading sheet caches this output as HTML
 * indefinitely and Data Cache entries survive deploys, so without a bump the
 * old markup is served forever. The seam test cannot catch that: it moves
 * both paths together while the cache still holds the previous bytes.
 *
 * `focusableTables` defaults to true, the reading voice's behaviour, because
 * that is what docHtml renders and what the seam test compares. Both maps are
 * module constants: building one inline would hand react-markdown a new
 * component identity on every render and remount every table.
 */
const READING_COMPONENTS = { h2: Heading2, th: TableHeader, table: TableScroller };
const COMPACT_VOICE_COMPONENTS = { h2: Heading2, th: TableHeader, table: TablePlainScroller };

export function MarkdownBody({
  children,
  focusableTables = true,
}: {
  children: string;
  focusableTables?: boolean;
}) {
  return (
    <Markdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[[rehypeKatex, REHYPE_KATEX_OPTIONS]]}
      components={focusableTables ? READING_COMPONENTS : COMPACT_VOICE_COMPONENTS}
    >
      {normalizeMathDelimiters(children)}
    </Markdown>
  );
}

export function MarkdownMath({ children, variant = "reading", className }: MarkdownMathProps) {
  const base = MARKDOWN_VARIANT_CLASS[variant];
  return (
    <div className={className ? `${base} ${className}` : base}>
      <MarkdownBody focusableTables={variant === "reading"}>{children}</MarkdownBody>
    </div>
  );
}

export default MarkdownMath;
