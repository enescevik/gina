import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "./auth";
export function useSupportQuery<T>(
  load: () => Promise<T>,
  key: string,
  role: "support" | "content" = "support",
) {
  const { session, roles, roleError } = useAuth(),
    enabled = roles.includes(role) && !roleError;
  const identity = (session?.user.id ?? "") + ":" + role + ":" + key;
  const loader = useRef(load);
  useEffect(() => {
    loader.current = load;
  });
  const [state, setState] = useState<
    { key: string; data: T | null; error: boolean }
  >({ key: "", data: null, error: false });
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((n) => n + 1), []);
  useEffect(() => {
    if (!enabled) return;
    let live = true, request = 0;
    async function refresh() {
      const seq = ++request;
      try {
        const data = await loader.current();
        if (live && seq === request) {
          setState({ key: identity, data, error: false });
        }
      } catch {
        if (live && seq === request) {
          setState((old) => ({
            key: identity,
            data: old.key === identity ? old.data : null,
            error: true,
          }));
        }
      }
    }
    void refresh();
    const visible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const timer = setInterval(visible, 30000);
    window.addEventListener("focus", visible);
    document.addEventListener("visibilitychange", visible);
    return () => {
      live = false;
      clearInterval(timer);
      window.removeEventListener("focus", visible);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [identity, enabled, tick]);
  return {
    data: enabled && state.key === identity ? state.data : null,
    error: enabled && state.key === identity && state.error,
    loading: enabled && state.key !== identity,
    reload,
  };
}
