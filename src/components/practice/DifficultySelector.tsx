"use client";

import { Chip } from "@/components/ui/Chip";

/** Difficulty 1-5 (docs/06 §3), with the verified-and-unsolved pool count. */
export function DifficultySelector({
  value,
  counts,
  disabled,
  onChange,
}: {
  value: number;
  counts: Record<number, number>;
  disabled: boolean;
  onChange: (difficulty: number) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="meta-caps text-ink-soft">Difficulty</span>
      {/* These render 32px wide, and on compact each carries a 44px hit area
          (Chip's `max-lg:tap-target`), which spills (44 - 32) / 2 = 6px past
          each visible edge. D-071's rule therefore asks for at least 12px
          between neighbors; the desktop `gap-1` (4px) left them overlapping by
          8px, so the right edge of one chip selected the next difficulty.
          `lg` and up keeps `gap-1` and no longer has a hit area to overlap. */}
      <div className="flex gap-1 max-lg:gap-3" role="group" aria-label="Difficulty">
        {[1, 2, 3, 4, 5].map((level) => {
          const active = level === value;
          const pool = counts[level] ?? 0;
          return (
            <Chip
              key={level}
              variant="toggle"
              pressed={active}
              disabled={disabled}
              onClick={() => onChange(level)}
              title={`Difficulty ${level}: ${pool} ready`}
              className="relative font-semibold disabled:opacity-50"
            >
              {level}
              {pool > 0 && !active && (
                <span
                  aria-hidden
                  className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-green"
                />
              )}
            </Chip>
          );
        })}
      </div>
    </div>
  );
}
