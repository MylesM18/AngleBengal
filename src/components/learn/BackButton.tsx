"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

/**
 * Returns the reader to wherever they came from (practice, a diagnosis link,
 * the Learn index), which the breadcrumb cannot do: it only walks up the
 * topic tree. A fresh tab or a shared deep link has no history to go back
 * to, so the button falls back to the Learn index rather than dead-ending.
 */
export function BackButton() {
  const router = useRouter();

  const goBack = () => {
    if (window.history.length > 1) router.back();
    else router.push("/learn");
  };

  return (
    <Button type="button" variant="tertiary" size="sm" onClick={goBack} aria-label="Go back">
      <Icon name="chevron" className="rotate-180" />
      Back
    </Button>
  );
}

export default BackButton;
