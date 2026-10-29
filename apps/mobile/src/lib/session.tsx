import type { Session } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { ginaClaimsSchema, type GinaClaims } from "@gina/core";

import { supabase } from "./supabase";

export interface SessionState {
  session: Session | null;
  claims: GinaClaims | null;
  /** Oturum depodan okunana kadar true. */
  loading: boolean;
  isAnonymous: boolean;
}

const SessionContext = createContext<SessionState | null>(null);

/** JWT gövdesindeki `gina` claim'ini okur (Custom Access Token Hook üretir). */
export function decodeClaims(accessToken: string | undefined): GinaClaims | null {
  const payload = accessToken?.split(".")[1];
  if (!payload) return null;
  try {
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as { gina?: unknown };
    const parsed = ginaClaimsSchema.safeParse(json.gina);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  const value = useMemo<SessionState>(
    () => ({
      session,
      claims: decodeClaims(session?.access_token),
      loading,
      isAnonymous: session?.user.is_anonymous === true,
    }),
    [session, loading],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession, SessionProvider içinde kullanılmalı");
  return ctx;
}

/** Rol değişiminden sonra (aile kurma, eşleşme, PIN girişi) yeni claim'li token alır. */
export async function refreshClaims(): Promise<GinaClaims | null> {
  const { data, error } = await supabase.auth.refreshSession();
  if (error) throw error;
  return decodeClaims(data.session?.access_token);
}
