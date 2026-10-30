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
  if (!error) return null;
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
        ? String((error as { message: unknown }).message)
        : String(error);
  return <Text className="font-body text-sm text-danger">{message}</Text>;
}
