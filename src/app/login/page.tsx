import Image from "next/image";
import type { Metadata } from "next";

import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: "Sign in | AngleBengal" };

/**
 * The login wall's one public page. Lives outside (tabs) on purpose: no
 * TopBar, no tab chrome, just a paper card on the desk.
 */
export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-desk p-4">
      <div className="w-full max-w-sm rounded-chip bg-paper-1 p-6 shadow-sheet">
        <div className="mb-5 flex items-center gap-2.5">
          <Image src="/anglebengal-mark-dark.svg" alt="" width={28} height={28} priority />
          <div>
            <div className="font-expanded text-ui-lg text-ink">AngleBengal</div>
            <div className="text-meta text-ink-soft">Sign in to continue</div>
          </div>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
