import Head from "next/head";
import { PublicationIcon } from "./library-publication-icon";
import Link from "next/link";
import { useRouter } from "next/router";
import { type ReactNode, useEffect, useState } from "react";

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
  { href: "/groups", label: "Birlikte Prova" },
  { href: "/families", label: t.nav.families },
];

export async function signOut(confirmed = false) {
  if (
    !confirmed &&
    !window.dispatchEvent(
      new CustomEvent("gina:signout", {
        cancelable: true,
        detail: () => void signOut(true),
      }),
    )
  ) return;
  await supabase().auth.signOut();
}

/** Admin sayfa çerçevesi: oturum yoksa girişe yönlendirir, admin claim'i yoksa uyarı gösterir. */
export function Layout(
  { title, children, support = false, content = false, compact = false }: {
    title: string;
    children: ReactNode;
    support?: boolean;
    content?: boolean;
    compact?: boolean;
  },
) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const publication = router.pathname === "/library-publication";
  const activePath = router.pathname === "/library-publication"
    ? "/library"
    : router.pathname;
  const {
    ready,
    session,
    isAdmin,
    roles,
    rolesReady,
    roleError,
    refreshRoles,
  } = useAuth();
  const requiredRole = content ? "content" : "support";
  const operation = support || content;
  const allowed = operation
    ? rolesReady && roles.includes(requiredRole)
    : isAdmin;

  useEffect(() => {
    if (ready && isConfigured && !session) void router.replace("/sign-in");
  }, [ready, session, router]);

  let body: ReactNode;
  if (!isConfigured) body = <Notice>{t.common.notConfigured}</Notice>;
  else if (!ready || !session) {
    body = <p className="text-slate-500">{t.common.loading}</p>;
  } else if (operation) {
    // A temporary role-check failure blocks reads/actions without destroying
    // the operator's unsent in-memory draft. Confirmed revocation unmounts it.
    body = (
      <>
        {!rolesReady
          ? <p>Yetkiniz kontrol ediliyor…</p>
          : roleError
          ? (
            <Notice tone="error">
              Yetki kontrolü tamamlanamadı.{" "}
              <button className="btn-secondary" onClick={refreshRoles}>
                Yeniden dene
              </button>
            </Notice>
          )
          : !allowed
          ? (
            <Notice>
              {content
                ? "Bu bölümü açmak için etkin içerik yetkisi gerekiyor."
                : "Bu bölümü açmak için etkin destek yetkisi gerekiyor."}{" "}
              <button className="btn-secondary" onClick={() => void signOut()}>
                Çıkış yap
              </button>
            </Notice>
          )
          : null}
        <div hidden={roleError || !allowed}>{allowed ? children : null}</div>
      </>
    );
  } else if (!allowed) {
    body = (
      <Notice>
        {t.signIn.notAdmin}{" "}
        <button className="btn-secondary ml-2" onClick={() => void signOut()}>
          {t.nav.signOut}
        </button>
      </Notice>
    );
  } else body = children;

  return (
    <>
      <Head>
        <title>{`${title} · ${t.appName}`}</title>
      </Head>
      <div className={"admin-shell" + (operation || compact ? " support-shell" : "")}>
        <aside className={"admin-sidebar" + (menuOpen ? " menu-open" : "")}>
          {operation || compact
            ? (
              <button
                className="admin-nav-toggle"
                aria-label="Yönetim menüsü"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen(!menuOpen)}
              >
                ☰ Menü
              </button>
            )
            : null}
          <Link
            href={isAdmin
              ? "/dashboard"
              : roles.includes("support")
              ? "/support"
              : "/help-articles"}
            className="admin-brand"
            aria-label="GINA yönetim ana sayfa"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo.png" width="132" height="56" alt="gina" />
            <span>Yönetim alanı</span>
          </Link>
          {session &&
              (isAdmin || roles.includes("support") ||
                roles.includes("content"))
            ? (
              <nav aria-label="Yönetim bölümleri">
                {publication && isAdmin ? (
                  <Link
                    href="/library"
                    aria-current="page"
                    className="admin-nav active publication-library-nav"
                  >
                    <PublicationIcon name="layers" /> Kütüphane
                  </Link>
                ) : null}
                {publication ? (
                  <details className="publication-other-nav">
                    <summary>Diğer bölümler</summary>
                    {(isAdmin ? NAV.filter(item => item.href !== "/library") : [])
                      .map(item => (
                        <Link key={item.href} href={item.href} className="admin-nav">
                          {item.label}
                        </Link>
                      ))}
                  </details>
                ) : null}
                {(isAdmin && !publication ? NAV : []).map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={activePath === item.href
                      ? "page"
                      : undefined}
                    className={activePath === item.href
                      ? "admin-nav active"
                      : "admin-nav"}
                  >
                    {item.label}
                  </Link>
                ))}
                {roles.includes("support")
                  ? (
                    <>
                      <Link
                        href="/support"
                        className={router.pathname === "/support"
                          ? "admin-nav active"
                          : "admin-nav"}
                        aria-current={router.pathname === "/support"
                          ? "page"
                          : undefined}
                      >
                        Destek
                      </Link>
                      <Link
                        href="/ideas"
                        className={router.pathname === "/ideas"
                          ? "admin-nav active"
                          : "admin-nav"}
                        aria-current={router.pathname === "/ideas"
                          ? "page"
                          : undefined}
                      >
                        Fikirler
                      </Link>
                    </>
                  )
                  : null}
                {roles.includes("content")
                  ? (
                    <Link
                      href="/help-articles"
                      className={router.pathname === "/help-articles"
                        ? "admin-nav active"
                        : "admin-nav"}
                      aria-current={router.pathname === "/help-articles"
                        ? "page"
                        : undefined}
                    >
                      Yardım yazıları
                    </Link>
                  )
                  : null}
              </nav>
            )
            : null}
          {session
            ? (
              <div className="admin-account">
                <span>
                  {isAdmin
                    ? "Yönetici"
                    : roles.includes("support")
                    ? "Destek ekibi"
                    : roles.includes("content")
                    ? "İçerik ekibi"
                    : "Yetkili oturumu"}
                </span>
                <span>{session.user.email}</span>
                <button
                  className="btn-secondary"
                  onClick={() => void signOut()}
                >
                  {t.nav.signOut}
                </button>
              </div>
            )
            : null}
        </aside>
        <main className="admin-main">
          {publication && allowed ? null : (
            <header className="admin-page-heading">
              <h1>{title}</h1>
              <span className="admin-badge">GINA Aile</span>
            </header>
          )}
          {body}
        </main>
      </div>
    </>
  );
}

export function Notice(
  { children, tone = "warn" }: {
    children: ReactNode;
    tone?: "warn" | "error" | "ok";
  },
) {
  const cls = tone === "error"
    ? "border-red-200 bg-red-50 text-red-800"
    : tone === "ok"
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : "border-amber-200 bg-amber-50 text-amber-900";
  return (
    <div className={`mb-4 rounded border px-3 py-2 text-sm ${cls}`}>
      {children}
    </div>
  );
}

export function Card(
  { title, children }: { title?: string; children: ReactNode },
) {
  return (
    <section className="admin-card">
      {title
        ? <h2 className="mb-4 text-lg font-bold text-slate-800">{title}</h2>
        : null}
      {children}
    </section>
  );
}
