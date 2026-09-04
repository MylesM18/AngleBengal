import type { SVGProps } from "react";

/**
 * The app's icon set (spec 1f, D-048): fourteen 16px glyphs drawn as 1.5px
 * strokes in currentColor. No icon dependency. Paths live on a 16x16 grid.
 */
export type IconName =
  | "pen"
  | "eraser"
  | "undo"
  | "clear"
  | "grid"
  | "graph"
  | "plus"
  | "chevron"
  | "check"
  | "cross"
  | "copy"
  | "close"
  | "star"
  | "hide";

const PATHS: Record<IconName, string> = {
  pen: "M11.5 2.5l2 2L5 13H3v-2l8.5-8.5z M10 4l2 2",
  eraser: "M9.5 3l3.5 3.5L8 11.5H4.5L2.5 9.5 9.5 3z M5 13h8",
  undo: "M3 7h7a3 3 0 0 1 0 6H6 M3 7l3-3 M3 7l3 3",
  clear: "M3 4.5h10 M6 4.5V3h4v1.5 M4.5 4.5l.7 8.5h5.6l.7-8.5",
  grid: "M3 3h10v10H3z M3 8h10 M8 3v10",
  graph: "M8 2v12 M2 8h12 M4.5 11.5l2.5-3 2 1.5 2.5-4",
  plus: "M8 3v10 M3 8h10",
  chevron: "M6 3l5 5-5 5",
  check: "M3 8.5l3 3 7-7",
  cross: "M4 4l8 8 M12 4l-8 8",
  copy: "M6 6h7v7H6z M3 10V3h7",
  close: "M3.5 3.5l9 9 M12.5 3.5l-9 9",
  star: "M8 2.5l1.7 3.6 3.9.5-2.9 2.7.7 3.9L8 11.4l-3.4 1.8.7-3.9L2.4 6.6l3.9-.5L8 2.5z",
  hide: "M2 8s2.2-3.5 6-3.5S14 8 14 8s-2.2 3.5-6 3.5S2 8 2 8z M6.6 8a1.4 1.4 0 1 0 2.8 0 1.4 1.4 0 0 0-2.8 0z M3.5 12.5l9-9",
};

export type IconProps = {
  name: IconName;
  /** Rendered box in px. 16 is the system size; 20 and 24 exist for the drawer mark slot only. */
  size?: number;
  className?: string;
  /** When present the icon is announced; otherwise it is decorative. */
  title?: string;
} & Omit<SVGProps<SVGSVGElement>, "name" | "width" | "height" | "children">;

export function Icon({ name, size = 16, className, title, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      focusable="false"
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      <path d={PATHS[name]} />
    </svg>
  );
}

export default Icon;
