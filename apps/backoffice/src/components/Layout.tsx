import Head from "next/head";
import { PublicationIcon, type PublicationIconName } from "./library-publication-icon";
import Link from "next/link";
import { useRouter } from "next/router";
import { createContext, type ReactNode, useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "@/lib/auth";
import { OperatorAccessContext } from "@/lib/use-async";
import { t } from "@/lib/i18n";
import { isConfigured, supabase } from "@/lib/supabase";

const NAV = [
  { href: "/dashboard", label: t.nav.dashboard },
  { href: "/ai", label: t.nav.ai },
  { href: "/input-catalog", label: "Hazır seçenekler" },
  { href: "/operations", label: "AI işlemleri" },
  { href: "/overrides", label: t.nav.overrides },
  { href: "/questions", label: t.nav.questions },
  { href: "/library", label: "GINA kütüphanesi" },
  { href: "/groups", label: "Birlikte Prova" },
  { href: "/families", label: t.nav.families },
  { href: "/operator-scopes", label: "Operatör kapsamları" },
];
export type OperatorRole = "support" | "content" | "finance" | "release";
/** C07 rol matrisi: tam yönetici olmayan operatörün göreceği ek bölümler (yönetici NAV'ı zaten görür). */
const OPERATOR_NAV: { href: string; label: string; roles: OperatorRole[] }[] = [
  { href: "/dashboard", label: "İş kuyruğum", roles: ["support", "content", "finance", "release"] },
  { href: "/library", label: "GINA kütüphanesi", roles: ["content", "release"] },
  { href: "/groups", label: "Birlikte Prova", roles: ["content"] },
];
export const HeaderActionContext = createContext<HTMLElement | null>(null);
const navIcons: Record<string, PublicationIconName> = {
  "/dashboard": "grid", "/ai": "idea", "/operations": "check",
  "/overrides": "lock", "/questions": "document", "/library": "layers",
  "/input-catalog": "document",
  "/groups": "school", "/families": "family", "/operator-scopes": "lock",
};

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
  { title, children, support = false, content = false, finance = false, release = false, roles: anyOf, compact = false }: {
    title: string;
    children: ReactNode;
    support?: boolean;
    content?: boolean;
    finance?: boolean;
    release?: boolean;
    /** C07: sayfa bu rollerden herhangi birine açık (tam yönetici her rolü taşır). */
    roles?: OperatorRole[];
    compact?: boolean;
  },
) {
  const router = useRouter();
  void compact;
  const [menuOpen, setMenuOpen] = useState(false);
  const [headerTarget, setHeaderTarget] = useState<HTMLDivElement | null>(null);
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
    seenRoles,
    adminRevoked,
    refreshRoles,
  } = useAuth();
  const nav = useRef<HTMLElement | null>(null);
  const [below, setBelow] = useState(0);
  // Q00-A3-4: dikey kaydırmalı menüde görünmeyen bölüm sayısı; macOS gizli kaydırma çubuğunda ipucu verir.
  const measure = useCallback(() => {
    const el = nav.current;
    if (!el || el.scrollHeight <= el.clientHeight + 4) { setBelow(0); return; }
    const bottom = el.getBoundingClientRect().bottom;
    setBelow(Array.from(el.querySelectorAll("a.admin-nav")).filter((a) => a.getBoundingClientRect().top > bottom - 24).length);
  }, []);
  const navRef = useCallback((el: HTMLElement | null) => {
    nav.current = el;
    measure();
  }, [measure]);
  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  });
  const required: OperatorRole[] = anyOf ??
    (release ? ["release"] : finance ? ["finance"] : content ? ["content"] : ["support"]);
  const operation = !!anyOf || support || content || finance || release;
  const allowed = operation
    ? rolesReady && required.some((r) => roles.includes(r))
    : isAdmin;
  // Açık oturumda rol kaldırılırsa "yetki gerekiyor" yerine açıkça "kaldırıldı" denir.
  const revoked = operation && rolesReady && !roleError && !allowed &&
    required.some((r) => seenRoles.includes(r));

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
          : revoked
          ? (
            <div role="alert" data-testid="role-revoked">
              <Notice tone="error">
                <strong>Yetkiniz kaldırıldı.</strong>{" "}
                Bu bölümdeki rolünüz artık etkin değil; ekrandaki bilgiler gizlendi ve işlem yapılamaz.{" "}
                <button className="btn-secondary" onClick={() => void signOut()}>
                  Çıkış yap
                </button>
              </Notice>
            </div>
          )
          : !allowed
          ? (
            <Notice>
              {anyOf ? "Bu bölümü açmak için etkin bir operasyon yetkisi gerekiyor." : release ? "Bu bölümü açmak için etkin yayın operasyonu yetkisi gerekiyor." : finance ? "Bu bölümü açmak için etkin finans yetkisi gerekiyor." : content
                ? "Bu bölümü açmak için etkin içerik yetkisi gerekiyor."
                : "Bu bölümü açmak için etkin destek yetkisi gerekiyor."}{" "}
              <button className="btn-secondary" onClick={() => void signOut()}>
                Çıkış yap
              </button>
            </Notice>
          )
          : null}
        <div hidden={roleError || !allowed}>{allowed ? <OperatorAccessContext.Provider value={!!anyOf}>{children}</OperatorAccessContext.Provider> : null}</div>
      </>
    );
  } else if (adminRevoked) {
    // Q00-A3-7 (yönetici): admins satırı kalkınca her bölümde ayrı hata yerine tek bildirim; veri gizlenir.
    body = (
      <div role="alert" data-testid="admin-revoked">
        <Notice tone="error">
          <strong>Yönetici yetkiniz kaldırıldı.</strong>{" "}
          Bu oturumda yönetici bölümleri kapatıldı; ekrandaki bilgiler gizlendi ve işlem yapılamaz.{" "}
          <button className="btn-secondary" onClick={() => void signOut()}>
            Çıkış yap
          </button>
        </Notice>
      </div>
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
      <div className="admin-shell support-shell">
        <aside className={"admin-sidebar" + (menuOpen ? " menu-open" : "")}>
          <button
                className="admin-nav-toggle"
                aria-label="Yönetim menüsü"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen(!menuOpen)}
              >
                ☰ Menü
          </button>
          <Link
            href="/dashboard"
            className="admin-brand"
            aria-label="GINA yönetim ana sayfa"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo.png" width="132" height="56" alt="gina" />
            <span>Yönetim alanı</span>
          </Link>
          {session &&
              (isAdmin || roles.includes("support") ||
                roles.includes("content") || roles.includes("finance") || roles.includes("release"))
            ? (
              <nav ref={navRef} onScroll={measure} aria-label="Yönetim bölümleri" onClick={event=>{if((event.target as Element).closest("a"))setMenuOpen(false);}}>
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
                    {(isAdmin && !adminRevoked ? NAV.filter(item => item.href !== "/library") : [])
                      .map(item => (
                        <Link key={item.href} href={item.href} className="admin-nav">
                          {item.label}
                        </Link>
                      ))}
                  </details>
                ) : null}
                {(isAdmin && !adminRevoked && !publication ? NAV : []).map((item) => (
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
                    <PublicationIcon name={navIcons[item.href] ?? "document"} />{item.label}
                  </Link>
                ))}
                {!isAdmin || adminRevoked
                  ? OPERATOR_NAV.filter((item) => item.roles.some((r) => roles.includes(r))).map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={activePath === item.href ? "page" : undefined}
                      className={activePath === item.href ? "admin-nav active" : "admin-nav"}
                    >
                      <PublicationIcon name={navIcons[item.href] ?? "document"} />{item.label}
                    </Link>
                  ))
                  : null}
                {roles.includes("support")
                  ? (
                    <>
                      <Link
                        href="/support-replies"
                        className={router.pathname === "/support-replies" ? "admin-nav active" : "admin-nav"}
                        aria-current={router.pathname === "/support-replies" ? "page" : undefined}
                      >
                        <PublicationIcon name="document" />Hazır yanıtlar
                      </Link>
                      <Link
                        href="/support"
                        className={router.pathname === "/support"
                          ? "admin-nav active"
                          : "admin-nav"}
                        aria-current={router.pathname === "/support"
                          ? "page"
                          : undefined}
                      >
                        <PublicationIcon name="chat" />Destek
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
                        <PublicationIcon name="idea" />Fikirler
                      </Link>
                    </>
                  )
                  : null}
                {roles.includes("content") ? <Link href="/education-calendars" className={router.pathname === "/education-calendars" ? "admin-nav active" : "admin-nav"}><PublicationIcon name="school" />Eğitim takvimleri</Link> : null}
                {roles.includes("release") ? <Link href="/announcements" className={router.pathname === "/announcements" ? "admin-nav active" : "admin-nav"}><PublicationIcon name="chat" />Duyurular</Link> : null}
                {roles.includes("release") ? <Link href="/notifications" className={router.pathname === "/notifications" ? "admin-nav active" : "admin-nav"} aria-current={router.pathname === "/notifications" ? "page" : undefined}><PublicationIcon name="check" />Bildirim teslimi</Link> : null}
                {roles.includes("finance") ? <Link href="/billing" className={router.pathname === "/billing" ? "admin-nav active" : "admin-nav"} aria-current={router.pathname === "/billing" ? "page" : undefined}><PublicationIcon name="lock" />Paketler ve ödemeler</Link> : null}
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
                      <PublicationIcon name="document" />Yardım yazıları
                    </Link>
                  )
                  : null}
              </nav>
            )
            : null}
          {below > 0
            ? (
              <button
                type="button"
                className="admin-nav-more"
                data-testid="nav-more"
                onClick={() => nav.current?.scrollBy({ top: nav.current.clientHeight - 48, behavior: "smooth" })}
              >
                ↓ Aşağıda {below} bölüm daha
              </button>
            )
            : null}
          {session
            ? (
              <div className="admin-account">
                <span>
                  {isAdmin && !adminRevoked
                    ? "Yönetici"
                    : roles.includes("support")
                    ? "Destek ekibi"
                    : roles.includes("content")
                    ? "İçerik ekibi"
                    : roles.includes("finance") ? "Finans ekibi" : roles.includes("release") ? "Yayın operasyonu" : "Yetkili oturumu"}
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
              <div className="admin-page-actions"><span className="admin-badge">GINA Aile</span><div ref={setHeaderTarget} /></div>
            </header>
          )}
          <HeaderActionContext.Provider value={headerTarget}>{body}</HeaderActionContext.Provider>
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
