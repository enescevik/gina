import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { childModeKey, childModeStorage } from "./child-mode-store";
import { useSession } from "./session";

export interface ActingChild { id: string; name: string }
interface ChildModeState {
  actingChild: ActingChild | null;
  loading: boolean;
  error: unknown;
  retry: () => void;
  enter: (child: ActingChild) => Promise<void>;
  exit: () => Promise<void>;
}
const ChildModeContext = createContext<ChildModeState | null>(null);

/** Persistent, per-account UI lock; RLS remains the authority for every server operation. */
export function ChildModeProvider({ children }: { children: ReactNode }) {
  const { session, loading: sessionLoading } = useSession();
  const userId = session?.user.id ?? null;
  const [state, setState] = useState<{ userId: string | null; child: ActingChild | null }>({ userId: null, child: null });
  const [hydrated, setHydrated] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (sessionLoading) return;
    let alive = true;
    async function restore() {
      try {
        const raw = userId ? await childModeStorage.get(childModeKey(userId)) : null;
        const child = raw ? JSON.parse(raw) as ActingChild : null;
        if (child && (typeof child.id !== "string" || !child.id || typeof child.name !== "string")) {
          throw new Error("child_mode_storage_invalid");
        }
        if (alive) { setError(null); setState({ userId, child }); setHydrated(userId); }
      } catch (e) { if (alive) setError(e); }
    }
    void restore();
    return () => { alive = false; };
  }, [userId, sessionLoading, attempt]);
  const value = useMemo<ChildModeState>(() => ({
    actingChild: state.userId === userId ? state.child : null,
    loading: sessionLoading || hydrated !== userId || !!error,
    error,
    retry: () => { setError(null); setHydrated(undefined); setAttempt(n => n + 1); },
    enter: async child => {
      if (!userId) throw new Error("unauthenticated");
      await childModeStorage.set(childModeKey(userId), JSON.stringify(child));
      setState({ userId, child });
    },
    exit: async () => {
      if (!userId) throw new Error("unauthenticated");
      // Keep the lock if durable storage fails. Call only after verify_parent_pin succeeds.
      await childModeStorage.remove(childModeKey(userId));
      setState({ userId, child: null });
    },
  }), [state, userId, hydrated, sessionLoading, error]);
  return <ChildModeContext.Provider value={value}>{children}</ChildModeContext.Provider>;
}
export function useChildMode(): ChildModeState {
  const ctx = useContext(ChildModeContext);
  if (!ctx) throw new Error("useChildMode requires ChildModeProvider");
  return ctx;
}
