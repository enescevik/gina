import { useEffect, useState } from "react";

const families = ["Baloo2_600SemiBold", "Baloo2_700Bold", "Baloo2_800ExtraBold", "Nunito_400Regular", "Nunito_600SemiBold", "Nunito_700Bold"];

/** Static HTML declares font faces before their files are decoded. Avoid a serif first paint. */
export function useWebFontsReady(loaded: boolean, failed: boolean) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!loaded || failed) return;
    let live = true;
    // A failed/slow font must never make account recovery inaccessible.
    const timer = setTimeout(() => { if (live) setReady(true); }, 12000);
    const loading = typeof document.fonts?.load === "function"
      ? Promise.all(families.map(family => document.fonts.load(`16px "${family}"`)))
      : Promise.resolve();
    void loading
      .catch(() => undefined)
      .finally(() => { clearTimeout(timer); if (live) setReady(true); });
    return () => { live = false; clearTimeout(timer); };
  }, [loaded, failed]);
  return failed || ready;
}
