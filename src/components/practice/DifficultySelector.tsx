"use client";

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
      <div className="flex gap-1" role="group" aria-label="Difficulty">
        {[1, 2, 3, 4, 5].map((level) => {
          const active = level === value;
          const pool = counts[level] ?? 0;
          return (
            <button
              key={level}
              type="button"
              disabled={disabled}
              onClick={() => onChange(level)}
              aria-pressed={active}
              title={`Difficulty ${level}: ${pool} ready`}
              className={`relative h-7 w-7 rounded-chip text-[12.5px] font-bold transition-colors disabled:opacity-50 ${
                active
                  ? "bg-brand text-paper-0"
                  : "bg-paper-0 text-ink hover:bg-brand-tint"
              }`}
            >
              {level}
              {pool > 0 && !active && (
                <span
                  aria-hidden
                  className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-green"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
