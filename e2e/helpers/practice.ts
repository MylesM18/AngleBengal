import { expect, type Page } from "@playwright/test";

/**
 * Puts the practice panel into the state the spec actually asks about.
 *
 * The plan names the route "/practice with a served problem", and it means it:
 * the problem statement, its display math, the answer row with its unit and
 * result spans, the Calculator chip and the Submit / Skip / Show solution row
 * only exist once a problem is on screen. Measuring the panel without one
 * measures the empty state, which is a handful of paragraphs and proves close
 * to nothing.
 *
 * The panel opens on difficulty 2 and `/api/problems/next` has no cross
 * difficulty fallback, while this app's verified pool sits at difficulty 5, so
 * the default view is "Nothing verified and unsolved at difficulty 2 yet".
 * Clicking 5 is what serves a problem.
 */
export type PracticeState = { served: boolean; detail: string };

export async function servePracticeProblem(page: Page): Promise<PracticeState> {
  const five = page
    .getByRole("group", { name: "Difficulty" })
    .getByRole("button", { name: "5", exact: true });

  if ((await five.count()) === 0) {
    return { served: false, detail: "no difficulty selector on the page" };
  }

  await five.first().click();

  // Either a problem arrives or the pool answers empty. Both are legitimate
  // states of this single user app, so wait for whichever settles and report
  // which one, rather than timing out on the assumption that one must happen.
  const submit = page.getByRole("button", { name: /^(Submit|Checking\.\.\.)$/ });
  const empty = page.getByText(/Nothing verified and unsolved at difficulty/);

  await expect
    .poll(async () => (await submit.count()) > 0 || (await empty.count()) > 0, {
      timeout: 20_000,
      message: "The practice panel resolved to neither a problem nor the empty state.",
    })
    .toBe(true);

  const state: PracticeState =
    (await submit.count()) > 0
      ? { served: true, detail: "a problem is on screen at difficulty 5" }
      : { served: false, detail: "the difficulty 5 pool is empty" };

  /*
   * Printed, not just annotated. A green run that quietly measured the empty
   * state looks identical to one that measured a served problem, and the whole
   * point of this helper is that those are not the same assertion.
   */
  console.log(`  practice panel: ${state.detail}`);
  return state;
}
