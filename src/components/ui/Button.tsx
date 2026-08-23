import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";

import { cx } from "@/lib/cx";
import { Icon, type IconName } from "@/components/ui/Icon";

export type ButtonVariant = "primary" | "secondary" | "tertiary" | "destructive";
export type ButtonSize = "sm" | "md";
export type ButtonTone = "brand" | "plum";

const BASE =
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-input text-ui font-semibold transition-[background-color,box-shadow,transform] duration-150 ease-paper active:translate-y-px active:shadow-none disabled:pointer-events-none disabled:opacity-50";

const SIZE_H: Record<ButtonSize, string> = {
  sm: "h-6",
  md: "h-8",
};

/** Side padding for the filled and outlined variants; tertiary keeps its own px-1. */
const SIZE_PX: Record<ButtonSize, string> = {
  sm: "px-2.5",
  md: "px-3.5",
};

const VARIANT: Record<ButtonVariant, string> = {
  primary: "shadow-sheet text-paper-0",
  secondary: "border-[1.5px] border-ink bg-paper-0 text-ink hover:bg-paper-1",
  tertiary: "px-1 text-cobalt underline-offset-2 hover:underline",
  destructive: "bg-red text-paper-0 shadow-sheet hover:shadow-lift",
};

const PRIMARY_TONE: Record<ButtonTone, string> = {
  brand: "bg-brand hover:bg-brand-deep",
  plum: "bg-plum hover:shadow-lift focus-visible:outline-paper-0",
};

export function buttonClasses({
  variant = "primary",
  size = "md",
  tone = "brand",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  tone?: ButtonTone;
  className?: string;
}): string {
  return cx(
    BASE,
    SIZE_H[size],
    variant !== "tertiary" && SIZE_PX[size],
    VARIANT[variant],
    variant === "primary" && PRIMARY_TONE[tone],
    className,
  );
}

type SharedProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Primary only (spec 5d): plum is used by the tutor Send and nowhere else. */
  tone?: ButtonTone;
  icon?: IconName;
};

export type ButtonProps = SharedProps & {
  /** Disables the button and marks it busy; pair with a label change like "Checking...". */
  loading?: boolean;
} & ComponentPropsWithoutRef<"button">;

export function Button({
  variant,
  size,
  tone,
  icon,
  loading = false,
  className,
  children,
  type = "button",
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses({ variant, size, tone, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {icon ? <Icon name={icon} /> : null}
      {children}
    </button>
  );
}

export type ButtonLinkProps = SharedProps & ComponentPropsWithoutRef<typeof Link>;

export function ButtonLink({ variant, size, tone, icon, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={buttonClasses({ variant, size, tone, className })} {...rest}>
      {icon ? <Icon name={icon} /> : null}
      {children}
    </Link>
  );
}

export default Button;
