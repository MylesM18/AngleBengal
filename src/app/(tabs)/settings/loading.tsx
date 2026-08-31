import { Sheet } from "@/components/ui/Sheet";
import { Skeleton } from "@/components/ui/Skeleton";

/** Loading state for Settings (D-116). The usage table is a database read, so
 *  the heading holds still and only the table shimmers. */
export default function SettingsLoading() {
  return (
    <div className="h-full overflow-y-auto p-2" role="status" aria-label="Loading Settings">
      <div className="max-w-[860px] pt-8 sm:pt-16">
        <h1 className="display-cut text-h1 text-ink">Settings</h1>
        <Sheet tone="paper-1" className="mt-6 overflow-hidden">
          <div aria-hidden className="flex flex-col gap-3 p-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-5 w-full" />
            ))}
          </div>
        </Sheet>
      </div>
      <span className="sr-only">Loading Settings...</span>
    </div>
  );
}
