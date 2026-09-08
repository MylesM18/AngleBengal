"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Sheet } from "@/components/ui/Sheet";
import { chipClasses } from "@/components/ui/Chip";
import { useIsDesktop } from "@/lib/useIsDesktop";
import {
  activePage,
  MAX_PAGES,
  useSketchStore,
} from "@/lib/sketch/store";

/**
 * The page strip between the graph rail and the canvas area (A16): page
 * chips on the left, then a fixed right cluster with Rename, Add, and the
 * Split control. Paper tone, NOT kraft: the one-kraft-strip rule stands
 * (docs/06:119), and the toolbar plus GraphRail already spend the screen's
 * kraft budget (D-172).
 *
 * The chip row is the app's one deliberate horizontal scroller outside
 * `.doc-prose`: it carries the literal `overflow-x-auto` token because the
 * overflow rig (e2e/helpers/overflow.ts) exempts x-axis scrollers by class
 * token only, and any other spelling reads as a defect at 360px. Rename and
 * Split live in the right cluster rather than beside the active chip (A17)
 * so activating a page never changes chip geometry mid-tap.
 */

const SPLIT_OPTIONS: { value: 0 | 2 | 3 | 4; label: string }[] = [
  { value: 0, label: "Off" },
  { value: 2, label: "2 panes" },
  { value: 3, label: "3 panes" },
  { value: 4, label: "4 panes" },
];

