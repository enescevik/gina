import { useRouter } from "next/router";
import { useEffect } from "react";

import { useAuth } from "@/lib/auth";
import { t } from "@/lib/i18n";

export default function Home() {
  const router = useRouter();
  const { ready, session } = useAuth();
  useEffect(() => {
    if (ready) void router.replace(session ? "/dashboard" : "/sign-in");
  }, [ready, session, router]);
  return <p className="p-6 text-slate-500">{t.common.loading}</p>;
}
