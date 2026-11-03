import { useRouter } from "next/router";
import { useEffect } from "react";

import { useAuth } from "@/lib/auth";
import { t } from "@/lib/i18n";

export default function Home() {
  const router = useRouter();
  const { ready, session, isAdmin, rolesReady, roles } = useAuth();
  useEffect(() => {
    if (!ready) return;
    if (!session) void router.replace("/sign-in");
    else if (isAdmin) void router.replace("/dashboard");
    else if (rolesReady) void router.replace(roles.includes("support") ? "/support" : "/sign-in");
  }, [ready, session, isAdmin, rolesReady, roles, router]);
  return <p className="p-6 text-slate-500">{t.common.loading}</p>;
}
