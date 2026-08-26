import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";

import { cx } from "@/lib/cx";
import { Icon, type IconName } from "@/components/ui/Icon";

export type ChipVariant = "nav" | "meta" | "action" | "toggle";

const BASE =
  "tap-target inline-flex h-6 min-w-8 items-center justify-center gap-1 whitespace-nowrap rounded-chip px-2 text-ui transition-[background-color,color,box-shadow,transform] duration-150 ease-paper";

const VARIANT: Record<ChipVariant, string> = {
  nav: "font-medium text-ink hover:bg-desk",
  // No font-size of its own: the meta chip takes BASE's `text-ui` (14px) like
  // every other variant. It used to override down to `text-meta` (12px).
  meta: "stock-textured bg-kraft font-medium text-ink",
  action: "text-ink shadow-sheet hover:bg-desk active:translate-y-px active:shadow-none",
  toggle: "text-ink hover:bg-desk active:translate-y-px",
};

/** The inverted state: current nav chip, pressed toggle. */
const ACTIVE = "bg-ink text-paper-0 hover:bg-ink focus-visible:outline-paper-0";

/**
 * The rest fill for the paper chips (nav, action, toggle). Applied only when not
 * active: `cx` is a plain joiner and Tailwind emits `.bg-ink` before
 * `.bg-paper-0`, so both on one element would leave the inverted chip blank.
 */
const REST_FILL = "bg-paper-0";

export function chipClasses({
  variant,
  active = false,
  className,
}: {
  variant: ChipVariant;
  active?: boolean;
  className?: string;
}): string {
  return cx(
    BASE,
    VARIANT[variant],
    variant !== "meta" && !active && REST_FILL,
    active && ACTIVE,
    className,
  );
}

export type ChipProps = {
  variant: ChipVariant;
  /** Toggle chips: the pressed state, exposed as aria-pressed. Radiogroup members pass role="radio" and aria-checked themselves. */
  pressed?: boolean;
  icon?: IconName;
} & ComponentPropsWithoutRef<"button">;

export function Chip({ variant, pressed, icon, className, children, type = "button", ...rest }: ChipProps) {
  const isToggle = variant === "toggle";
  return (
    <button
      type={type}
      className={chipClasses({ variant, active: isToggle && pressed === true, className })}
      aria-pressed={isToggle && rest.role !== "radio" ? pressed === true : undefined}
      {...rest}
    >
      {icon ? <Icon name={icon} /> : null}
      {children}
    </button>
  );
}

export type ChipLinkProps = {
  variant: "nav" | "action";
  /** Nav chips: the current route, exposed as aria-current="page" and the inverted look. */
  current?: boolean;
  icon?: IconName;
} & ComponentPropsWithoutRef<typeof Link>;

export function ChipLink({ variant, current = false, icon, className, children, ...rest }: ChipLinkProps) {
  return (
    <Link
      className={chipClasses({ variant, active: variant === "nav" && current, className })}
      aria-current={variant === "nav" && current ? "page" : undefined}
      {...rest}
    >
      {icon ? <Icon name={icon} /> : null}
      {children}
    </Link>
  );
}

export default Chip;
