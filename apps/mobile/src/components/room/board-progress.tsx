import { SkinProgress } from "./nine-slice";
/** Actual completion ratio on the approved teal track. */
export function BoardProgress({ done, total, s = 1 }: { done: number; total: number; s?: number; statuses?: readonly boolean[] }) {
  return <SkinProgress value={total > 0 ? done / total : 0} scale={s} track="progress-bar-teal-track" fill="progress-bar-teal-fill" />;
}