export function PageBar() {
  const pages = useSketchStore((state) => state.pages);
  const pageOrder = useSketchStore((state) => state.pageOrder);
  const activePageId = useSketchStore((state) => state.activePageId);
  const activeName = useSketchStore((state) => activePage(state).name);
  const splitCount = useSketchStore((state) => state.splitPageIds.length);

  // Below lg the split control offers only Off and 2 panes (A12, D-171): a
  // phone's 2x2 grid leaves each canvas too small to handwrite math. The
  // popover can only open after hydration, so isDesktop is resolved by the
  // time this list is read. One exception: a 3-4 pane split set on desktop
  // survives a viewport shrink (A12 keeps splitPageIds, compact just renders
  // two panes), and a radiogroup with no checked member breaks both the
  // radio semantics and the arrow-key math below, so the CURRENT count joins
  // the compact list whenever it is 3 or 4. It cannot be chosen into
  // existence on compact; it only reflects a state desktop created.
  const isDesktop = useIsDesktop();
  const splitOptions =
    isDesktop === false
      ? SPLIT_OPTIONS.filter(
          (option) => option.value <= 2 || option.value === splitCount,
        )
      : SPLIT_OPTIONS;

  const renameTriggerRef = useRef<HTMLButtonElement | null>(null);
  const renamePopoverRef = useRef<HTMLDivElement | null>(null);
  const splitTriggerRef = useRef<HTMLButtonElement | null>(null);
  const splitPopoverRef = useRef<HTMLDivElement | null>(null);
  /** null closed; "form" the rename input; "confirm" the inline delete ask. */
  const [renameOpen, setRenameOpen] = useState<"form" | "confirm" | null>(null);
  const [splitOpen, setSplitOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const deleteTitleId = useId();

  const atCap = pageOrder.length >= MAX_PAGES;
  const lastPage = pageOrder.length <= 1;

  /**
   * Makes a page active without breaking the active-visible-while-split
   * invariant (A5): the store's setActivePage happily activates an unshown
   * page, so while split, an unshown page enters THROUGH the active pane via
   * setPanePage, which activates it as a side effect of replacing the active
   * page's pane.
   */
  const activatePage = useCallback((id: string) => {
    const state = useSketchStore.getState();
    if (id === state.activePageId || !state.pages[id]) return;
    if (state.splitPageIds.length > 0 && !state.splitPageIds.includes(id)) {
      const paneIndex = state.splitPageIds.indexOf(state.activePageId);
      if (paneIndex !== -1) {
        state.setPanePage(paneIndex, id);
        return;
      }
    }
    state.setActivePage(id);
  }, []);

  /** Arrow-key movement over the page radios, same shape as the toolbar's
   *  Background group: arrows both select and move focus. */
  function onPagesKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const delta =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (delta === 0) return;
    event.preventDefault();
    const index = pageOrder.indexOf(activePageId);
    const nextIndex = (index + delta + pageOrder.length) % pageOrder.length;
    activatePage(pageOrder[nextIndex]);
    event.currentTarget
      .querySelectorAll<HTMLButtonElement>('[role="radio"]')
      [nextIndex]?.focus();
  }

  function addPage() {
    const created = useSketchStore.getState().addPage();
    // addPage deliberately does not activate (store contract); focus follows
    // the new page here, through the same split-safe path as a chip tap.
    if (created) activatePage(created);
  }

  function toggleRename() {
    if (renameOpen) {
      closeRename();
      return;
    }
    setDraft(activeName);
    setRenameOpen("form");
  }

  function closeRename() {
    setRenameOpen(null);
    renameTriggerRef.current?.focus();
  }

  function saveRename() {
    const state = useSketchStore.getState();
    state.renamePage(state.activePageId, draft);
    closeRename();
  }

  function deletePage() {
    const state = useSketchStore.getState();
    state.removePage(state.activePageId);
    closeRename();
  }

  function closeSplit() {
    setSplitOpen(false);
    splitTriggerRef.current?.focus();
  }

  function chooseSplit(count: 0 | 2 | 3 | 4) {
    useSketchStore.getState().setSplit(count);
    closeSplit();
  }

  /** Arrow keys select within the split radios without closing the popover;
   *  clicking (or Enter/Space on a radio button) selects and closes. */
  function onSplitKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const delta =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (delta === 0) return;
    event.preventDefault();
    const index = splitOptions.findIndex((option) => option.value === splitCount);
    // Defensive: with no checked member, (-1 + delta) arithmetic would land
    // on an arbitrary option and a single arrow press would CHANGE the
    // split (historically to Off, destroying a 3-4 pane split the moment a
    // keyboard touched the compact popover). The current-count option above
    // should make this unreachable, but if it ever happens the first arrow
    // only moves focus to the first option and changes nothing.
    if (index === -1) {
      event.currentTarget
        .querySelectorAll<HTMLButtonElement>('[role="radio"]')[0]
        ?.focus();
      return;
    }
    const nextIndex = (index + delta + splitOptions.length) % splitOptions.length;
    useSketchStore.getState().setSplit(splitOptions[nextIndex].value);
    event.currentTarget
      .querySelectorAll<HTMLButtonElement>('[role="radio"]')
      [nextIndex]?.focus();
  }

  function onRenameKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    closeRename();
  }

  function onSplitPopoverKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    closeSplit();
  }

  // Same open-popover discipline as the toolbar's Clear confirm (A18): focus
  // moves into the popover on open, and any pointerdown outside the popover
  // and its trigger closes it without moving focus.
  useEffect(() => {
    if (!renameOpen) return;
    if (renameOpen === "form") {
      const input = renamePopoverRef.current?.querySelector("input");
      input?.focus();
      input?.select();
    } else {
      // Confirm view: the last button is Cancel, the safe default.
      const buttons = renamePopoverRef.current?.querySelectorAll<HTMLButtonElement>("button");
      buttons?.[buttons.length - 1]?.focus();
    }
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (renamePopoverRef.current?.contains(target)) return;
      if (renameTriggerRef.current?.contains(target)) return;
      setRenameOpen(null);
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [renameOpen]);

  useEffect(() => {
    if (!splitOpen) return;
    const radios = splitPopoverRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
    const checked = splitPopoverRef.current?.querySelector<HTMLButtonElement>(
      '[role="radio"][aria-checked="true"]',
    );
    (checked ?? radios?.[0])?.focus();
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (splitPopoverRef.current?.contains(target)) return;
      if (splitTriggerRef.current?.contains(target)) return;
      setSplitOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [splitOpen]);

  return (
    // `relative`: this root is both popovers' containing block (A17, A18).
    // py-3 (not the strips' py-2) buys D-071's vertical clearance on compact:
    // the rail's chips spill their 44px hit areas up to ~9px below the rail,
    // and the page chips spill ~10px above their own row, so 12px of padding
    // on each side keeps both spillovers landing on this container instead of
    // a control (D-164 precedent). gap-3 is the >=12px non-scrolling gutter
    // between the scroller and the right cluster (A17).
    <div className="relative flex shrink-0 items-center gap-3 border-b border-hairline bg-paper-1 py-3 pr-[max(0.75rem,env(safe-area-inset-right))]">
      <div
        role="radiogroup"
        aria-label="Pages"
        onKeyDown={onPagesKeyDown}
        // Safe-area left padding lives INSIDE the scrollable box (A17) so the
        // first chip can still scroll flush to the strip's edge on a notch
        // device without the strip itself shifting.
        className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto pl-[max(0.75rem,env(safe-area-inset-left))] max-lg:gap-3"
      >
        {pageOrder.map((id) => {
          const checked = id === activePageId;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={checked ? 0 : -1}
              onClick={() => activatePage(id)}
              // shrink-0: a chip must keep its intrinsic width and push the
              // row into the scroller rather than crushing its label.
              className={chipClasses({ variant: "toggle", active: checked, className: "shrink-0" })}
            >
              {pages[id]?.name}
            </button>
          );
        })}
      </div>

      {/* The fixed right cluster (A17): never scrolls, so Rename, Add and
          Split stay reachable however many pages the scroller holds. 32px
          icon chips spill 6px of hit area per side on compact, hence gap-3. */}
      <div className="flex shrink-0 items-center gap-1 max-lg:gap-3">
        <button
          ref={renameTriggerRef}
          type="button"
          aria-label="Rename page"
          title="Rename page"
          aria-haspopup="dialog"
          aria-expanded={renameOpen !== null}
          onClick={toggleRename}
          className={chipClasses({ variant: "action" })}
        >
          <Icon name="pen" />
        </button>
        <button
          type="button"
          aria-label="Add page"
          title={atCap ? "8 page limit" : "Add page"}
          disabled={atCap}
          onClick={addPage}
          className={chipClasses({ variant: "action", className: "disabled:opacity-60" })}
        >
          <Icon name="plus" />
        </button>
        <button
          ref={splitTriggerRef}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={splitOpen}
          onClick={() => setSplitOpen((open) => !open)}
          className={chipClasses({ variant: "action" })}
        >
          Split
        </button>
      </div>

      {renameOpen && (
        <div
          ref={renamePopoverRef}
          role="dialog"
          aria-label={renameOpen === "form" ? "Rename page" : undefined}
          aria-labelledby={renameOpen === "confirm" ? deleteTitleId : undefined}
          onKeyDown={onRenameKeyDown}
          // Anchored to the strip root, never the scroller (A18): compact
          // centers the fixed w-64 box within the strip, lg hangs it under
          // the right cluster where its trigger lives.
          className="absolute top-full z-20 mt-2 w-64 max-lg:inset-x-3 max-lg:mx-auto lg:right-3"
        >
          <Sheet tone="paper-0" lift className="flex flex-col gap-3 p-3">
            {renameOpen === "form" ? (
              <>
                <label className="flex flex-col gap-1 text-ui text-ink">
                  Page name
                  <input
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") return;
                      event.preventDefault();
                      saveRename();
                    }}
                    maxLength={60}
                    className="rounded-input border border-ink-faint bg-paper-0 px-2 py-1 text-ui text-ink"
                  />
                </label>
                <div className="flex items-center justify-end gap-2">
                  <Button
                    size="sm"
                    variant="tertiary"
                    disabled={lastPage}
                    onClick={() => setRenameOpen("confirm")}
                    className="mr-auto max-lg:tap-target"
                  >
                    Delete page
                  </Button>
                  <Button
                    size="sm"
                    variant="tertiary"
                    onClick={closeRename}
                    className="max-lg:tap-target"
                  >
                    Cancel
                  </Button>
                  <Button size="sm" onClick={saveRename} className="max-lg:tap-target">
                    Save
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p id={deleteTitleId} className="text-ui text-ink">
                  Delete this page? This cannot be undone.
                </p>
                <div className="flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={deletePage}
                    className="max-lg:tap-target"
                  >
                    Delete page
                  </Button>
                  <Button
                    size="sm"
                    variant="tertiary"
                    onClick={() => setRenameOpen("form")}
                    className="max-lg:tap-target"
                  >
                    Cancel
                  </Button>
                </div>
              </>
            )}
          </Sheet>
        </div>
      )}

      {splitOpen && (
        <div
          ref={splitPopoverRef}
          role="dialog"
          aria-label="Split"
          onKeyDown={onSplitPopoverKeyDown}
          className="absolute top-full z-20 mt-2 w-64 max-lg:inset-x-3 max-lg:mx-auto lg:right-3"
        >
          <Sheet tone="paper-0" lift className="p-3">
            <div
              role="radiogroup"
              aria-label="Split"
              onKeyDown={onSplitKeyDown}
              className="flex flex-wrap gap-1 max-lg:gap-3"
            >
              {splitOptions.map(({ value, label }) => {
                const checked = splitCount === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={checked}
                    tabIndex={checked ? 0 : -1}
                    onClick={() => chooseSplit(value)}
                    className={chipClasses({ variant: "toggle", active: checked })}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </Sheet>
        </div>
      )}
    </div>
  );
}
