import type { Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { ginaClaimsSchema, resolveLocale, type GinaClaims } from "@gina/core";

import i18n, { adoptAccountLanguage } from "./i18n";
import { supabase } from "./supabase";
import { queryClient } from "./query";
import { clearReviewJournals } from "./review-journal";
import { clearAnswerJournals } from "./answer-journal";
import { clearLibraryCommands } from "./library-acquisition";
import { clearSetupCommands } from "./setup-command";
import { clearLearningPlanCommands } from "./learning-plan-command";
import { clearSchoolBagCommands } from "./school-bag-command";
import { clearTimetableCommands } from "./timetable-command";
import { clearRepeatCalendarCommands } from "./repeat-calendar-command";
import { clearStudyPlanCommands } from "./study-plan-command";
import { clearCalendarCommands } from "./calendar-command";
import { clearFocusTimers } from "./focus-storage";
import { clearHelpCommands } from "./help";

export interface SessionState {
  session: Session | null;
  claims: GinaClaims | null;
  /** Oturum depodan okunana kadar true. */
  loading: boolean;
  isAnonymous: boolean;
  error: unknown;
  recovering: boolean;
  retry: () => void;
}

// Auth can consume the web recovery callback while fonts are still loading, before the provider mounts.
// Keep only the event kind (no token/password), for this JS runtime; clear on sign-out or password update.
let recoveryPending = false;
supabase.auth.onAuthStateChange(event => {
  if (event === "PASSWORD_RECOVERY") recoveryPending = true;
  else if (event === "SIGNED_OUT" || event === "USER_UPDATED" || event === "SIGNED_IN") recoveryPending = false;
});

const SessionContext = createContext<SessionState | null>(null);

/** JWT gövdesindeki `gina` claim'ini okur (Custom Access Token Hook üretir). */
export function decodeClaims(accessToken: string | undefined): GinaClaims | null {
  const payload = accessToken?.split(".")[1];
  if (!payload) return null;
  try {
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as { gina?: unknown };
    const parsed = ginaClaimsSchema.safeParse(json.gina);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  const [recovering, setRecovering] = useState(() => recoveryPending);
  const account = useRef<string | null>(null);
  const retry = useCallback(() => { setLoading(true); setError(null); setAttempt(value => value + 1); }, []);

  useEffect(() => {
    let live = true;
    let changed = false;
    const apply = (next: Session | null) => {
      if (!live) return;
      // Clear before exposing another identity; query keys are shared across accounts.
      const scope=decodeClaims(next?.access_token);
      const identity=next ? [next.user.id,scope?.role,scope?.family_id,scope?.child_id].join(':') : null;
      if (account.current !== identity) queryClient.clear();
      account.current = identity;
      setRecovering(recoveryPending);
      setSession(next);
      setError(null);
      setLoading(false);
    };
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      if (_event === "INITIAL_SESSION") return; // getSession below owns initial read errors.
      changed = true;
      if (_event === "SIGNED_OUT") {
        for (const clear of [clearReviewJournals, clearAnswerJournals, clearHelpCommands, clearLibraryCommands, clearFocusTimers, clearCalendarCommands, clearStudyPlanCommands, clearRepeatCalendarCommands, clearTimetableCommands, clearSchoolBagCommands, clearLearningPlanCommands, clearSetupCommands]) {
          try { clear(); }
          catch { /* Scoped drafts remain inaccessible to another identity. */ }
        }
      }
      setRecovering(recoveryPending);
      apply(next);
    });
    void supabase.auth.getSession().then(({ data, error: readError }) => {
      if (!live || changed) return;
      if (readError) throw readError;
      apply(data.session);
    }).catch(readError => {
      if (live && !changed) { setError(readError); setLoading(false); }
    });
    return () => { live = false; subscription.subscription.unsubscribe(); };
  }, [attempt]);

  // Run outside onAuthStateChange: auth mutations inside its callback can deadlock.
  // Never emit USER_UPDATED during password recovery, where it ends recovery mode.
  const userId = session?.user.id;
  const anonymous = session?.user.is_anonymous;
  const savedLocale = session?.user.user_metadata.locale;
  useEffect(() => {
    if (!userId || anonymous || recovering) return;
    let live = true;
    const syncLocale = async () => {
      const locale = resolveLocale(i18n.language);
      if (savedLocale === locale || recoveryPending) return;
      const { data } = await supabase.auth.getSession();
      if (!live || recoveryPending || data.session?.user.id !== userId || data.session.user.is_anonymous) return;
      if (data.session.user.user_metadata.locale === locale) return;
      await supabase.auth.updateUser({ data: { locale } });
    };
    const sync = () => { void syncLocale().catch(() => { /* Retry on next session/language change. */ }); };
    void adoptAccountLanguage(savedLocale).then(() => { if (live) sync(); });
    i18n.on("languageChanged", sync);
    return () => { live = false; i18n.off("languageChanged", sync); };
  }, [userId, anonymous, savedLocale, recovering]);

  const value = useMemo<SessionState>(
    () => ({
      session,
      claims: decodeClaims(session?.access_token),
      loading,
      isAnonymous: session?.user.is_anonymous === true,
      error,
      recovering,
      retry,
    }),
    [session, loading, error, recovering, retry],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession, SessionProvider içinde kullanılmalı");
  return ctx;
}

/** Rol değişiminden sonra (aile kurma, eşleşme, PIN girişi) yeni claim'li token alır. */
export async function refreshClaims(): Promise<GinaClaims | null> {
  const { data, error } = await supabase.auth.refreshSession();
  if (error) throw error;
  return decodeClaims(data.session?.access_token);
}
