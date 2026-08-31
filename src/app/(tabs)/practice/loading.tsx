import { Skeleton } from "@/components/ui/Skeleton";

/** Loading state for the Practice landing (D-116). Same frame as the page, so
 *  the heading and its copy do not move when the topic lists arrive. */
export default function PracticeLoading() {
  return (
    <div className="h-full overflow-y-auto p-2 sm:p-0" role="status" aria-label="Loading Practice">
      <div className="mx-auto max-w-[760px] py-8 sm:px-8 sm:py-10">
        <h1 className="display-cut text-h1 leading-tight text-ink">Practice</h1>
        <p className="mt-2 max-w-[54ch] text-ui leading-relaxed text-ink-soft">
          Verified problems tagged to the models they exercise. A wrong answer is diagnosed back to
          the model that failed, so pick the topic you want to be tested on.
        </p>

        <section className="mt-8">
          <h2 className="meta-caps mb-3 text-ink-soft">Ready to practice</h2>
          <ul aria-hidden className="flex flex-col gap-2">
            {[0, 1, 2, 3].map((i) => (
              <li key={i}>
                <Skeleton className="h-[68px] w-full rounded-card" />
              </li>
            ))}
          </ul>
        </section>
      </div>
      <span className="sr-only">Loading Practice...</span>
    </div>
  );
}
