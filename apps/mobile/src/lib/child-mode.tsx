import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export interface ActingChild {
  id: string;
  name: string;
}

interface ChildModeState {
  /** Veli telefonunda çocuk modundayken aktif çocuk; aksi hâlde null. */
  actingChild: ActingChild | null;
  enter: (child: ActingChild) => void;
  exit: () => void;
}

const ChildModeContext = createContext<ChildModeState | null>(null);

/**
 * Veli oturumu içindeki "çocuk modu" durumu. Yetki sınırı değildir (RLS veli kapsamında kalır);
 * yalnız arayüzü kısıtlar ve eylemleri çocuğa (acting_child_id) yazar. Çıkış veli PIN'i ister.
 */
export function ChildModeProvider({ children }: { children: ReactNode }) {
  const [actingChild, setActingChild] = useState<ActingChild | null>(null);
  const value = useMemo<ChildModeState>(
    () => ({ actingChild, enter: setActingChild, exit: () => setActingChild(null) }),
    [actingChild],
  );
  return <ChildModeContext.Provider value={value}>{children}</ChildModeContext.Provider>;
}

export function useChildMode(): ChildModeState {
  const ctx = useContext(ChildModeContext);
  if (!ctx) throw new Error("useChildMode, ChildModeProvider içinde kullanılmalı");
  return ctx;
}
