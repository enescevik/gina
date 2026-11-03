import type { Session } from "@supabase/supabase-js";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { isConfigured, readGinaClaim, supabase } from "./supabase";
import { clearOperatorHelp } from "./operator-help";
interface AuthState {
  ready: boolean;
  session: Session | null;
  isAdmin: boolean;
  roles: string[];
  rolesReady: boolean;
  roleError: boolean;
  refreshRoles: () => void;
}
const AuthContext = createContext<AuthState>({
  ready: false,
  session: null,
  isAdmin: false,
  roles: [],
  rolesReady: false,
  roleError: false,
  refreshRoles: () => {},
});
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState({
    ready: !isConfigured,
    session: null as Session | null,
    isAdmin: false,
  });
  const [roleState, setRoleState] = useState({
    user: "",
    roles: [] as string[],
    error: false,
  });
  const [tick, setTick] = useState(0), sequence = useRef(0);
  const refreshRoles = useCallback(() => setTick((n) => n + 1), []);
  useEffect(() => {
    if (!isConfigured) return;
    let live = true, changed = false;
    const apply = (session: Session | null) => {
      if (live) {
        setState({
          ready: true,
          session,
          isAdmin: readGinaClaim(session?.access_token)?.admin === true,
        });
      }
    };
    const client = supabase();
    void client.auth.getSession().then(({ data, error }) => {
      if (!changed) apply(error ? null : data.session);
    });
    const { data } = client.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") return;
      changed = true;
      if (event === "SIGNED_OUT") {
        try {
          clearOperatorHelp();
        } catch { /* scope guard invalidated first */ }
      }
      apply(session);
    });
    return () => {
      live = false;
      data.subscription.unsubscribe();
    };
  }, []);
  const user = state.session?.user.id ?? "";
  useEffect(() => {
    if (!user) return;
    let live = true;
    async function refresh() {
      const request = ++sequence.current;
      try {
        const { data, error } = await supabase().rpc("my_operation_roles");
        if (
          error || !Array.isArray(data) ||
          !data.every((v) =>
            typeof v === "string" &&
            ["support", "content", "finance", "release"].includes(v)
          )
        ) throw Error("roles_unavailable");
        if (live && request === sequence.current) {
          if (!data.includes("support")) {
            try {
              clearOperatorHelp();
            } catch { /* access stays denied */ }
          }
          setRoleState({ user, roles: data as string[], error: false });
        }
      } catch {
        if (live && request === sequence.current) {
          setRoleState((old) => ({
            user,
            roles: old.user === user ? old.roles : [],
            error: true,
          }));
        }
      }
    }
    void refresh();
    const foreground = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const timer = setInterval(foreground, 30000);
    window.addEventListener("focus", foreground);
    document.addEventListener("visibilitychange", foreground);
    return () => {
      live = false;
      clearInterval(timer);
      window.removeEventListener("focus", foreground);
      document.removeEventListener("visibilitychange", foreground);
    };
  }, [user, tick]);
  const rolesReady = !!user && roleState.user === user;
  return (
    <AuthContext.Provider
      value={{
        ...state,
        roles: rolesReady ? roleState.roles : [],
        rolesReady,
        roleError: rolesReady && roleState.error,
        refreshRoles,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);
