/** A device-local countdown, never evidence of learning or task completion. */
export const FOCUS_MINUTES = [5, 10, 15, 25] as const;
export type FocusState = {
  version: 1;
  taskId: string;
  durationMs: number;
  remainingMs: number;
  phase: 'focus' | 'break' | 'finished';
  runningSince: number | null;
  breakRemainingMs: number;
};
export type FocusAction = 'pause' | 'resume' | 'break' | 'return';
const MINUTE = 60_000;
export function startFocus(taskId: string, minutes: number, now: number): FocusState {
  if (!taskId || !FOCUS_MINUTES.some(m => m === minutes) || !Number.isSafeInteger(now) || now < 0) throw new Error('invalid_focus');
  return { version: 1, taskId, durationMs: minutes * MINUTE, remainingMs: minutes * MINUTE, phase: 'focus', runningSince: now, breakRemainingMs: 0 };
}
/** Suspended JS is not a clock. Recompute from timestamps on foreground/reopen. */
export function advanceFocus(state: FocusState, now: number): FocusState {
  if (state.runningSince === null) return state;
  // A clock moved backwards cannot silently extend a running session.
  if (now < state.runningSince) return { ...state, runningSince: null };
  const delta = now - state.runningSince;
  if (state.phase === 'break') {
    const left = Math.max(0, state.breakRemainingMs - delta);
    return left ? { ...state, breakRemainingMs: left, runningSince: now }
      : { ...state, phase: 'focus', breakRemainingMs: 0, runningSince: null };
  }
  const left = Math.max(0, state.remainingMs - delta);
  return { ...state, remainingMs: left, phase: left ? 'focus' : 'finished', runningSince: left ? now : null };
}
export function changeFocus(state: FocusState, action: FocusAction, now: number): FocusState {
  const next = advanceFocus(state, now);
  if (next.phase === 'finished') return next;
  if (action === 'pause') return { ...next, runningSince: null };
  if (action === 'resume') return { ...next, runningSince: now };
  if (action === 'break' && next.phase === 'focus') return { ...next, phase: 'break', breakRemainingMs: 5 * MINUTE, runningSince: now };
  if (action === 'return' && next.phase === 'break') return { ...next, phase: 'focus', breakRemainingMs: 0, runningSince: null };
  return next;
}
export function parseFocus(raw: string | null): FocusState | null {
  if (raw === null) return null;
  const x = JSON.parse(raw) as FocusState;
  const validTime = (n: unknown) => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;
  if (!x || x.version !== 1 || typeof x.taskId !== 'string' || !x.taskId || x.taskId.length > 128
    || !FOCUS_MINUTES.some(m => m * MINUTE === x.durationMs)
    || !validTime(x.remainingMs) || x.remainingMs > x.durationMs
    || !['focus', 'break', 'finished'].includes(x.phase)
    || !(x.runningSince === null || validTime(x.runningSince))
    || !validTime(x.breakRemainingMs) || x.breakRemainingMs > 5 * MINUTE
    || (x.phase === 'finished' && (x.remainingMs !== 0 || x.runningSince !== null))
    || (x.phase !== 'finished' && x.remainingMs === 0)
    || (x.phase === 'break' ? x.breakRemainingMs === 0 : x.breakRemainingMs !== 0)) throw new Error('invalid_focus');
  return x;
}

export const FOCUS_PREFIX = 'gina:focus:v1:';
export function focusScope(user: string, family: string, child: string, day: string) {
  if (![user, family, child, day].every(Boolean)) throw new Error('invalid_focus_scope');
  return FOCUS_PREFIX + [user, family, child, day].map(encodeURIComponent).join(':');
}
export function createFocusStorage(store: { get: (key: string) => string | null; set: (key: string, value: string) => void; remove: (key: string) => void }, key: string, guard = () => {}) {
  let last: string | null;
  return {
    read() { guard(); last = store.get(key); return parseFocus(last); },
    write(value: FocusState | null) {
      guard();
      if (store.get(key) !== last) throw new Error('focus_changed');
      const raw = value === null ? null : JSON.stringify(value);
      if (raw !== null) parseFocus(raw);
      if (raw === null) store.remove(key); else store.set(key, raw);
      last = raw;
    },
  };
}
