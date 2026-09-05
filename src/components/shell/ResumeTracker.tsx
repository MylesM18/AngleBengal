"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { reportPath } from "@/lib/resume/client";

/**
 * Records where the app is as the owner moves (D-156), so the root page can
 * land there next time. Renders nothing; lives in the tabs layout so every
 * tab reports through one instance. The hooks are the change signal; the
 * reported string comes from window.location so it matches byte for byte
 * what the learn reader compares against on restore.
 */
export function ResumeTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    reportPath(window.location.pathname + window.location.search);
  }, [pathname, searchParams]);

  return null;
}
