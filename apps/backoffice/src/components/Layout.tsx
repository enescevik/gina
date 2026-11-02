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
  { href: "/operations", label: "AI işlemleri" },
  { href: "/overrides", label: t.nav.overrides },
  { href: "/questions", label: t.nav.questions },
  { href: "/library", label: "GINA kütüphanesi" },
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
      <div className="admin-shell">
        <aside className="admin-sidebar">
          <Link href="/dashboard" className="admin-brand" aria-label="GINA yönetim ana sayfa">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo.png" width="132" height="56" alt="gina" />
            <span>Yönetim alanı</span>
          </Link>
          {session && isAdmin ? <nav aria-label="Yönetim bölümleri">
            {NAV.map(item=><Link key={item.href} href={item.href} aria-current={router.pathname===item.href?'page':undefined}
              className={router.pathname===item.href?'admin-nav active':'admin-nav'}>{item.label}</Link>)}
          </nav>:null}
          {session?<div className="admin-account"><span>{session.user.email}</span><button className="btn-secondary" onClick={()=>void signOut()}>{t.nav.signOut}</button></div>:null}
        </aside>
        <main className="admin-main"><header className="admin-page-heading"><h1>{title}</h1><span className="admin-badge">GINA Aile</span></header>{body}</main>
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
    <section className="admin-card">
      {title ? <h2 className="mb-4 text-lg font-bold text-slate-800">{title}</h2> : null}
      {children}
    </section>
  );
}
