"use client";

import { useCallback } from "react";

import { useCopiedReporter } from "@/components/learn/CopyLinkToaster";
import { Icon } from "@/components/ui/Icon";

/**
 * The copy-link affordance on a model heading, the one interactive leaf in an
 * otherwise server-rendered document body.
 */
export function CopyLinkButton({ anchor, number }: { anchor: string; number: number }) {
  const onCopied = useCopiedReporter();

  const copyLink = useCallback(async () => {
    const url = new URL(window.location.href);
    url.hash = anchor;
    try {
      await navigator.clipboard.writeText(url.toString());
      onCopied(true);
    } catch {
      onCopied(false);
    }
  }, [anchor, onCopied]);

  return (
    <button
      type="button"
      onClick={copyLink}
      aria-label={`Copy link to model ${number}`}
      title={`Copy link to model ${number}`}
      className="ml-2 inline-flex h-6 w-6 items-center justify-center rounded-chip align-middle text-ink-soft opacity-0 hover:text-plum focus:opacity-100 group-hover:opacity-100"
    >
      <Icon name="copy" size={14} />
    </button>
  );
}

export default CopyLinkButton;
