import { describe, expect, it } from "vitest";

import { toBodies, type Body } from "@/components/learn/DocBody";
import { buildDocHtml } from "@/lib/learn/docHtml";
import type { ModelIndexEntry } from "@/lib/modelIndex";

const entry = (number: number, title: string): ModelIndexEntry => ({
  number,
  title,
  anchor: `model-${number}`,
});

/** Whether a slot renders a `doc-prose` wrapper, which is also what drives `flush`. */
const shape = (body: Body) => (body === null ? "absent" : "present");

const shapeOf = (result: ReturnType<typeof toBodies>) => ({
  preamble: shape(result.preamble),
  sections: result.sections.map((s) => shape(s.body)),
});

/**
 * The cached branch and the fallback branch must agree on which slots exist.
 * `flush` and the `doc-prose` wrapper both hang off that, so a disagreement
 * would move the first heading and change the DOM depending only on whether
 * the cache was warm. DocBody reaches the fallback whenever getRenderedDoc
 * throws, which non-negotiable 4 requires it to survive.
 */
const agrees = (md: string, models: ModelIndexEntry[]) => {
  const cached = shapeOf(toBodies(buildDocHtml(md, models), md, models));
  const fallback = shapeOf(toBodies(null, md, models));
  return { cached, fallback };
};

describe("toBodies", () => {
  it("agrees between the cached and fallback branches for an ordinary document", () => {
    const md = ["Intro.", "", "## Model 1: One", "", "Body one.", "", "## Model 2: Two", "", "Body two."].join("\n");

    const { cached, fallback } = agrees(md, [entry(1, "One"), entry(2, "Two")]);

    expect(cached).toEqual(fallback);
    expect(cached).toEqual({ preamble: "present", sections: ["present", "present"] });
  });

  it("agrees when a section has no body at all", () => {
    const md = ["Intro.", "", "## Model 1: One", "", "## Model 2: Two", "", "Body two."].join("\n");

    const { cached, fallback } = agrees(md, [entry(1, "One"), entry(2, "Two")]);

    expect(cached).toEqual(fallback);
    expect(cached.sections).toEqual(["absent", "present"]);
  });

  it("agrees when there is no preamble, which is what sets flush on the first heading", () => {
    const md = ["## Model 1: One", "", "Body one."].join("\n");

    const { cached, fallback } = agrees(md, [entry(1, "One")]);

    expect(cached).toEqual(fallback);
    expect(cached.preamble).toBe("absent");
  });

  it("agrees when a non-empty block renders to an empty string", () => {
    // A lone link definition is real markdown that produces no output. The
    // cached branch sees "" and the fallback branch sees the source text, so
    // a truthiness test here would report "absent" against "present" and
    // silently move the first heading from mt-9 to mt-0 on a cache hit.
    const md = ["[ref]: https://example.com", "", "## Model 1: One", "", "Body one."].join("\n");

    expect(buildDocHtml(md, [entry(1, "One")]).preambleHtml).toBe("");

    const { cached, fallback } = agrees(md, [entry(1, "One")]);

    expect(cached).toEqual(fallback);
    expect(cached.preamble).toBe("present");
  });
});
