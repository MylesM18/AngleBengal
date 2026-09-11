import Image from "next/image";
import type { Metadata } from "next";

import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: "Sign in | AngleBengal" };

/**
 * The login wall's one public page. Lives outside (tabs) on purpose: no
 * TopBar, no tab chrome, just a paper card. The ground is plum here and
 * nowhere else in the app (D-184): the sign-in page is the one screen with
 * no content of its own, so it gets the brand colour instead of the desk.
 */
export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-plum p-4">
      <div className="w-full max-w-sm rounded-chip bg-paper-1 p-6 shadow-sheet">
        <div className="mb-5 flex flex-col gap-1.5">
          <Image src="/anglebengal-lockup.svg" alt="AngleBengal" width={147} height={28} priority />
          <div className="text-meta text-ink-soft">Sign in to continue</div>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
