import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** A short crossfade keeps the room anchored; never slide a whole world across the screen. */
export function useRouteMotion() {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (live) setReduced(value); });
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => { live = false; listener.remove(); };
  }, []);
  return { animation: reduced ? 'none' as const : 'fade' as const, animationDuration: 180 };
}
