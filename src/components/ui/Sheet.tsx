import type { ComponentPropsWithoutRef, ElementType } from "react";

import { cx } from "@/lib/cx";

/**
 * A sheet of stock on the desk (spec 1a): paper-1 for cards and panels,
 * paper-0 for reading sheets and active states, kraft for the one strip per
 * screen. Sheets carry shadow-sheet, radius-card and never a border.
 */
export type SheetTone = "paper-0" | "paper-1" | "kraft";
export type SheetTag = "div" | "section" | "article" | "aside" | "nav" | "li" | "header" | "footer";

const TONE_CLASS: Record<SheetTone, string> = {
  "paper-0": "bg-paper-0",
  "paper-1": "bg-paper-1",
  kraft: "stock-textured bg-kraft",
};

export type SheetProps<T extends SheetTag = "div"> = {
  as?: T;
  tone?: SheetTone;
  /** Hover lifts the sheet: shadow-lift plus a 1px rise (docs/08 "picked up, not glowing"). */
  lift?: boolean;
  className?: string;
} & Omit<ComponentPropsWithoutRef<T>, "as">;

export function Sheet<T extends SheetTag = "div">({
  as,
  tone = "paper-1",
  lift = false,
  className,
  ...rest
}: SheetProps<T>) {
  const Tag = (as ?? "div") as ElementType;
  return (
    <Tag
      className={cx(
        "rounded-card shadow-sheet",
        TONE_CLASS[tone],
        lift &&
          "transition-[box-shadow,transform] duration-150 ease-paper hover:-translate-y-px hover:shadow-lift",
        className,
      )}
      {...rest}
    />
  );
}

export default Sheet;
