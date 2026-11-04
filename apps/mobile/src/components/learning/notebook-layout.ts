import type { ModalProps } from "react-native";

/** The notebook follows the available window, never requests device rotation. */
export function notebookLayout(width: number, height: number, fontScale = 1) {
  // Stacking two toolbars and a question above the canvas leaves no writing room
  // at accessibility text sizes. Tabs preserve a full pane for each activity.
  if (fontScale >= 1.4) return "tabs";
  if (width >= 850 && width > height) return "side-by-side";
  if (width >= 600 && height >= 650) return "stacked";
  return "tabs";
}

/** Reveal inserted material without moving the document or scrolling while drawing. */
export function notebookRevealOffset(
  start: number,
  size: number,
  viewport: number,
  content: number,
  current: number,
) {
  const margin = 16;
  const target = size + margin * 2 > viewport || start < current + margin
    ? start - margin
    : start + size > current + viewport - margin
    ? start + size - viewport + margin
    : current;
  return Math.max(0, Math.min(Math.max(0, content - viewport), target));
}

/** Match the app's iPad orientations, including upside-down portrait.
 * A default RN Modal is portrait-only and can rotate the host on presentation.
 */
export const NOTEBOOK_MODAL_PROPS = {
  supportedOrientations: [
    "portrait",
    "portrait-upside-down",
    "landscape-left",
    "landscape-right",
  ],
  presentationStyle: "overFullScreen",
} satisfies Pick<ModalProps, "supportedOrientations" | "presentationStyle">;
