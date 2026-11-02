import type { ModalProps } from "react-native";

/** The notebook follows the available window, never requests device rotation. */
export function notebookLayout(width: number, height: number, fontScale = 1) {
  if (width >= 850 && width > height && fontScale < 1.4) return "side-by-side";
  if (width >= 600 && height >= 650) return "stacked";
  return "tabs";
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
