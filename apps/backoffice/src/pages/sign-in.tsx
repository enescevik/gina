import Head from "next/head";
import { useRouter } from "next/router";
import { type FormEvent, useEffect, useState } from "react";

import { Notice } from "@/components/Layout";
import { useAuth } from "@/lib/auth";
import { t } from "@/lib/i18n";
import { isConfigured, supabase } from "@/lib/supabase";

export default function SignIn() {
  const router = useRouter();
  const { session, isAdmin, roles, rolesReady } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session && isAdmin) void router.replace("/dashboard");
    else if (session && rolesReady && roles.includes("support")) {
      void router.replace("/support");
    } else if (session && rolesReady && roles.includes("content")) {
      void router.replace("/help-articles");
    } else if (session && rolesReady && roles.includes("finance")) {
      void router.replace("/billing");
    } else if (session && rolesReady && roles.includes("release")) {
      void router.replace("/notifications");
    }
  }, [session, isAdmin, roles, rolesReady, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase().auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (err) setError(t.signIn.failed);
    else if (data.session) void router.replace("/");
  }

  return (
    <>
      <Head>
        <title>{`${t.signIn.title} · ${t.appName}`}</title>
      </Head>
      <div className="flex min-h-screen items-center justify-center bg-[#FCFAF6] px-4">
        <form
          onSubmit={onSubmit}
          className="w-full max-w-md rounded-3xl border border-purple-100 bg-white p-8 shadow-sm"
        >
          <div className="mb-6 rounded-2xl bg-[#E8F4EF] p-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/logo.png"
              alt="gina"
              width="154"
              height="64"
              className="mb-4 h-16 w-auto object-contain"
            />
            <h1 className="text-2xl font-bold text-brand-dark">
              Yönetim alanına hoş geldiniz
            </h1>
          </div>
          <p className="mb-4 text-sm text-slate-500">{t.signIn.title}</p>
          <p className="mb-4 text-sm leading-6 text-slate-600">{t.signIn.accountHelp}</p>
          {!isConfigured
            ? <Notice tone="error">{t.common.notConfigured}</Notice>
            : null}
          {error ? <Notice tone="error">{error}</Notice> : null}
          {session && !isAdmin && rolesReady && !roles.includes("support") &&
              !roles.includes("content") && !roles.includes("finance") && !roles.includes("release")
            ? <Notice>{t.signIn.notAdmin}</Notice>
            : null}
          <label className="label" htmlFor="email">
            {t.signIn.email}
          </label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            required
            className="input mb-3"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <label className="label" htmlFor="password">
            {t.signIn.password}
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            className="input mb-4"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="submit"
            className="btn w-full"
            disabled={busy || !isConfigured}
          >
            {t.signIn.submit}
          </button>
          <a
            href="https://gina-web.pages.dev/sign-in?mode=reset"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex min-h-12 items-center justify-center rounded-xl font-semibold text-brand-dark underline decoration-purple-200 underline-offset-4 hover:bg-purple-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-600"
          >
            {t.signIn.forgot}
          </a>
          <p className="mt-2 text-sm leading-6 text-slate-500">{t.signIn.resetHelp}</p>
        </form>
      </div>
    </>
  );
}
