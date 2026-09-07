import type { Page } from "@playwright/test";

/**
 * The route list the rig walks (mobile fix plan Phase 7).
 *
 * Topic ids are never hard coded. The library was wiped during the perspective
 * work and regenerates on demand, so any id written into a test would be a
 * time bomb. Ids come from `GET /api/topics`, which already returns the whole
 * tree with `docCount` and `verifiedProblemCount` per node (docs/04). Reading
 * the counts beats crawling the shelves: crawling needs a visit budget, and a
 * budget that is one page too small silently skips the reader, which is the
 * richest surface in the app and the one most worth testing.
 *
 * An empty library is reported as a loud skip rather than a failure. It is a
 * legitimate state of this single user app, and a gate that goes red on one is
 * a gate that gets switched off.
 */

export type Route = { path: string; name: string };

/** Present regardless of what is in the database. */
export const STATIC_ROUTES: Route[] = [
  { path: "/", name: "root (redirects to the resume target)" },
  { path: "/learn", name: "learn shelf" },
  { path: "/practice", name: "practice shelf" },
  { path: "/settings", name: "settings" },
];

/** `/login` is public (guard.ts allowlist), so it is tested signed out. */
export const LOGIN_ROUTE: Route = { path: "/login", name: "login" };

export type DiscoveredRoutes = {
  /** A `/learn/<id>` that renders the reader, so it has the Perspective | Models tabs. */
  reader: Route | null;
  /** Any `/learn/<id>`, reader or hub, whichever the tree offered first. */
  topic: Route | null;
  /** That topic's history page. */
  history: Route | null;
  /** A `/practice/<id>` for a topic that actually has verified problems. */
  practice: Route | null;
  /** Why something is null, so a skip can name its reason. */
  notes: string[];
};

type TopicNode = {
  id: string;
  name: string;
  hidden: boolean;
  docCount: number;
  verifiedProblemCount: number;
  children: TopicNode[];
};

function flatten(nodes: TopicNode[]): TopicNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children ?? [])]);
}

/**
 * Turns a topic into the URL that actually renders the READER.
 *
 * `docCount > 0` is not the app's condition for showing one. The topic page
 * opens the reader when the topic has exactly one document (D-008) or when
 * `?doc=` names one, and otherwise renders a hub that lists documents. Picking
 * a multi-document topic and navigating to the bare path would therefore land
 * on the hub, where `#tab-models` does not exist, and every reader test would
 * turn from a skip into a 15 second locator timeout whose message never says
 * why. So: try the bare path, and if the tabs are absent, take the first
 * `?doc=` link the hub offers.
 */
async function readerUrl(page: Page, topicId: string): Promise<string | null> {
  await page.goto(`/learn/${topicId}`);
  if ((await page.locator("#tab-models").count()) > 0) return `/learn/${topicId}`;

  const href = await page.evaluate(() => {
    for (const anchor of Array.from(document.querySelectorAll('a[href*="?doc="]'))) {
      const value = anchor.getAttribute("href");
      if (value !== null && value.startsWith("/learn/")) return value;
    }
    return null;
  });
  if (href === null) return null;

  await page.goto(href);
  return (await page.locator("#tab-models").count()) > 0 ? href : null;
}

export async function discoverRoutes(page: Page): Promise<DiscoveredRoutes> {
  const notes: string[] = [];

  // Shares the context cookies, so the minted session gets it past the wall.
  const response = await page.request.get("/api/topics");
  if (!response.ok()) {
    return {
      reader: null,
      topic: null,
      history: null,
      practice: null,
      notes: [`GET /api/topics answered ${response.status()}, so nothing could be discovered.`],
    };
  }

  const all = flatten((await response.json()) as TopicNode[]);
  if (all.length === 0) notes.push("The topic tree is empty.");

  // Hidden topics are off the shelves but their routes still work, so they are
  // fine to test. Preferring a visible one keeps the run closer to real use.
  const byVisibleFirst = [...all].sort((a, b) => Number(a.hidden) - Number(b.hidden));

  // A single document topic is the cheapest reader: its bare path already
  // renders the tabs, so it needs no `?doc=` round trip.
  const readerNode =
    byVisibleFirst.find((node) => node.docCount === 1) ??
    byVisibleFirst.find((node) => node.docCount > 0) ??
    null;
  const topicNode = readerNode ?? byVisibleFirst[0] ?? null;
  const practiceNode = byVisibleFirst.find((node) => node.verifiedProblemCount > 0) ?? null;

  const readerPath = readerNode === null ? null : await readerUrl(page, readerNode.id);
  if (readerNode !== null && readerPath === null) {
    notes.push(
      `Topic "${readerNode.name}" reports ${readerNode.docCount} document(s) but ` +
        "neither its own page nor any document link on it rendered the reader tabs.",
    );
  }

  if (readerNode === null && all.length > 0) {
    notes.push(
      `${all.length} topic(s) exist but none has a generated document ` +
        "(every docCount is 0), so there is no reader to open.",
    );
  }
  if (practiceNode === null && all.length > 0) {
    notes.push(
      `No topic has a verified problem (every verifiedProblemCount is 0), ` +
        "so the practice panel has nothing to serve.",
    );
  }

  return {
    reader:
      readerNode === null || readerPath === null
        ? null
        : { path: readerPath, name: `learn reader (${readerNode.name})` },
    topic:
      topicNode === null
        ? null
        : { path: `/learn/${topicNode.id}`, name: `learn topic (${topicNode.name})` },
    history:
      topicNode === null
        ? null
        : { path: `/learn/${topicNode.id}/history`, name: "learn history" },
    practice:
      practiceNode === null
        ? null
        : { path: `/practice/${practiceNode.id}`, name: `practice panel (${practiceNode.name})` },
    notes,
  };
}
