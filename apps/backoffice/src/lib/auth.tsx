import type { Session } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { isConfigured, readGinaClaim, supabase } from "./supabase";

interface AuthState {
  ready: boolean;
  session: Session | null;
  /** Yalnız arayüz için; asıl yetki RLS/RPC'de (gina.is_admin_strict). */
  isAdmin: boolean;
}

const AuthContext = createContext<AuthState>({ ready: false, session: null, isAdmin: false });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ ready: !isConfigured, session: null, isAdmin: false });

  useEffect(() => {
    if (!isConfigured) return;
    const client = supabase();
    const apply = (session: Session | null) =>
      setState({ ready: true, session, isAdmin: readGinaClaim(session?.access_token)?.admin === true });

    void client.auth.getSession().then(({ data }) => apply(data.session));
    const { data } = client.auth.onAuthStateChange((_event, session) => apply(session));
    return () => data.subscription.unsubscribe();
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
