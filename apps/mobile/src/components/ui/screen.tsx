import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

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
      <Body className="flex-1" contentContainerClassName="w-full max-w-3xl self-center gap-4 p-4">
        {title ? <Text className="text-2xl font-body-bold text-ink dark:text-night-text">{title}</Text> : null}
        {children}
      </Body>
    </SafeAreaView>
  );
}

export function ErrorText({ error }: { error: unknown }) {
  const { t } = useTranslation();
  if (!error) return null;
  const detail = typeof error === "object" && error !== null ? error as { message?: string; code?: string; status?: number } : {};
  const message = detail.message ?? String(error);
  let copy: string;
  if (/network|fetch|connection|timeout/i.test(message)) copy = t("release.networkError");
  else if (/invalid.login.credentials|invalid_credentials/i.test(message + detail.code)) copy = t("auth.invalidLogin");
  else if (/locked|rate.limit|too.many/i.test(message)) copy = t("release.pinLocked");
  else if (detail.code === "42501" || detail.status === 403) copy = t("release.accessError");
  else if (detail.code?.startsWith("23") || detail.status === 400) copy = t("release.invalidForm");
  else if (error instanceof Error && !detail.code && !detail.status && /\s/.test(message) && !/^(TypeError|SyntaxError|JSON|Cannot|Unexpected)/.test(message)) copy = message;
  else copy = t("release.genericError");
  return <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ fontFamily: "Nunito_600SemiBold", color: "#A43135", fontSize: 15, lineHeight: 22 }}>{copy}</Text>;
}
