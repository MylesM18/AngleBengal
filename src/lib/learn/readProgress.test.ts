import { describe, expect, it } from "vitest";

import { applyLatch, initialProgress, settleWrite } from "@/lib/learn/readProgress";

describe("read-progress latch core (spec 5.1: one way, never un-reads; spec 9.2: best-effort writes)", () => {
  it("latches a new section and asks for exactly one write", () => {
    const { state, toWrite } = applyLatch(initialProgress([]), 2);
    expect([...state.read]).toEqual([2]);
    expect(toWrite).toEqual([2]);
  });

  it("re-latching an already-read section writes nothing", () => {
    const first = applyLatch(initialProgress([]), 2).state;
    const second = applyLatch(first, 2);
    expect(second.toWrite).toEqual([]);
    expect(second.state).toBe(first);
  });

  it("sections read on the server never write", () => {
    const { toWrite } = applyLatch(initialProgress([1, 2]), 2);
    expect(toWrite).toEqual([]);
  });

  it("a failed write stays pending and retries on the next latch", () => {
    let state = applyLatch(initialProgress([]), 1).state;
    state = settleWrite(state, 1, false); // POST failed
    const next = applyLatch(state, 2);
    expect(next.toWrite).toEqual([2, 1]); // the new latch plus the retry
  });

  it("a settled write leaves the pending set", () => {
    let state = applyLatch(initialProgress([]), 1).state;
    state = settleWrite(state, 1, true);
    const next = applyLatch(state, 2);
    expect(next.toWrite).toEqual([2]);
  });

  it("read state is never removed by settling", () => {
    let state = applyLatch(initialProgress([]), 1).state;
    state = settleWrite(state, 1, false);
    expect(state.read.has(1)).toBe(true);
  });
});
