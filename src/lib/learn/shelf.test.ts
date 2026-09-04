import { describe, expect, it } from "vitest";

import { partitionHidden, shelfTree, sortFavoritesFirst } from "@/lib/learn/shelf";

type Node = {
  name: string;
  hidden: boolean;
  favoritedAt: number | null;
  children: Node[];
};

function node(name: string, over: Partial<Node> = {}): Node {
  return { name, hidden: false, favoritedAt: null, children: [], ...over };
}

describe("sortFavoritesFirst (subjects spec 1.3)", () => {
  it("pins favorites first, ordered by when they were favorited", () => {
    const items = [
      node("a"),
      node("b", { favoritedAt: 200 }),
      node("c"),
      node("d", { favoritedAt: 100 }),
    ];
    expect(sortFavoritesFirst(items).map((item) => item.name)).toEqual(["d", "b", "a", "c"]);
  });

  it("keeps non-favorites in their incoming order", () => {
    const items = [node("z"), node("m"), node("a")];
    expect(sortFavoritesFirst(items).map((item) => item.name)).toEqual(["z", "m", "a"]);
  });

  it("returns an unfavorited item to its normal position", () => {
    const favored = [node("a"), node("b", { favoritedAt: 5 })];
    expect(sortFavoritesFirst(favored).map((item) => item.name)).toEqual(["b", "a"]);
    const unfavored = favored.map((item) => ({ ...item, favoritedAt: null }));
    expect(sortFavoritesFirst(unfavored).map((item) => item.name)).toEqual(["a", "b"]);
  });

  it("does not mutate its input", () => {
    const items = [node("a"), node("b", { favoritedAt: 1 })];
    sortFavoritesFirst(items);
    expect(items.map((item) => item.name)).toEqual(["a", "b"]);
  });
});

describe("partitionHidden (subjects spec 1.3)", () => {
  it("splits hidden from visible, preserving order in both", () => {
    const items = [node("a"), node("b", { hidden: true }), node("c"), node("d", { hidden: true })];
    const { visible, hidden } = partitionHidden(items);
    expect(visible.map((item) => item.name)).toEqual(["a", "c"]);
    expect(hidden.map((item) => item.name)).toEqual(["b", "d"]);
  });

  it("handles the all-visible and all-hidden extremes", () => {
    expect(partitionHidden([node("a")]).hidden).toEqual([]);
    expect(partitionHidden([node("a", { hidden: true })]).visible).toEqual([]);
  });
});

describe("shelfTree (subjects spec 8.4)", () => {
  it("drops hidden nodes at every depth and orders each level favorites-first", () => {
    const tree = [
      node("root-b", {
        children: [
          node("child-hidden", { hidden: true }),
          node("child-plain"),
          node("child-fav", { favoritedAt: 10 }),
        ],
      }),
      node("root-hidden", { hidden: true, children: [node("orphan")] }),
      node("root-fav", { favoritedAt: 3 }),
    ];
    const shelved = shelfTree(tree);
    expect(shelved.map((item) => item.name)).toEqual(["root-fav", "root-b"]);
    expect(shelved[1].children.map((item) => item.name)).toEqual(["child-fav", "child-plain"]);
  });
});
