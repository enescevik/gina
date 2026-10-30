import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, type ReactNode } from "react";

import { useAuth } from "@/lib/auth";
import { t } from "@/lib/i18n";
import { isConfigured, supabase } from "@/lib/supabase";

const NAV = [
  { href: "/dashboard", label: t.nav.dashboard },
  { href: "/ai", label: t.nav.ai },
  { href: "/overrides", label: t.nav.overrides },
  { href: "/questions", label: t.nav.questions },
  { href: "/families", label: t.nav.families },
];

export async function signOut() {
  await supabase().auth.signOut();
}

/** Admin sayfa çerçevesi: oturum yoksa girişe yönlendirir, admin claim'i yoksa uyarı gösterir. */
export function Layout({ title, children }: { title: string; children: ReactNode }) {
  const router = useRouter();
  const { ready, session, isAdmin } = useAuth();

  useEffect(() => {
    if (ready && isConfigured && !session) void router.replace("/sign-in");
  }, [ready, session, router]);

  let body: ReactNode;
  if (!isConfigured) body = <Notice>{t.common.notConfigured}</Notice>;
  else if (!ready || !session) body = <p className="text-slate-500">{t.common.loading}</p>;
  else if (!isAdmin)
    body = (
      <Notice>
        {t.signIn.notAdmin}{" "}
        <button className="btn-secondary ml-2" onClick={() => void signOut()}>
          {t.nav.signOut}
        </button>
      </Notice>
    );
  else body = children;

  return (
    <>
      <Head>
        <title>{`${title} · ${t.appName}`}</title>
      </Head>
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3">
            <span className="font-semibold text-brand-dark">{t.appName}</span>
            {session && isAdmin ? (
              <nav className="flex flex-wrap gap-1">
                {NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded px-3 py-1.5 text-sm ${
                      router.pathname === item.href ? "bg-brand-light text-brand-dark" : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            ) : null}
            {session ? (
              <div className="ml-auto flex items-center gap-3 text-sm text-slate-500">
                <span>{session.user.email}</span>
                <button className="btn-secondary" onClick={() => void signOut()}>
                  {t.nav.signOut}
                </button>
              </div>
            ) : null}
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">
          <h1 className="mb-4 text-xl font-semibold">{title}</h1>
          {body}
        </main>
      </div>
    </>
  );
}

export function Notice({ children, tone = "warn" }: { children: ReactNode; tone?: "warn" | "error" | "ok" }) {
  const cls =
    tone === "error"
      ? "border-red-200 bg-red-50 text-red-800"
      : tone === "ok"
        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
        : "border-amber-200 bg-amber-50 text-amber-900";
  return <div className={`mb-4 rounded border px-3 py-2 text-sm ${cls}`}>{children}</div>;
}

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="mb-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      {title ? <h2 className="mb-3 font-medium text-slate-700">{title}</h2> : null}
      {children}
    </section>
  );
}
