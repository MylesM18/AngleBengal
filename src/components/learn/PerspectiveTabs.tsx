"use client";

import { useState } from "react";

import { PerspectivePane } from "@/components/learn/PerspectivePane";
import { cx } from "@/lib/cx";

export type PerspectiveTabsProps = {
  topicId: string;
  perspective: { contentMd: string } | null;
  /** True right after topic creation: generation starts by itself (spec §9). */
  autoFire: boolean;
  /** The Models pane: the existing reader subtree, server-rendered. */
  children: React.ReactNode;
};

type TabName = "perspective" | "models";

/**
 * The reader's top-level Perspective | Models control (perspective spec §9).
 *
 * Local state, not URL state (D-103): the Perspective pane can hold an
 * in-flight generation, and a URL navigation would remount the subtree and
 * drop it. Both panes stay mounted with the inactive one hidden, which is
 * also what lets the auto-fired generation keep running while the reader
 * sits on the Models tab, then render on completion without a reload.
 */
export function PerspectiveTabs({ topicId, perspective, autoFire, children }: PerspectiveTabsProps) {
  // Default per spec §9: Perspective when the doc exists, Models when it
  // does not. The just-created flow lands on Models by that same rule.
  const [active, setActive] = useState<TabName>(perspective ? "perspective" : "models");

  const tab = (name: TabName, label: string) => (
    <button
      type="button"
      role="tab"
      id={`tab-${name}`}
      aria-selected={active === name}
      aria-controls={`pane-${name}`}
      onClick={() => setActive(name)}
      className={cx(
        "shrink-0 rounded-t-chip border border-b-0 px-3 py-1.5 text-ui font-medium",
        active === name
          ? "border-hairline bg-paper-0 text-ink"
          : "border-transparent bg-transparent text-ink-soft hover:text-ink",
      )}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div
        role="tablist"
        aria-label="Perspective and models"
        className="stock-textured flex items-stretch gap-1 overflow-x-auto border-b border-hairline bg-kraft px-2 pt-2"
      >
        {tab("perspective", "Perspective")}
        {tab("models", "Models")}
      </div>

      <div
        role="tabpanel"
        id="pane-perspective"
        aria-labelledby="tab-perspective"
        hidden={active !== "perspective"}
      >
        <PerspectivePane
          topicId={topicId}
          initialContentMd={perspective?.contentMd ?? null}
          autoFire={autoFire}
        />
      </div>
      <div role="tabpanel" id="pane-models" aria-labelledby="tab-models" hidden={active !== "models"}>
        {children}
      </div>
    </div>
  );
}

export default PerspectiveTabs;
