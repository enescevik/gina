import { Link, router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { ErrorText, Screen } from "@/components/ui/screen";
import { supabase } from "@/lib/supabase";

export default function SignInScreen() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const result =
        mode === "in"
          ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
          : await supabase.auth.signUp({ email: email.trim(), password });
      if (result.error) throw result.error;
      router.replace("/");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title={t("app.name")}>
      <Text className="text-base text-ink dark:text-night-text">
        {mode === "in" ? t("auth.signIn") : t("auth.signUp")}
      </Text>
      <Field
        label={t("auth.email")}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <Field
        label={t("auth.password")}
        secureTextEntry
        autoComplete={mode === "in" ? "current-password" : "new-password"}
        value={password}
        onChangeText={setPassword}
      />
      <ErrorText error={error} />
      <Button title={mode === "in" ? t("auth.signIn") : t("auth.signUp")} loading={busy} onPress={submit} />
      <Button
        variant="ghost"
        title={mode === "in" ? t("auth.signUp") : t("auth.signIn")}
        onPress={() => setMode(mode === "in" ? "up" : "in")}
      />
      <View className="mt-6 gap-2">
        <Button variant="secondary" title={t("auth.withApple")} disabled />
        <Button variant="secondary" title={t("auth.withGoogle")} disabled />
        <Text className="text-center text-xs text-gray-500">Apple ve Google ile giriş, sağlayıcılar tanımlanınca açılır.</Text>
      </View>
      <Link href="/(device)/pair" className="mt-8 text-center text-base text-teal-dark">
        Bu cihaz çocuk tableti
      </Link>
    </Screen>
  );
}
