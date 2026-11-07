import { childErrorMessageKey, planLimitMessageKey } from "@gina/core";
import { Button } from "./button";
import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

/**
 * Q00-C12-13: web'de tarayıcı kaydırma kabını klavye odağına alabilir (Chrome). Kap işaretlenir;
 * `global.css` görünür odak halkasını yalnız klavye odağında (`:focus-visible`) çizer. Native'de etkisizdir.
 */
export const SCROLL_FOCUS = { dataSet: { ginaScroll: "1" } } as unknown as Record<string, never>;

export interface ScreenProps {
  title?: string;
  children: ReactNode;
  /** Çocuk teması: krem zemin, büyük yarıçaplar. */
  tone?: "parent" | "child";
  scroll?: boolean;
}

export function Screen({ title, children, tone = "parent", scroll = true }: ScreenProps) {
  const bg = tone === "child" ? "bg-cream dark:bg-night" : "bg-white dark:bg-night";
  const Body = scroll ? ScrollView : View;
  return (
    <SafeAreaView className={`flex-1 ${bg}`}>
      <Body {...(scroll ? SCROLL_FOCUS : {})} className="flex-1" contentContainerClassName="w-full max-w-3xl self-center gap-4 p-4">
        {title ? <Text className="text-2xl font-body-bold text-ink dark:text-night-text">{title}</Text> : null}
        {children}
      </Body>
    </SafeAreaView>
  );
}

export function ErrorText({ error, onViewPlans, tone = "parent" }: { error: unknown; onViewPlans?: () => void; tone?: "parent" | "child" }) {
  const { t, i18n } = useTranslation();
  if (!error) return null;
  if(tone==="child")return <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={{fontFamily:"Nunito_600SemiBold",fontSize:16,lineHeight:24,color:"#24203C",backgroundColor:"#F0ECFC",borderRadius:12,padding:10}}>{t(childErrorMessageKey(error))}</Text>;
  const detail = typeof error === "object" && error !== null ? error as { message?: string; code?: string; status?: number } : {};
  const message = detail.message ?? String(error);
  const planLimitKey = planLimitMessageKey(error);
  let copy: string;
  if (planLimitKey) copy = t(planLimitKey);
  else if (i18n.exists(`prova.ai.errors.${detail.code ?? message}`)) copy = t(`prova.ai.errors.${detail.code ?? message}`);
  else if (i18n.exists(`prova.ai.errors.${message}`)) copy = t(`prova.ai.errors.${message}`);
  // C12 (Q00-A2-13): sınıflandırılmış Edge hatası (ProvaAiError: izin/paket, çevrimdışı, geçici servis…) kendi
  // kategori metnini taşır; koda sahip olduğu için aşağıdaki genel metne düşmemeli.
  else if (typeof (error as { category?: unknown }).category === "string" && message.trim()) copy = message;
  else if (/network|fetch|connection|timeout|abort/i.test(message)) copy = t("release.networkError");
  else if (/invalid.login.credentials|invalid_credentials/i.test(message + detail.code)) copy = t("auth.invalidLogin");
  else if (/pin_locked/.test(message)) copy = t("release.pinLocked");
  else if (/rate.limit|too.many|over_email_send_rate_limit/i.test(message + detail.code)) copy = t("unified.errorRate");
  else if (/email_not_confirmed/i.test(message + detail.code)) copy = t("unified.errorEmail");
  else if (/weak_password|same_password/i.test(message + detail.code)) copy = t("unified.errorPassword");
  else if (/invalid_invite_code|invalid_or_expired_code|invalid_code|code_expired|pairing_not_found/i.test(message)) copy = t("unified.errorCode");
  else if (/invalid_pin/i.test(message)) copy = t("unified.errorPin");
  else if (/already_paired/i.test(message)) copy = t("unified.deviceAlreadyPaired");
  else if (/already_in_family|already_member/i.test(message)) copy = t("unified.familyAlreadyJoined");
  else if (detail.code === "42501" || detail.status === 403) copy = t("release.accessError");
  else if (detail.code?.startsWith("23") || detail.status === 400) copy = t("release.invalidForm");
  else if ((error instanceof Error || typeof error === "string") && !detail.code && !detail.status && /\s/.test(message) && !/^(TypeError|SyntaxError|JSON|Cannot|Unexpected)/.test(message)) copy = message;
  else copy = t("release.genericError");
  return <View style={{ gap: 12 }}><Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ fontFamily: "Nunito_600SemiBold", color: "#A43135", fontSize: 15, lineHeight: 22 }}>{copy}</Text>{planLimitKey && onViewPlans ? <Button title={t("subscription.viewPlans")} onPress={onViewPlans} /> : null}</View>;
}
