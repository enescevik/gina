import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useState, type FormEvent } from "react";

import { Notice } from "@/components/Layout";
import { useAuth } from "@/lib/auth";
import { t } from "@/lib/i18n";
import { isConfigured, supabase } from "@/lib/supabase";

export default function SignIn() {
  const router = useRouter();
  const { session, isAdmin } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session && isAdmin) void router.replace("/dashboard");
  }, [session, isAdmin, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase().auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (err) setError(t.signIn.failed);
    else if (data.session) void router.replace("/dashboard");
  }

  return (
    <>
      <Head>
        <title>{`${t.signIn.title} · ${t.appName}`}</title>
      </Head>
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <form onSubmit={onSubmit} className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="mb-1 text-lg font-semibold text-brand-dark">{t.appName}</h1>
          <p className="mb-4 text-sm text-slate-500">{t.signIn.title}</p>
          {!isConfigured ? <Notice tone="error">{t.common.notConfigured}</Notice> : null}
          {error ? <Notice tone="error">{error}</Notice> : null}
          {session && !isAdmin ? <Notice>{t.signIn.notAdmin}</Notice> : null}
          <label className="label" htmlFor="email">
            {t.signIn.email}
          </label>
          <input id="email" type="email" autoComplete="username" required className="input mb-3"
            value={email} onChange={(e) => setEmail(e.target.value)} />
          <label className="label" htmlFor="password">
            {t.signIn.password}
          </label>
          <input id="password" type="password" autoComplete="current-password" required className="input mb-4"
            value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="submit" className="btn w-full" disabled={busy || !isConfigured}>
            {t.signIn.submit}
          </button>
        </form>
      </div>
    </>
  );
}
