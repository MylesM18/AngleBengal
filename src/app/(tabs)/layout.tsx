import { Suspense } from "react";

import { AppShell } from "@/components/shell/AppShell";
import { ResumeTracker } from "@/components/shell/ResumeTracker";

export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      {/* Suspense because ResumeTracker reads useSearchParams; the tracker
          renders nothing, so the fallback is nothing too. */}
      <Suspense fallback={null}>
        <ResumeTracker />
      </Suspense>
      {children}
    </AppShell>
  );
}
