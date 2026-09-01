"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { Toast } from "@/components/ui/Toast";

type ToastState = { id: number; kind: "success" | "error"; message: string };

const CopiedContext = createContext<(ok: boolean) => void>(() => {});

/** The channel a CopyLinkButton reports its clipboard result on. */
export function useCopiedReporter() {
  return useContext(CopiedContext);
}

/**
 * Owns the reading sheet's copy-link toast, one at a time, and takes the
 * document body as a pass-through `children` slot.
 *
 * This is the same pattern PerspectiveTabs uses: server-rendered content sits
 * between the provider and the CopyLinkButton leaves as inert serialized
 * elements, and context still reaches those leaves on the client. It is what
 * lets DocBody be a server component even though the copy buttons inside it
 * are interactive.
 */
export function CopyLinkToaster({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);

  const handleCopied = useCallback((ok: boolean) => {
    setToast((prev) => ({
      id: (prev?.id ?? 0) + 1,
      kind: ok ? "success" : "error",
      message: ok ? "Link copied" : "Could not copy the link",
    }));
  }, []);

  const hideToast = useCallback(() => setToast(null), []);

  return (
    <CopiedContext.Provider value={handleCopied}>
      {children}

      {/*
        Portalled to <body> on purpose. The reading sheet carries
        `animate-enter-sheet`, whose fill-mode `both` leaves a computed
        transform behind even though the last keyframe says `transform: none`.
        A transformed ancestor becomes the containing block for `fixed`
        descendants, so in place this slip anchored to the sheet's bottom
        rather than the viewport's. See D-059.

        `toast` is null on the first render, so createPortal is never reached
        during SSR, where `document` does not exist.
      */}
      {toast
        ? createPortal(
            <Toast
              key={toast.id}
              kind={toast.kind}
              message={toast.message}
              onDismiss={hideToast}
              className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 max-lg:bottom-[calc(4.5rem+env(safe-area-inset-bottom))]"
            />,
            document.body,
          )
        : null}
    </CopiedContext.Provider>
  );
}

export default CopyLinkToaster;
