"use client";

import { createContext, useContext, useMemo, useState } from "react";

export type ReaderTabName = "perspective" | "models";

type ReaderTabValue = { active: ReaderTabName; setActive: (tab: ReaderTabName) => void };

const ReaderTabContext = createContext<ReaderTabValue | null>(null);

/**
 * The Perspective | Models tab state, lifted out of PerspectiveTabs (spec 8)
 * so the page's rail column can swap TOCs with the active pane. Still local
 * client state, both panes still stay mounted: D-103's guarantees hold, only
 * the owner of the useState moved one level up.
 */
export function ReaderTabProvider({
  hasPerspective,
  children,
}: {
  hasPerspective: boolean;
  children: React.ReactNode;
}) {
  // Default per perspective spec §9: Perspective when the doc exists.
  const [active, setActive] = useState<ReaderTabName>(hasPerspective ? "perspective" : "models");
  const value = useMemo(() => ({ active, setActive }), [active]);
  return <ReaderTabContext.Provider value={value}>{children}</ReaderTabContext.Provider>;
}

export function useReaderTabOptional(): ReaderTabValue | null {
  return useContext(ReaderTabContext);
}

export function useReaderTab(): ReaderTabValue {
  const value = useContext(ReaderTabContext);
  if (!value) throw new Error("useReaderTab must be used inside ReaderTabProvider");
  return value;
}
