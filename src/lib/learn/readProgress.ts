/**
 * Pure core of the reading-progress latch (spec 5.1, 9.2). Read state only
 * ever grows; pending tracks writes that have not been confirmed, so a failed
 * POST is retried on the next latch instead of interrupting reading.
 */

export type ProgressState = {
  read: ReadonlySet<number>;
  pending: ReadonlySet<number>;
};

export function initialProgress(initialRead: number[]): ProgressState {
  return { read: new Set(initialRead), pending: new Set() };
}

export function applyLatch(
  state: ProgressState,
  n: number,
): { state: ProgressState; toWrite: number[] } {
  if (state.read.has(n)) return { state, toWrite: [] };
  const read = new Set(state.read);
  read.add(n);
  const pending = new Set(state.pending);
  const toWrite = [n, ...pending];
  pending.add(n);
  return { state: { read, pending }, toWrite };
}

export function settleWrite(state: ProgressState, n: number, ok: boolean): ProgressState {
  const pending = new Set(state.pending);
  if (ok) pending.delete(n);
  else pending.add(n);
  return { read: state.read, pending };
}
