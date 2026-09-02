"use client";

import { useReaderTab } from "@/components/learn/ReaderTabContext";

/**
 * Swaps the sticky rail with the active pane (spec 8, owner decision 13): the
 * models TOC on the Models tab, the sections TOC on the Perspective tab. Falls
 * back to the models rail when the topic has no perspective yet.
 */
export function ReaderRail({
  models,
  perspective,
}: {
  models: React.ReactNode;
  perspective: React.ReactNode | null;
}) {
  const { active } = useReaderTab();
  return <>{active === "perspective" && perspective ? perspective : models}</>;
}

export default ReaderRail;
