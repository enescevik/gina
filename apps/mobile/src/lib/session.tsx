import type { Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { ginaClaimsSchema, type GinaClaims } from "@gina/core";

import { supabase } from "./supabase";
import { queryClient } from "./query";

export interface SessionState {
  session: Session | null;
  claims: GinaClaims | null;
  /** Oturum depodan okunana kadar true. */
  loading: boolean;
  isAnonymous: boolean;
  error: unknown;
  recovering: boolean;
  retry: () => void;
}

// Auth can consume the web recovery callback while fonts are still loading, before the provider mounts.
// Keep only the event kind (no token/password), for this JS runtime; clear on sign-out or password update.
let recoveryPending = false;
supabase.auth.onAuthStateChange(event => {
  if (event === "PASSWORD_RECOVERY") recoveryPending = true;
  else if (event === "SIGNED_OUT" || event === "USER_UPDATED" || event === "SIGNED_IN") recoveryPending = false;
});

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
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  const [recovering, setRecovering] = useState(() => recoveryPending);
  const account = useRef<string | null>(null);
  const retry = useCallback(() => { setLoading(true); setError(null); setAttempt(value => value + 1); }, []);

  useEffect(() => {
    let live = true;
    let changed = false;
    const apply = (next: Session | null) => {
      if (!live) return;
      // Clear before exposing another identity; query keys are shared across accounts.
      if (account.current !== (next?.user.id ?? null)) queryClient.clear();
      account.current = next?.user.id ?? null;
      setRecovering(recoveryPending);
      setSession(next);
      setError(null);
      setLoading(false);
    };
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      if (_event === "INITIAL_SESSION") return; // getSession below owns initial read errors.
      changed = true;
      setRecovering(recoveryPending);
      apply(next);
    });
    void supabase.auth.getSession().then(({ data, error: readError }) => {
      if (!live || changed) return;
      if (readError) throw readError;
      apply(data.session);
    }).catch(readError => {
      if (live && !changed) { setError(readError); setLoading(false); }
    });
    return () => { live = false; subscription.subscription.unsubscribe(); };
  }, [attempt]);

  const value = useMemo<SessionState>(
    () => ({
      session,
      claims: decodeClaims(session?.access_token),
      loading,
      isAnonymous: session?.user.is_anonymous === true,
      error,
      recovering,
      retry,
    }),
    [session, loading, error, recovering, retry],
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
