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
import { clearLibraryCommands } from "./library-review";
import { clearArticleCommands } from "./help-articles";
import { clearOperatorHelp } from "./operator-help";
interface AuthState {
  ready: boolean;
  session: Session | null;
  isAdmin: boolean;
  roles: string[];
  rolesReady: boolean;
  roleError: boolean;
  /** Bu oturumda daha önce etkin görülmüş roller (iptal mesajı için). */
  seenRoles: string[];
  /** D3 (Q00-A3-7): oturum admin claim'i taşıyor ama canlı `admins` kontrolü artık yetki vermiyor. */
  adminRevoked: boolean;
  refreshRoles: () => void;
}
const AuthContext = createContext<AuthState>({
  ready: false,
  session: null,
  isAdmin: false,
  roles: [],
  rolesReady: false,
  roleError: false,
  seenRoles: [],
  adminRevoked: false,
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
    seen: [] as string[],
    /** null = bilinmiyor (RPC yok/hata): yalnız kesin `false` iptal sayılır. */
    admin: null as boolean | null,
  });
  const [tick, setTick] = useState(0), sequence = useRef(0);
  const refreshRoles = useCallback(() => setTick((n) => n + 1), []);
  useEffect(() => {
    if (!isConfigured) return;
    let live = true, changed = false;
    let libraryUser: string | null | undefined;
    const apply = (session: Session | null) => {
      const nextUser = session?.user.id ?? null;
      if (libraryUser !== undefined && libraryUser !== nextUser) void clearLibraryCommands().catch(() => {});
      libraryUser = nextUser;
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
        try {
          clearArticleCommands();
        } catch { /* same identity boundary */ }
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
        const client = supabase();
        const [{ data, error }, admin] = await Promise.all([
          client.rpc("my_operation_roles"),
          // Canlı yönetici kontrolü; migration yoksa veya ağ hatasında "bilinmiyor" kalır.
          (client as unknown as { rpc: (n: string) => PromiseLike<{ data: unknown; error: unknown }> })
            .rpc("my_admin_access")
            .then((r) => (r.error || typeof r.data !== "boolean" ? null : r.data), () => null),
        ]);
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
          if (!data.includes("content")) {
            try {
              clearArticleCommands();
            } catch { /* access remains denied */ }
          }
          setRoleState((old) => ({
            user,
            roles: data as string[],
            error: false,
            // C07: bu oturumda bir kez görülen roller; kaldırılırsa ekran "yetkiniz kaldırıldı" der.
            seen: Array.from(new Set([...(old.user === user ? old.seen : []), ...(data as string[])])),
            admin: admin ?? (old.user === user ? old.admin : null),
          }));
        }
      } catch {
        if (live && request === sequence.current) {
          setRoleState((old) => ({
            user,
            roles: old.user === user ? old.roles : [],
            error: true,
            seen: old.user === user ? old.seen : [],
            admin: old.user === user ? old.admin : null,
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
        seenRoles: rolesReady ? roleState.seen : [],
        adminRevoked: rolesReady && state.isAdmin && roleState.admin === false,
        refreshRoles,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);
